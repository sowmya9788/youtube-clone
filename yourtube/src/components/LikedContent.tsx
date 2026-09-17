"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, X, ThumbsUp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";

export default function LikedVideosContent() {
  const [likedVideos, setLikedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      loadLikedVideos();
    }
  }, [user]);

  const loadLikedVideos = async () => {
    if (!user) return;

    try {
      const likedData = await axiosInstance.get(`/like/${user?._id}`);

      setLikedVideos(likedData.data);
    } catch (error) {
      console.error("Error loading liked videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlikeVideo = async (videoId: string, likedVideoId: string) => {
    if (!user) return;

    try {
      console.log("Unliking video:", videoId, "for user:", user.id);
      setLikedVideos(likedVideos.filter((item) => item._id !== likedVideoId));
    } catch (error) {
      console.error("Error unliking video:", error);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <ThumbsUp className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Keep track of videos you like
        </h2>
        <p className="text-gray-600 dark:text-gray-400">Sign in to see your liked videos.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4 text-gray-700 dark:text-gray-300">Loading liked videos...</div>;
  }

  if (likedVideos.length === 0) {
    return (
      <div className="text-center py-12">
        <ThumbsUp className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No liked videos yet</h2>
        <p className="text-gray-600 dark:text-gray-400">Videos you like will appear here.</p>
      </div>
    );
  }
  const videos = "/video/vdo.mp4";
  return (
    <div className="space-y-4 p-4 max-w-5xl">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{likedVideos.length} videos</p>
        <Button className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium">
          <Play className="w-4 h-4" />
          Play all
        </Button>
      </div>

      <div className="space-y-4">
        {likedVideos.map((item) => (
          <div key={item._id} className="flex gap-4 group">
            <Link href={`/watch/${item.videoid._id}?autoplay=true`} className="flex-shrink-0">
              <div className="relative w-40 aspect-video bg-gray-100 dark:bg-[#202020] rounded-lg overflow-hidden">
                <video
                  src={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${item.videoid?.filepath?.replace(/\\/g, "/")?.replace(/^\/+/, "")}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                  preload="metadata"
                  muted
                  playsInline
                  tabIndex={-1}
                />
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <Link href={`/watch/${item.videoid._id}?autoplay=true`}>
                <h3 className="font-medium text-sm line-clamp-2 text-gray-900 dark:text-white group-hover:text-blue-600 mb-1">
                  {item.videoid.videotitle}
                </h3>
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.videoid.videochanel}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.videoid.views.toLocaleString()} views •{" "}
                {formatDistanceToNow(new Date(item.videoid.createdAt))} ago
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Liked {formatDistanceToNow(new Date(item.createdAt))} ago
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 text-gray-700 dark:text-gray-300"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-[#1f1f1f] text-gray-900 dark:text-white border dark:border-gray-800">
                <DropdownMenuItem
                  onClick={() => handleUnlikeVideo(item.videoid._id, item._id)}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove from liked videos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
}
