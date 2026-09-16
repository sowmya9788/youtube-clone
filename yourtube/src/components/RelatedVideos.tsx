"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import React from "react";
import { CheckCircle2 } from "lucide-react";

interface RelatedVideosProps {
  videos: Array<{
    _id: string;
    videotitle: string;
    videochanel: string;
    views: number;
    createdAt: string;
    filepath?: string;
    duration?: string;
    [key: string]: any;
  }>;
}

export default function RelatedVideos({ videos }: RelatedVideosProps) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

  if (!videos || videos.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-gray-500">
        No recommended videos available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {videos.map((video) => {
        const videoSrc = video?.filepath
          ? video.filepath.startsWith("http")
            ? video.filepath
            : `${backendUrl}/${video.filepath.replace(/^\/+/, "")}`
          : "/video/vdo.mp4";

        return (
          <Link
            key={video._id}
            href={`/watch/${video._id}?autoplay=true`}
            className="flex gap-2.5 group cursor-pointer"
          >
            {/* Compact 16:9 Thumbnail */}
            <div className="relative w-40 aspect-video bg-gray-100 dark:bg-[#202020] rounded-xl overflow-hidden shrink-0 shadow-xs">
              <video
                src={videoSrc}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                preload="metadata"
                muted
                playsInline
                tabIndex={-1}
              />
              {video?.duration && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[10px] font-semibold px-1 py-0.2 rounded tracking-wide">
                  {video.duration}
                </div>
              )}
            </div>

            {/* Meta details */}
            <div className="flex-1 min-w-0 py-0.5">
              <h3 className="font-medium text-xs md:text-sm line-clamp-2 leading-snug text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {video.videotitle}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1 font-medium truncate">
                <span>{video.videochanel}</span>
                <CheckCircle2 className="w-2.5 h-2.5 text-gray-400 fill-gray-400/20 shrink-0" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {video.views !== undefined ? video.views.toLocaleString() : 0} views •{" "}
                {video.createdAt
                  ? formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })
                  : "recently"}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
