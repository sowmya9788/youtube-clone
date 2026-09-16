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

// Socket.io initialization for Real-time Watch Party
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

app.use(
  express.json({
    limit: "30mb",
    extended: true,
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

app.use(bodyParser.json());

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

const DBURL = process.env.DB_URL;

mongoose
  .connect(DBURL)
  .then(() => {
    console.log("Mongodb connected");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    console.error(
      "👉 Tip: If you're using MongoDB Atlas, make sure your current IP address is whitelisted in Network Access: https://cloud.mongodb.com"
    );
  });