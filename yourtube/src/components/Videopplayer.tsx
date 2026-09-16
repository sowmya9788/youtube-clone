"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Loader2,
  Settings,
  PictureInPicture2,
  Check,
  Radio,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VideoPlayerProps {
  video: {
    _id: string;
    videotitle: string;
    filepath?: string;
    videochanel?: string;
    views?: number;
    createdAt?: string;
    [key: string]: any;
  };
  nextVideo?: any;
  onNextVideo?: () => void;
  isWatchPartyActive?: boolean;
  onSyncAction?: (action: "play" | "pause" | "seek", time: number) => void;
  incomingSync?: {
    action: "play" | "pause" | "seek";
    time: number;
    senderName: string;
    timestamp: number;
  } | null;
  autoPlay?: boolean;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function VideoPlayer({
  video,
  isWatchPartyActive,
  onSyncAction,
  incomingSync,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Core Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIncomingSyncRef = useRef(false);

  // Resolve video source URL safely
  const videoSrc = useMemo(() => {
    if (!video?.filepath) return "/video/vdo.mp4";
    if (video.filepath.startsWith("http://") || video.filepath.startsWith("https://")) {
      return video.filepath;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    const cleanPath = video.filepath.replace(/^\/+/, "");
    return `${backendUrl}/${cleanPath}`;
  }, [video?.filepath]);

  // Clean unmount: pause and detach video
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute("src");
          videoRef.current.load();
        } catch (e) {}
      }
    };
  }, []);

  // Sync Watch Party events
  useEffect(() => {
    if (!incomingSync || !videoRef.current) return;
    const { action, time } = incomingSync;
    isIncomingSyncRef.current = true;

    if (action === "seek" || Math.abs(videoRef.current.currentTime - time) > 1.2) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }

    if (action === "play") {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else if (action === "pause") {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    const timer = setTimeout(() => {
      isIncomingSyncRef.current = false;
    }, 400);

    return () => clearTimeout(timer);
  }, [incomingSync]);

  const broadcastSync = (action: "play" | "pause" | "seek", time: number) => {
    if (isWatchPartyActive && onSyncAction && !isIncomingSyncRef.current) {
      onSyncAction(action, time);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds) || timeInSeconds < 0) {
      return "0:00";
    }
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !isDraggingProgress) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, isDraggingProgress]);

  // Play / Pause Toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          broadcastSync("play", videoRef.current?.currentTime || 0);
        })
        .catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
      broadcastSync("pause", videoRef.current?.currentTime || 0);
    }
  };

  // Seek by delta
  const seekBy = (seconds: number) => {
    if (!videoRef.current) return;
    const target = Math.min(
      Math.max(videoRef.current.currentTime + seconds, 0),
      duration || 0
    );
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    broadcastSync("seek", target);
    resetControlsTimer();
  };

  // Volume control
  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else {
      setIsMuted(false);
      videoRef.current.muted = false;
      setPrevVolume(clamped);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted || volume === 0) {
      const restore = prevVolume > 0 ? prevVolume : 1;
      videoRef.current.muted = false;
      videoRef.current.volume = restore;
      setIsMuted(false);
      setVolume(restore);
    } else {
      setPrevVolume(volume);
      videoRef.current.muted = true;
      videoRef.current.volume = 0;
      setIsMuted(true);
      setVolume(0);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // PiP
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {}
  };

  // Speed
  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  // Scrubber scrubbing
  const handleSeekFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!progressBarRef.current || !videoRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    broadcastSync("seek", newTime);
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingProgress(true);
    handleSeekFromEvent(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleSeekFromEvent(moveEvent);
    };

    const handleMouseUp = () => {
      setIsDraggingProgress(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
        case "arrowleft":
          e.preventDefault();
          seekBy(-10);
          break;
        case "l":
        case "arrowright":
          e.preventDefault();
          seekBy(10);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, duration, volume, isMuted]);

  // Video Events
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsBuffering(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDraggingProgress) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoEnded = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    setShowControls(true);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`group relative select-none overflow-hidden bg-black font-sans text-white ${
        isFullscreen
          ? "fixed inset-0 z-50 flex h-screen w-screen items-center justify-center rounded-none"
          : "aspect-video w-full rounded-xl shadow-2xl"
      }`}
      onMouseMove={resetControlsTimer}
      onMouseEnter={() => setShowControls(true)}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        className="h-full w-full object-contain cursor-pointer"
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={handleVideoEnded}
        onError={() => setIsBuffering(false)}
      >
        Your browser does not support HTML5 video.
      </video>

      {/* Watch Party Active Sync Badge */}
      {isWatchPartyActive && (
        <div className="pointer-events-none absolute top-4 left-4 z-20 flex items-center gap-2 bg-red-600/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg backdrop-blur-md">
          <Radio className="w-3.5 h-3.5" />
          <span>WATCH PARTY SYNC</span>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-red-600" />
            <span className="text-xs font-medium text-white/90">Loading...</span>
          </div>
        </div>
      )}

      {/* Bottom Playback Controls Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-6 md:px-4 md:pb-3 transition-opacity duration-200 ${
          showControls || !isPlaying ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* Timeline Progress Scrubber */}
        <div
          ref={progressBarRef}
          className="group/progress relative mb-3 flex h-3 w-full cursor-pointer items-center"
          onMouseDown={handleProgressBarMouseDown}
        >
          <div className="relative h-1 w-full rounded-full bg-white/25 group-hover/progress:h-1.5 transition-all">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-red-600"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-red-600 shadow"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-white" />
              ) : (
                <Play className="h-5 w-5 fill-white translate-x-0.5" />
              )}
            </button>

            <button
              onClick={() => seekBy(-10)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
              title="Rewind 10s"
            >
              <RotateCcw className="h-5 w-5" />
              <span className="absolute text-[9px] font-bold">10</span>
            </button>

            <button
              onClick={() => seekBy(10)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
              title="Forward 10s"
            >
              <RotateCw className="h-5 w-5" />
              <span className="absolute text-[9px] font-bold">10</span>
            </button>

            {/* Volume */}
            <div className="flex items-center group/volume">
              <button
                onClick={toggleMute}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200 flex items-center px-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/30 accent-red-600"
                />
              </div>
            </div>

            {/* Time */}
            <div className="ml-1 text-xs font-medium text-white/90 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/50">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                  title="Playback Speed"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 bg-[#1f1f1f] text-white border-white/10 rounded-xl p-1 z-50"
              >
                <DropdownMenuLabel className="text-xs text-gray-400 px-2 py-1">
                  Speed
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10 my-1" />
                {SPEED_OPTIONS.map((speed) => (
                  <DropdownMenuItem
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className="flex items-center justify-between px-2 py-1 text-xs hover:bg-white/10 rounded cursor-pointer"
                  >
                    <span>{speed === 1 ? "Normal" : `${speed}x`}</span>
                    {playbackSpeed === speed && <Check className="h-4 w-4 text-red-500" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={togglePiP}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="h-5 w-5" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
