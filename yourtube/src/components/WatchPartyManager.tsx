"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  Users,
  MessageSquare,
  Copy,
  Check,
  PhoneOff,
  Radio,
  Sparkles,
  Crown,
  Disc,
  StopCircle,
  Send,
  X,
  Smile,
  Maximize2,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";

interface Participant {
  socketId: string;
  userId: string;
  name: string;
  avatar?: string;
  isHost: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  isHost?: boolean;
  isSystem?: boolean;
}

interface WatchPartyManagerProps {
  partyId: string;
  videoId: string;
  user: any;
  onClose: () => void;
  onSyncReceived: (action: "play" | "pause" | "seek", time: number, senderName: string) => void;
  onBroadcastSyncRef: React.MutableRefObject<
    ((action: "play" | "pause" | "seek", time: number) => void) | null
  >;
}

export default function WatchPartyManager({
  partyId,
  videoId,
  user,
  onClose,
  onSyncReceived,
  onBroadcastSyncRef,
}: WatchPartyManagerProps) {
  const [activeTab, setActiveTab] = useState<"call" | "chat" | "participants">("call");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Call Media states
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Session Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Peer & Stream refs
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const remoteStreamsRef = useRef<{ [socketId: string]: MediaStream }>({});
  const [remoteStreamsState, setRemoteStreamsState] = useState<{ [socketId: string]: boolean }>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:5000";

  // WebRTC ICE configuration
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  // 1. Initialize Local Media Stream
  const initLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn("Camera/Mic access denied or not available, fallback to audio-only/avatar:", err);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setIsVideoOff(true);
        return audioStream;
      } catch (audioErr) {
        console.warn("Audio access also denied:", audioErr);
        setIsVideoOff(true);
        setIsAudioMuted(true);
        return null;
      }
    }
  };

  // Create Peer Connection
  const createPeerConnection = (targetSocketId: string, currentStream: MediaStream | null) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      return peerConnectionsRef.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current[targetSocketId] = pc;

    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc-signal", {
          toSocketId: targetSocketId,
          signalData: { candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      remoteStreamsRef.current[targetSocketId] = remoteStream;
      setRemoteStreamsState((prev) => ({ ...prev, [targetSocketId]: true }));
    };

    return pc;
  };

  // 2. Initialize Socket Connection and Listeners
  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    initLocalMedia().then((stream) => {
      socket.emit("join-party", {
        partyId,
        videoId,
        user: {
          _id: user?._id || "guest-" + Date.now(),
          name: user?.name || user?.email?.split("@")[0] || "Guest",
          avatar: user?.avatar || "",
        },
      });
    });

    // Handle Participant List Updates
    socket.on("party-participants-update", ({ participants: updatedList }: { participants: Participant[] }) => {
      setParticipants(updatedList);
    });

    // Handle incoming Chat Messages
    socket.on("party-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    // Handle Synchronized Video playback events
    socket.on("sync-video-broadcast", ({ action, currentTime, senderName }) => {
      onSyncReceived(action, currentTime, senderName);
      toast.info(`${senderName} ${action === "seek" ? "jumped to" : action + "ed"} the video`, {
        duration: 2500,
      });
    });

    // WebRTC: when a new user joins, initiate call
    socket.on("user-joined-call", async ({ signalUserId }) => {
      const pc = createPeerConnection(signalUserId, localStreamRef.current);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-signal", {
          toSocketId: signalUserId,
          signalData: { offer },
        });
      } catch (err) {
        console.error("Error creating WebRTC offer:", err);
      }
    });

    // WebRTC: Relay signals (offer, answer, candidate)
    socket.on("webrtc-signal-relay", async ({ fromSocketId, signalData }) => {
      let pc = peerConnectionsRef.current[fromSocketId];
      if (!pc) {
        pc = createPeerConnection(fromSocketId, localStreamRef.current);
      }

      try {
        if (signalData.offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc-signal", {
            toSocketId: fromSocketId,
            signalData: { answer },
          });
        } else if (signalData.answer) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.answer));
        } else if (signalData.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      } catch (err) {
        console.error("Error handling WebRTC signal:", err);
      }
    });

    // WebRTC: User left call
    socket.on("user-left-call", ({ socketId }) => {
      if (peerConnectionsRef.current[socketId]) {
        peerConnectionsRef.current[socketId].close();
        delete peerConnectionsRef.current[socketId];
      }
      if (remoteStreamsRef.current[socketId]) {
        delete remoteStreamsRef.current[socketId];
      }
      setRemoteStreamsState((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    // Broadcast sync hook from parent player
    onBroadcastSyncRef.current = (action: "play" | "pause" | "seek", time: number) => {
      if (socketRef.current) {
        socketRef.current.emit("sync-video", {
          partyId,
          action,
          currentTime: time,
          senderName: user?.name || "Host",
        });
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-party");
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      onBroadcastSyncRef.current = null;
    };
  }, [partyId, videoId, backendUrl]);

  // Handle Mute Toggle
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !isAudioMuted;
        audioTracks[0].enabled = !nextState;
        setIsAudioMuted(nextState);
        socketRef.current?.emit("toggle-media-state", {
          partyId,
          isMuted: nextState,
        });
        toast(nextState ? "Microphone muted" : "Microphone unmuted");
      }
    }
  };

  // Handle Video / Camera Toggle
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !isVideoOff;
        videoTracks[0].enabled = !nextState;
        setIsVideoOff(nextState);
        socketRef.current?.emit("toggle-media-state", {
          partyId,
          isCameraOff: nextState,
        });
        toast(nextState ? "Camera turned off" : "Camera turned on");
      }
    }
  };

  // Handle Screen Share Toggle
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);
        socketRef.current?.emit("toggle-media-state", {
          partyId,
          isScreenSharing: true,
        });

        // Replace track on peer connections
        const screenTrack = screenStream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && screenTrack) {
            sender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          stopScreenShare();
        };

        toast.success("Screen sharing started");
      } catch (err) {
        console.warn("Screen share cancelled or error:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    socketRef.current?.emit("toggle-media-state", {
      partyId,
      isScreenSharing: false,
    });

    // Restore camera track to peer connections
    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && cameraTrack) {
          sender.replaceTrack(cameraTrack);
        }
      });
    }
    toast("Screen sharing ended");
  };

  // Session Recording using MediaRecorder
  const toggleSessionRecording = async () => {
    if (!isRecording) {
      try {
        // Record screen or local stream
        let streamToRecord: MediaStream | null = screenStreamRef.current || localStreamRef.current;
        if (!streamToRecord) {
          streamToRecord = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        }

        recordedChunksRef.current = [];
        const recorder = new MediaRecorder(streamToRecord, {
          mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
            ? "video/webm;codecs=vp9"
            : "video/webm",
        });

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `watch-party-recording-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast.success("Watch party recording downloaded!");
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingSeconds(0);

        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);

        toast.success("Session recording started");
      } catch (err) {
        console.error("Recording error:", err);
        toast.error("Could not start session recording");
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setIsRecording(false);
    }
  };

  // Send Chat Message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !socketRef.current) return;

    socketRef.current.emit("send-party-message", {
      partyId,
      message: {
        senderName: user?.name || user?.email?.split("@")[0] || "Guest",
        senderAvatar: user?.avatar || "",
        text: chatInput.trim(),
        isHost: participants.find((p) => p.userId === user?._id)?.isHost,
      },
    });
    setChatInput("");
  };

  // Copy Invite Link
  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/watch/${videoId}?party=${partyId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const formatRecordingTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl text-white">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
          </span>
          <h2 className="text-sm font-bold tracking-wide uppercase flex items-center gap-1.5 text-white">
            <Radio className="w-4 h-4 text-red-500" /> Watch Party
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono">
            {partyId.substring(0, 6)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Invite Link */}
          <Button
            size="sm"
            variant="outline"
            onClick={copyInviteLink}
            className="h-8 text-xs bg-white/10 hover:bg-white/20 text-white border-white/15 gap-1.5 rounded-lg"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Invite Friends
              </>
            )}
          </Button>

          {/* Close Panel Button */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Leave / Close Watch Party"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="flex items-center justify-around border-b border-white/10 bg-[#161616] text-xs font-semibold">
        <button
          onClick={() => setActiveTab("call")}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "call"
              ? "text-red-500 border-b-2 border-red-500 bg-white/5"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Video className="w-4 h-4" /> Video Call ({participants.length})
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "chat"
              ? "text-red-500 border-b-2 border-red-500 bg-white/5"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Party Chat
          {messages.length > 0 && (
            <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {messages.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("participants")}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "participants"
              ? "text-red-500 border-b-2 border-red-500 bg-white/5"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" /> Participants ({participants.length})
        </button>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[360px] max-h-[480px]">
        {/* TAB 1: VIDEO CALL & TILES */}
        {activeTab === "call" && (
          <div className="space-y-3">
            {/* Screen Share Tile (if active) */}
            {isScreenSharing && (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black border-2 border-red-500/50 shadow-lg">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ScreenShare className="w-3 h-3" /> You are Sharing Screen
                </div>
              </div>
            )}

            {/* Video Streams Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Local User Tile */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-[#242424] border border-white/10 flex items-center justify-center group shadow-md">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${
                    isVideoOff ? "hidden" : "block"
                  }`}
                />
                {isVideoOff && (
                  <div className="flex flex-col items-center gap-1">
                    <Avatar className="w-12 h-12 border border-white/20">
                      <AvatarFallback className="bg-red-600 text-white font-bold text-lg">
                        {user?.name?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] text-gray-400">Camera Off</span>
                  </div>
                )}
                {/* Overlay Badges */}
                <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-md text-[11px] font-medium text-white flex items-center gap-1">
                  <span>You</span>
                  {participants.find((p) => p.userId === user?._id)?.isHost && (
                    <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                  )}
                </div>
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  {isAudioMuted && (
                    <div className="p-1 rounded-md bg-red-600/80 text-white">
                      <MicOff className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Participants Tiles */}
              {participants
                .filter((p) => p.userId !== user?._id)
                .map((peer) => {
                  return (
                    <div
                      key={peer.socketId}
                      className="relative aspect-video rounded-xl overflow-hidden bg-[#242424] border border-white/10 flex items-center justify-center shadow-md"
                    >
                      {remoteStreamsState[peer.socketId] && !peer.isCameraOff ? (
                        <video
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && remoteStreamsRef.current[peer.socketId]) {
                              el.srcObject = remoteStreamsRef.current[peer.socketId];
                            }
                          }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Avatar className="w-12 h-12 border border-white/20">
                            <AvatarFallback className="bg-purple-600 text-white font-bold text-lg">
                              {peer.name?.[0] || "P"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-gray-400">{peer.name}</span>
                        </div>
                      )}

                      <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-md text-[11px] font-medium text-white flex items-center gap-1">
                        <span className="truncate max-w-[80px]">{peer.name}</span>
                        {peer.isHost && (
                          <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                        )}
                      </div>

                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                        {peer.isMuted && (
                          <div className="p-1 rounded-md bg-red-600/80 text-white">
                            <MicOff className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 2: REAL-TIME CHAT */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-[320px] justify-between">
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No messages yet. Say hi to your watch party friends! 👋
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.isSystem
                        ? "items-center my-2 text-center"
                        : "items-start text-left"
                    }`}
                  >
                    {msg.isSystem ? (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-gray-300">
                        {msg.text}
                      </span>
                    ) : (
                      <div className="bg-[#242424] border border-white/10 rounded-xl p-2 max-w-[88%] shadow-xs">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold text-gray-200">
                            {msg.senderName}
                          </span>
                          {msg.isHost && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">
                              HOST
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 ml-auto">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-white break-words leading-relaxed">
                          {msg.text}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2 mt-2 pt-2 border-t border-white/10">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a message to party..."
                className="flex-1 bg-[#242424] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-red-500"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-auto px-3"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        )}

        {/* TAB 3: PARTICIPANTS LIST */}
        {activeTab === "participants" && (
          <div className="space-y-2">
            {participants.map((p) => (
              <div
                key={p.socketId}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#242424] border border-white/10"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-red-600 text-white font-bold text-xs">
                      {p.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">{p.name}</span>
                      {p.userId === user?._id && (
                        <span className="text-[10px] text-gray-400">(You)</span>
                      )}
                    </div>
                    {p.isHost && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                        <Crown className="w-2.5 h-2.5" /> Party Host
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      p.isMuted
                        ? "bg-red-500/20 text-red-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                    title={p.isMuted ? "Muted" : "Mic On"}
                  >
                    {p.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </div>
                  <div
                    className={`p-1.5 rounded-lg ${
                      p.isCameraOff
                        ? "bg-red-500/20 text-red-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                    title={p.isCameraOff ? "Camera Off" : "Camera On"}
                  >
                    {p.isCameraOff ? (
                      <VideoOff className="w-3.5 h-3.5" />
                    ) : (
                      <Video className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CALL CONTROLS TOOLBAR ── */}
      <div className="px-3 py-3 bg-[#1e1e1e] border-t border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Mute Mic */}
          <button
            onClick={toggleAudio}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              isAudioMuted
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Toggle Video */}
          <button
            onClick={toggleVideo}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              isVideoOff
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              isScreenSharing
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            <ScreenShare className="w-4 h-4" />
          </button>

          {/* Session Recording */}
          <button
            onClick={toggleSessionRecording}
            className={`p-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              isRecording
                ? "bg-red-600 text-white animate-pulse shadow-md shadow-red-600/30"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isRecording ? "Stop Recording" : "Record Session"}
          >
            {isRecording ? (
              <>
                <StopCircle className="w-4 h-4" />
                <span className="text-[11px] font-bold">
                  {formatRecordingTime(recordingSeconds)}
                </span>
              </>
            ) : (
              <Disc className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Leave Call */}
        <Button
          onClick={onClose}
          size="sm"
          className="bg-red-600/80 hover:bg-red-600 text-white rounded-xl gap-1.5 text-xs font-semibold px-3.5"
        >
          <PhoneOff className="w-3.5 h-3.5" /> Leave
        </Button>
      </div>
    </div>
  );
}
