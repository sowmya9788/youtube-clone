import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import Link from "next/link";
import {
  Clock,
  Download,
  MoreHorizontal,
  Share,
  ThumbsDown,
  ThumbsUp,
  Radio,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";

const VideoInfo = ({ video, onStartWatchParty, isPartyActive }: any) => {
  const [likes, setlikes] = useState(video.Like || 0);
  const [dislikes, setDislikes] = useState(video.Dislike || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloadSuccess, setDownloadSuccess] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const { user, isSubscribed: checkSubscribed, toggleSubscribe } = useUser() as any;
  const isSubscribed = checkSubscribed ? checkSubscribed(video?.uploader, video?.videochanel) : false;
  const isOwner = user && video?.uploader &&
    (user?._id === video?.uploader || user?.uid === video?.uploader);

  useEffect(() => {
    setlikes(video.Like || 0);
    setDislikes(video.Dislike || 0);
    setIsLiked(false);
    setIsDisliked(false);
    setDownloadError("");
    setDownloadSuccess("");
  }, [video]);

  const handleSubscribe = async () => {
    if (!user) {
      toast.error("Please sign in to subscribe to channels");
      return;
    }
    setSubscribing(true);
    try {
      await toggleSubscribe({
        channelId: video?.uploader,
        channelName: video?.videochanel,
        email: user?.email,
        userName: user?.name || user?.displayName,
      });
    } finally {
      setSubscribing(false);
    }
  };

  /* =========================
     VIEWS
  ========================= */
  useEffect(() => {
    const handleviews = async () => {
      if (user) {
        try {
          await axiosInstance.post(`/history/${video._id}`, {
            userId: user?._id,
          });
        } catch (error) {
          console.log(error);
        }
      } else {
        try {
          await axiosInstance.post(`/history/views/${video?._id}`);
        } catch (error) {
          console.log(error);
        }
      }
    };

    handleviews();
  }, [user, video]);

  /* =========================
     LIKE
  ========================= */
  const handleLike = async () => {
    if (!user) return;

    try {
      const res = await axiosInstance.post(`/like/${video._id}`, {
        userId: user?._id,
      });

      if (res.data.liked) {
        if (isLiked) {
          setlikes((prev: number) => prev - 1);
          setIsLiked(false);
        } else {
          setlikes((prev: number) => prev + 1);
          setIsLiked(true);

          if (isDisliked) {
            setDislikes((prev: number) => prev - 1);
            setIsDisliked(false);
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  /* =========================
     WATCH LATER
  ========================= */
  const handleWatchLater = async () => {
    if (!user) return;

    try {
      const res = await axiosInstance.post(`/watch/${video._id}`, {
        userId: user?._id,
      });

      if (res.data.watchlater) {
        setIsWatchLater(true);
      } else {
        setIsWatchLater(false);
      }
    } catch (error) {
      console.log(error);
    }
  };

  /* =========================
     DISLIKE
  ========================= */
  const handleDislike = async () => {
    if (!user) return;

    try {
      const res = await axiosInstance.post(`/like/${video._id}`, {
        userId: user?._id,
      });

      if (!res.data.liked) {
        if (isDisliked) {
          setDislikes((prev: number) => prev - 1);
          setIsDisliked(false);
        } else {
          setDislikes((prev: number) => prev + 1);
          setIsDisliked(true);

          if (isLiked) {
            setlikes((prev: number) => prev - 1);
            setIsLiked(false);
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  /* =========================
     DOWNLOAD
  ========================= */
  const handleDownload = async () => {
    if (!user) {
      setDownloadError("Please login before downloading videos.");
      return;
    }

    setDownloadError("");
    setDownloadSuccess("");
    setIsDownloading(true);

    try {
      const response = await axiosInstance.post(
        `/download/${video._id}`,
        {
          userId: user._id,
        },
        {
          responseType: "blob",
          validateStatus: (status) => status >= 200 && status < 500,
        }
      );

      const contentType = response.headers["content-type"] || "";

      if (contentType.includes("application/json")) {
        const text = await response.data.text();
        const data = JSON.parse(text);
        setDownloadError(
          data.message || "You have reached your daily download limit."
        );
        return;
      }

      if (response.status >= 200 && response.status < 300) {
        const blob = new Blob([response.data], {
          type: contentType || "video/mp4",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = video.filename || `${video.videotitle}.mp4`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setDownloadSuccess("Video downloaded successfully.");
        setTimeout(() => {
          setDownloadSuccess("");
        }, 4000);
        return;
      }

      setDownloadError("Unable to download this video.");
    } catch (error) {
      console.error("Download error:", error);
      setDownloadError("Something went wrong while downloading the video.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* VIDEO TITLE */}
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        {video.videotitle}
      </h1>

      {/* DOWNLOAD MESSAGES */}
      {downloadError && (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold">Download Not Available</p>
              <p className="text-sm mt-1">{downloadError}</p>
            </div>
          </div>
        </div>
      )}

      {downloadSuccess && (
        <div className="rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-950/40 dark:border-green-800 p-4 text-green-700 dark:text-green-300">
          <div className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <p className="font-medium">{downloadSuccess}</p>
          </div>
        </div>
      )}

      {/* CHANNEL & ACTION BUTTONS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Channel Profile */}
        <div className="flex items-center gap-4">
          <Link href={video?.uploader ? `/channel/${video.uploader}` : "#"}>
            <Avatar className="w-10 h-10 border dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold">
                {video.videochanel?.[0]}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link href={video?.uploader ? `/channel/${video.uploader}` : "#"}>
              <h3 className="font-semibold text-gray-900 dark:text-white hover:underline cursor-pointer">
                {video.videochanel}
              </h3>
            </Link>
          </div>
          {isOwner ? null : user ? (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className={`ml-2 font-semibold text-xs md:text-sm px-4 py-2 rounded-full transition-colors cursor-pointer ${
                isSubscribed
                  ? "bg-gray-200 hover:bg-gray-300 dark:bg-[#272727] dark:hover:bg-[#383838] text-gray-800 dark:text-gray-200"
                  : "bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black"
              } ${subscribing ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {subscribing ? "Updating..." : isSubscribed ? "Subscribed" : "Subscribe"}
            </button>
          ) : (
            <button
              onClick={() => toast.error("Please sign in to subscribe to channels")}
              className="ml-2 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black font-semibold text-xs md:text-sm px-4 py-2 rounded-full transition-colors cursor-pointer"
              title="Sign in to subscribe"
            >
              Subscribe
            </button>
          )}
        </div>

        {/* Interaction Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Like / Dislike Pill */}
          <div className="flex items-center bg-gray-100 dark:bg-[#272727] rounded-full overflow-hidden shadow-xs">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none px-3.5 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#383838]"
              onClick={handleLike}
            >
              <ThumbsUp
                className={`w-4 h-4 mr-2 ${
                  isLiked
                    ? "fill-current text-black dark:text-white"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              />
              <span className="text-xs font-semibold">
                {likes.toLocaleString()}
              </span>
            </Button>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none px-3 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#383838]"
              onClick={handleDislike}
            >
              <ThumbsDown
                className={`w-4 h-4 mr-1.5 ${
                  isDisliked
                    ? "fill-current text-black dark:text-white"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              />
              <span className="text-xs font-semibold">
                {dislikes > 0 ? dislikes.toLocaleString() : ""}
              </span>
            </Button>
          </div>

          {/* Watch Later */}
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-full px-3.5 bg-gray-100 dark:bg-[#272727] text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#383838] shadow-xs ${
              isWatchLater
                ? "text-red-600 dark:text-red-400 font-bold"
                : ""
            }`}
            onClick={handleWatchLater}
          >
            <Clock className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium">
              {isWatchLater ? "Saved" : "Watch Later"}
            </span>
          </Button>

          {/* Watch Party */}
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-full px-3.5 shadow-xs transition-all ${
              isPartyActive
                ? "bg-red-600 text-white font-bold hover:bg-red-700 animate-pulse"
                : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 font-semibold border border-red-500/20"
            }`}
            onClick={onStartWatchParty}
          >
            <Radio className="w-4 h-4 mr-2" />
            <span className="text-xs">
              {isPartyActive ? "Party Active" : "Watch Party"}
            </span>
          </Button>

          {/* Share */}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full px-3.5 bg-gray-100 dark:bg-[#272727] text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#383838] shadow-xs"
          >
            <Share className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium">Share</span>
          </Button>

          {/* Download */}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full px-3.5 bg-gray-100 dark:bg-[#272727] text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#383838] shadow-xs"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium">
              {isDownloading ? "Downloading..." : "Download"}
            </span>
          </Button>

          {/* More */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-gray-100 dark:bg-[#272727] text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#383838] shadow-xs"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* DESCRIPTION BOX */}
      <div className="bg-gray-100 dark:bg-[#272727] rounded-xl p-4 text-gray-900 dark:text-gray-100 transition-colors">
        <div className="flex flex-wrap gap-3 text-sm font-semibold mb-2 text-gray-900 dark:text-white">
          <span>{(video.views || 0).toLocaleString()} views</span>
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(video.createdAt || Date.now()))} ago
          </span>
        </div>

        <div
          className={`text-sm text-gray-800 dark:text-gray-200 leading-relaxed ${
            showFullDescription ? "" : "line-clamp-3"
          }`}
        >
          <p>
            {video.description ||
              "Sample video description. This contains the actual video description, upload details, and notes."}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 p-0 h-auto font-semibold text-gray-900 dark:text-gray-100 hover:text-red-600 dark:hover:text-red-400 hover:bg-transparent"
          onClick={() => setShowFullDescription(!showFullDescription)}
        >
          {showFullDescription ? "Show less" : "Show more"}
        </Button>
      </div>
    </div>
  );
};

export default VideoInfo;