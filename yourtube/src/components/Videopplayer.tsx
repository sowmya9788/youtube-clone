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
  SkipForward,
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
  nextVideo,
  onNextVideo,
  isWatchPartyActive,
  onSyncAction,
  incomingSync,
  autoPlay,
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

  // Seeking feedback & Autoplay Countdown states
  const [seekFeedback, setSeekFeedback] = useState<"-10" | "+10" | null>(null);
  const seekFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIncomingSyncRef = useRef(false);

  // Resolve video source URL safely
  const videoSrc = useMemo(() => {
    if (!video?.filepath) return "/video/vdo.mp4";
    if (video.filepath.startsWith("http://") || video.filepath.startsWith("https://")) {
      return video.filepath;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    const cleanPath = video.filepath.replace(/\\/g, "/").replace(/^\/+/, "");
    return `${backendUrl}/${cleanPath}`;
  }, [video?.filepath]);

  // Clean unmount: pause and detach video & clear timers
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      if (seekFeedbackTimeoutRef.current) {
        clearTimeout(seekFeedbackTimeoutRef.current);
      }
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
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

  // Handle Autoplay if requested
  useEffect(() => {
    if (autoPlay && videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            // Autoplay with sound is often blocked by browsers; fallback to muted autoplay
            console.warn("Autoplay audio blocked, attempting muted autoplay:", err?.message);
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          });
      }
    }
  }, [autoPlay, videoSrc]);

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
      // Pause any other <video> elements currently playing
      document.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
        if (v !== videoRef.current && !v.paused) {
          v.pause();
        }
      });
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


  const triggerSeekFeedback = (type: "-10" | "+10") => {
    if (seekFeedbackTimeoutRef.current) {
      clearTimeout(seekFeedbackTimeoutRef.current);
    }
    setSeekFeedback(type);
    seekFeedbackTimeoutRef.current = setTimeout(() => {
      setSeekFeedback(null);
    }, 650);
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
    triggerSeekFeedback(seconds < 0 ? "-10" : "+10");
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

  const cancelAutoplayCountdown = () => {
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
    setAutoplayCountdown(null);
  };

  const handleNextClick = () => {
    cancelAutoplayCountdown();
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    if (onNextVideo) {
      onNextVideo();
    }
  };

  const handleVideoEnded = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    setShowControls(true);

    if (nextVideo && onNextVideo) {
      cancelAutoplayCountdown();
      let remaining = 5;
      setAutoplayCountdown(remaining);
      autoplayTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          cancelAutoplayCountdown();
          onNextVideo();
        } else {
          setAutoplayCountdown(remaining);
        }
      }, 1000);
    } else if (onNextVideo) {
      onNextVideo();
    }
  };

  // Mobile double-tap gesture handling
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("[role='menu']") ||
      target.closest("[data-radix-popper-content-wrapper]")
    ) {
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch || !containerRef.current) return;

    const now = Date.now();
    const rect = containerRef.current.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    const prevTouch = lastTouchRef.current;

    if (
      prevTouch &&
      now - prevTouch.time < 320 &&
      Math.abs(touchX - prevTouch.x) < 40 &&
      Math.abs(touchY - prevTouch.y) < 40
    ) {
      // Double tap detected!
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTouchRef.current = null;

      if (touchX < rect.width * 0.45) {
        seekBy(-10);
      } else if (touchX > rect.width * 0.55) {
        seekBy(10);
      } else {
        togglePlay();
      }
    } else {
      lastTouchRef.current = { time: now, x: touchX, y: touchY };
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      singleTapTimeoutRef.current = setTimeout(() => {
        setShowControls((prev) => !prev);
        resetControlsTimer();
        singleTapTimeoutRef.current = null;
      }, 280);
    }
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
      onTouchEnd={handleTouchEnd}
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

      {/* Seeking Visual Feedback Badge: Left (-10s) */}
      {seekFeedback === "-10" && (
        <div className="pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md text-white rounded-full h-20 w-20 shadow-2xl border border-white/20 animate-in fade-in zoom-in-75 duration-200">
          <RotateCcw className="h-7 w-7 text-white mb-0.5 animate-pulse" />
          <span className="text-xs font-bold tracking-wider">-10s</span>
        </div>
      )}

      {/* Seeking Visual Feedback Badge: Right (+10s) */}
      {seekFeedback === "+10" && (
        <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md text-white rounded-full h-20 w-20 shadow-2xl border border-white/20 animate-in fade-in zoom-in-75 duration-200">
          <RotateCw className="h-7 w-7 text-white mb-0.5 animate-pulse" />
          <span className="text-xs font-bold tracking-wider">+10s</span>
        </div>
      )}

      {/* Autoplay Next Video Countdown Overlay */}
      {autoplayCountdown !== null && nextVideo && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-sm w-full bg-[#181818] border border-white/10 rounded-2xl p-5 text-white shadow-2xl flex flex-col items-center text-center">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="h-16 w-16 rounded-full border-4 border-white/20 border-t-red-600 animate-spin" />
              <span className="absolute text-xl font-bold">{autoplayCountdown}</span>
            </div>
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">
              Up Next in {autoplayCountdown}s
            </p>
            <h4 className="text-sm font-semibold line-clamp-2 mb-4 px-2">
              {nextVideo.videotitle || "Next Video"}
            </h4>
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={cancelAutoplayCountdown}
                className="flex-1 py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleNextClick}
                className="flex-1 py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Play Now</span>
              </button>
            </div>
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

            {/* Next Video */}
            <button
              onClick={handleNextClick}
              disabled={!nextVideo}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={nextVideo ? `Next: ${nextVideo?.videotitle || "Next video"}` : "No next video"}
              aria-label="Next video"
            >
              <SkipForward className="h-5 w-5 fill-white" />
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
