import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { CheckCircle2 } from "lucide-react";
import React from "react";

export default function VideoCard({ video }: any) {
  // NEXT_PUBLIC_ prefix required for client-side env vars in Next.js
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:5000";

  // Resolve video source
  const videoSrc = video?.filepath
    ? video.filepath.startsWith("http")
      ? video.filepath
      : `${backendUrl}/${video.filepath.replace(/\\/g, "/").replace(/^\/+/, "")}`
    : "/video/vdo.mp4";

  // Only pass a src to AvatarImage if it's a real URL — avoids 404 spam
  const avatarSrc =
    video?.uploaderAvatar && video.uploaderAvatar.startsWith("http")
      ? video.uploaderAvatar
      : undefined;

  return (
    <Link href={`/watch/${video?._id}?autoplay=true`} className="group flex flex-col gap-3">
      {/* 16:9 Thumbnail with Duration Overlay */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-[#202020]">
        <video
          src={videoSrc}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
        />
        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-md tracking-wider">
          {video?.duration || ""}
        </div>
      </div>

      {/* Video Metadata Row */}
      <div className="flex gap-3 items-start px-0.5">
        {/* Channel Avatar */}
        <Avatar className="w-9 h-9 shrink-0 mt-0.5">
          {avatarSrc && <AvatarImage src={avatarSrc} />}
          <AvatarFallback className="bg-red-600 text-white font-bold text-xs">
            {video?.videochanel?.[0]?.toUpperCase() || "Y"}
          </AvatarFallback>
        </Avatar>

        {/* Video Info Details */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {video?.videotitle}
          </h3>

          {/* Channel Name */}
          <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 font-medium">
            <span>{video?.videochanel}</span>
            <CheckCircle2 className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" />
          </p>

          {/* Views and Time Ago */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {(video?.views || 0).toLocaleString()} views •{" "}
            {video?.createdAt
              ? formatDistanceToNow(new Date(video.createdAt), {
                  addSuffix: true,
                })
              : "recently"}
          </p>
        </div>
      </div>
    </Link>
  );
}
