import React, { useEffect, useState } from "react";
import Videocard from "./videocard";
import axiosInstance from "@/lib/axiosinstance";

export default function Videogrid() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get("/video/getall");
      setVideos(res.data || []);
    } catch (err: any) {
      console.warn("Error fetching videos:", err?.message);
      setError(
        err?.response?.data?.message ||
          "Could not load videos. Please check your backend and database connection."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px 12px",
        }}
      >
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex flex-col gap-3 animate-pulse">
            <div className="aspect-video w-full rounded-xl bg-gray-200 dark:bg-[#202020]" />
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-[#202020] shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-200 dark:bg-[#202020] rounded w-4/5" />
                <div className="h-3 bg-gray-200 dark:bg-[#202020] rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-3 text-2xl">
          ⚠️
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Unable to Load Videos
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">
          {error}
        </p>
        <button
          onClick={fetchVideos}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#202020] flex items-center justify-center mb-4 text-2xl">
          🎬
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          No videos available yet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
          Upload a video or check back soon to discover new content!
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "24px 12px",
      }}
    >
      {videos.map((video: any) => (
        <Videocard key={video._id} video={video} />
      ))}
    </div>
  );
}
