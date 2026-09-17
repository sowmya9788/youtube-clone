"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Search } from "lucide-react";
import axiosInstance from "@/lib/axiosinstance";

interface SearchResultProps {
  query?: string | string[];
}

export default function SearchResult({ query = "" }: SearchResultProps) {
  const queryString = typeof query === "string" ? query : Array.isArray(query) ? query[0] : "";
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!queryString || !queryString.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await axiosInstance.get("/video/getall");
        const allVideos = res.data || [];
        const q = queryString.toLowerCase().trim();

        const filtered = allVideos.filter(
          (vid: any) =>
            vid.videotitle?.toLowerCase().includes(q) ||
            vid.videochanel?.toLowerCase().includes(q) ||
            vid.description?.toLowerCase().includes(q)
        );

        setResults(filtered);
      } catch (error) {
        console.error("Error searching videos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [queryString]);

  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

  if (!queryString || !queryString.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#202020] flex items-center justify-center mb-4 text-gray-500">
          <Search className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Enter a search term
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Search for videos, creators, topics, or keywords.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl py-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row gap-4 animate-pulse"
          >
            <div className="aspect-video w-full sm:w-80 md:w-96 rounded-2xl bg-gray-200 dark:bg-[#202020] shrink-0" />
            <div className="flex-1 space-y-3 py-2">
              <div className="h-5 bg-gray-200 dark:bg-[#202020] rounded-md w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-[#202020] rounded-md w-1/4" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#202020]" />
                <div className="h-3 bg-gray-200 dark:bg-[#202020] rounded-md w-1/3" />
              </div>
              <div className="h-3 bg-gray-200 dark:bg-[#202020] rounded-md w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#202020] flex items-center justify-center mb-4 text-2xl">
          🔍
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          No results found for "{queryString}"
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Try different keywords or check for spelling errors.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl py-2">
      {results.map((video) => {
        const videoSrc = video?.filepath
          ? video.filepath.startsWith("http")
            ? video.filepath
            : `${backendUrl}/${video.filepath.replace(/\\/g, "/").replace(/^\/+/, "")}`
          : "/video/vdo.mp4";

        return (
          <div
            key={video._id}
            className="flex flex-col sm:flex-row gap-4 group cursor-pointer p-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
          >
            {/* 16:9 Thumbnail */}
            <Link
              href={`/watch/${video._id}?autoplay=true`}
              className="relative aspect-video w-full sm:w-80 md:w-96 rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#202020] shrink-0 shadow-xs"
            >
              <video
                src={videoSrc}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                preload="metadata"
                muted
                playsInline
                tabIndex={-1}
              />
              {video?.duration && (
                <div className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-md tracking-wider backdrop-blur-xs">
                  {video.duration}
                </div>
              )}
            </Link>

            {/* Video Details Column */}
            <div className="flex-1 min-w-0 py-1 flex flex-col justify-start">
              <Link href={`/watch/${video._id}?autoplay=true`}>
                <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-1 transition-colors">
                  {video.videotitle}
                </h3>
              </Link>

              {/* Views and Upload Time */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span>
                  {video.views !== undefined ? video.views.toLocaleString() : 0} views
                </span>
                <span>•</span>
                <span>
                  {video.createdAt
                    ? formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })
                    : "recently"}
                </span>
              </div>

              {/* Channel Profile */}
              <Link
                href={`/channel/${video.uploader || video._id}`}
                className="flex items-center gap-2 mb-2 group/channel w-fit"
              >
                <Avatar className="w-6 h-6 ring-1 ring-black/5 dark:ring-white/10">
                  <AvatarImage src={video.uploaderAvatar || ""} />
                  <AvatarFallback className="bg-red-600 text-white font-bold text-[10px]">
                    {video.videochanel?.[0] || "Y"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover/channel:text-gray-900 dark:group-hover/channel:text-white flex items-center gap-1 transition-colors">
                  {video.videochanel}
                  <CheckCircle2 className="w-3 h-3 text-gray-400 fill-gray-400/20" />
                </span>
              </Link>

              {/* Description Snippet */}
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {video.description ||
                  "Watch this video on YourTube to explore high-quality media, community reactions, and real-time watch parties."}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
