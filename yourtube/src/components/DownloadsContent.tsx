import React, {
  useEffect,
  useState,
} from "react";

import axiosInstance from "@/lib/axiosinstance";

import { useUser } from "@/lib/AuthContext";

import {
  Download,
  Play,
} from "lucide-react";

import Link from "next/link";

const DownloadsContent =
  () => {
    const { user } =
      useUser();

    const [
      downloads,
      setDownloads,
    ] = useState<any[]>([]);

    const [
      loading,
      setLoading,
    ] = useState(true);

    const loadDownloads =
      async () => {
        if (!user) {
          setLoading(false);
          return;
        }

        try {
          const res =
            await axiosInstance.get(
              `/download/user/${user._id}`
            );

          setDownloads(
            res.data || []
          );
        } catch (error) {
          console.error(
            "Error loading downloads:",
            error
          );
        } finally {
          setLoading(false);
        }
      };

    useEffect(() => {
      loadDownloads();
    }, [user]);

    if (!user) {
      return (
        <div className="p-6 text-gray-700 dark:text-gray-300">
          Please login to view your downloads.
        </div>
      );
    }

    if (loading) {
      return (
        <div className="p-6 text-gray-700 dark:text-gray-300">
          Loading downloads...
        </div>
      );
    }

    return (
      <div className="p-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-6 text-gray-900 dark:text-white">
          <Download className="w-7 h-7" />
          <h1 className="text-2xl font-bold">
            Downloads
          </h1>
        </div>

        {downloads.length === 0 ? (
          <div className="text-center py-16">
            <Download className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              No downloads yet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Videos you download will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {downloads.map((item) => (
              <div
                key={item._id}
                className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181818] rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#222222] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-[#282828] rounded-lg flex items-center justify-center text-gray-700 dark:text-gray-300">
                    <Play className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.videoTitle}
                    </h3>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Downloaded on{" "}
                      {new Date(item.downloadDate).toLocaleString()}
                    </p>

                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1 uppercase">
                      Plan: {item.userPlan}
                    </p>
                  </div>
                </div>

                <Link href={`/watch/${item.videoid}`}>
                  <button className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                    Watch
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

export default DownloadsContent;