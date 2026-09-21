import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";
import path from "path";

import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyrroutes from "./routes/history.js";
import commentroutes from "./routes/comment.js";
import downloadroutes from "./routes/download.js";
import paymentroutes from "./routes/payment.js";
import subscriptionroutes from "./routes/subscription.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS and Socket.io (localhost + production Vercel URL)
const envFrontendUrls = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim().replace(/\/$/, ""))
  : [];

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://youtube-4zjff1dk9-sowmya21.vercel.app",
  ...envFrontendUrls,
];

const checkCorsOrigin = (origin, callback) => {
  // Allow server-to-server, curl, mobile apps, or same-origin requests without an Origin header
  if (!origin) return callback(null, true);

  const cleanOrigin = origin.trim().replace(/\/$/, "");
  if (allowedOrigins.includes(cleanOrigin)) {
    return callback(null, true);
  }

  // Allow any Vercel preview or production deployment domain (*.vercel.app)
  if (/^https:\/\/.*\.vercel\.app$/.test(cleanOrigin)) {
    return callback(null, true);
  }

  return callback(null, false);
};

// Socket.io initialization for Real-time Watch Party
const io = new Server(server, {
  cors: {
    origin: checkCorsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const corsOptions = {
  origin: checkCorsOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "30mb",
  })
);

app.use(
  express.urlencoded({
    limit: "30mb",
    extended: true,
  })
);

app.use("/uploads", express.static(path.join("uploads")));

app.get("/", (req, res) => {
  res.send("YourTube backend & Watch Party server is working");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.use("/user", userroutes);
app.use("/video", videoroutes);
app.use("/like", likeroutes);
app.use("/watch", watchlaterroutes);
app.use("/history", historyrroutes);
app.use("/comment", commentroutes);
app.use("/download", downloadroutes);
app.use("/payment", paymentroutes);
app.use("/subscription", subscriptionroutes);

/* ==========================================================
   WATCH PARTY REAL-TIME SIGNALING & PLAYBACK SYNCHRONIZATION
========================================================== */
const parties = new Map();

io.on("connection", (socket) => {
  // Join Watch Party Room
  socket.on("join-party", ({ partyId, videoId, user }) => {
    if (!partyId) return;
    socket.join(partyId);

    if (!parties.has(partyId)) {
      parties.set(partyId, {
        hostId: user?._id || socket.id,
        videoId: videoId,
        createdAt: new Date(),
        participants: [],
      });
    }

    const party = parties.get(partyId);
    // Remove if previously existing
    party.participants = party.participants.filter(
      (p) => p.socketId !== socket.id && p.userId !== (user?._id || socket.id)
    );

    const participant = {
      socketId: socket.id,
      userId: user?._id || socket.id,
      name:
        user?.name ||
        user?.email?.split("@")[0] ||
        `Guest_${socket.id.substring(0, 4)}`,
      avatar: user?.avatar || "",
      isHost: party.hostId === (user?._id || socket.id),
      isMuted: false,
      isCameraOff: true,
      isScreenSharing: false,
    };
    party.participants.push(participant);

    // Broadcast updated participant list
    io.to(partyId).emit("party-participants-update", {
      participants: party.participants,
      hostId: party.hostId,
    });

    // Notify other peers for WebRTC video calling
    socket.to(partyId).emit("user-joined-call", {
      signalUserId: socket.id,
      participant,
    });

    // Broadcast welcome system message
    io.to(partyId).emit("party-message", {
      id: "sys-" + Date.now(),
      senderName: "System",
      text: `${participant.name} joined the watch party! 🍿`,
      timestamp: new Date().toISOString(),
      isSystem: true,
    });
  });

  // Video Playback Synchronizer (Play / Pause / Seek)
  socket.on("sync-video", ({ partyId, action, currentTime, senderName }) => {
    if (!partyId) return;
    socket.to(partyId).emit("sync-video-broadcast", {
      action,
      currentTime,
      senderName: senderName || "A participant",
      timestamp: Date.now(),
    });
  });

  // Real-Time Chat Message
  socket.on("send-party-message", ({ partyId, message }) => {
    if (!partyId) return;
    io.to(partyId).emit("party-message", {
      ...message,
      id: message.id || "msg-" + Date.now(),
      timestamp: new Date().toISOString(),
    });
  });

  // WebRTC Mesh Signaling Relay
  socket.on("webrtc-signal", ({ toSocketId, signalData, fromParticipant }) => {
    if (toSocketId) {
      io.to(toSocketId).emit("webrtc-signal-relay", {
        fromSocketId: socket.id,
        signalData,
        fromParticipant,
      });
    }
  });

  // Media state changes (Mic, Camera, Screen Share)
  socket.on("toggle-media-state", ({ partyId, isMuted, isCameraOff, isScreenSharing }) => {
    if (!partyId || !parties.has(partyId)) return;
    const party = parties.get(partyId);
    const participant = party.participants.find((p) => p.socketId === socket.id);
    if (participant) {
      if (typeof isMuted === "boolean") participant.isMuted = isMuted;
      if (typeof isCameraOff === "boolean") participant.isCameraOff = isCameraOff;
      if (typeof isScreenSharing === "boolean") participant.isScreenSharing = isScreenSharing;

      io.to(partyId).emit("party-participants-update", {
        participants: party.participants,
        hostId: party.hostId,
      });
    }
  });

  // Leave Party / Disconnect handler
  const handleLeave = () => {
    for (const [partyId, party] of parties.entries()) {
      const participantIndex = party.participants.findIndex(
        (p) => p.socketId === socket.id
      );
      if (participantIndex !== -1) {
        const [leavingUser] = party.participants.splice(participantIndex, 1);
        socket.leave(partyId);

        if (party.participants.length === 0) {
          parties.delete(partyId);
        } else {
          // Transfer host if host left
          if (party.hostId === leavingUser.userId || party.hostId === socket.id) {
            party.hostId = party.participants[0].userId;
            party.participants[0].isHost = true;
          }
          io.to(partyId).emit("party-participants-update", {
            participants: party.participants,
            hostId: party.hostId,
          });
          io.to(partyId).emit("user-left-call", {
            socketId: socket.id,
          });
          io.to(partyId).emit("party-message", {
            id: "sys-" + Date.now(),
            senderName: "System",
            text: `${leavingUser.name} left the watch party.`,
            timestamp: new Date().toISOString(),
            isSystem: true,
          });
        }
      }
    }
  };

  socket.on("leave-party", handleLeave);
  socket.on("disconnect", handleLeave);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server & Socket.IO running on port ${PORT}`);
});

const DBURL = process.env.MONGO_URI || process.env.DB_URL;

if (!DBURL) {
  console.error("❌ MongoDB connection error: Neither MONGO_URI nor DB_URL is defined in environment variables.");
  console.error("👉 Please define MONGO_URI in your .env or Render dashboard (e.g. MONGO_URI=mongodb+srv://...)");
} else {
  mongoose
    .connect(DBURL)
    .then(() => {
      console.log("✅ MongoDB Atlas connected successfully");
    })
    .catch((error) => {
      console.error("❌ MongoDB connection failed:", error.message);
      console.error(
        "👉 Tip: If you're using MongoDB Atlas, make sure your Network Access (IP Whitelist) allows your server IP (or 0.0.0.0/0 for cloud hosts like Render): https://cloud.mongodb.com"
      );
    });
}