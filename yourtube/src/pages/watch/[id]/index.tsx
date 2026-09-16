import Comments from "@/components/Comments";
import RelatedVideos from "@/components/RelatedVideos";
import VideoInfo from "@/components/VideoInfo";
import Videopplayer from "@/components/Videopplayer";
import WatchPartyManager from "@/components/WatchPartyManager";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function WatchPage() {
  const router = useRouter();
  const { id, party, autoplay } = router.query;
  const { user } = useUser() as any;

  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Watch Party States
  const [partyId, setPartyId] = useState<string | null>(null);
  const [isPartyOpen, setIsPartyOpen] = useState(false);
  const [incomingSync, setIncomingSync] = useState<{
    action: "play" | "pause" | "seek";
    time: number;
    senderName: string;
    timestamp: number;
  } | null>(null);

  const broadcastSyncRef = useRef<
    ((action: "play" | "pause" | "seek", time: number) => void) | null
  >(null);

  // Sync partyId with query parameter if present
  useEffect(() => {
    if (party && typeof party === "string") {
      setPartyId(party);
      setIsPartyOpen(true);
    }
  }, [party]);

  // When `id` changes: immediately unmount previous player and load the target video
  useEffect(() => {
    if (!id || typeof id !== "string") return;

    let isMounted = true;
    setCurrentVideo(null);
    setLoading(true);

    const fetchVideo = async () => {
      try {
        let list = allVideos;
        if (!list || list.length === 0) {
          const res = await axiosInstance.get("/video/getall");
          if (!isMounted) return;
          list = res.data || [];
          setAllVideos(list);
        }

        const matched = list.find((vid: any) => vid._id === id);
        if (matched) {
          if (isMounted) setCurrentVideo(matched);
        } else {
          const res = await axiosInstance.get("/video/getall");
          if (!isMounted) return;
          const freshList = res.data || [];
          setAllVideos(freshList);
          const freshMatched = freshList.find((vid: any) => vid._id === id);
          if (isMounted) setCurrentVideo(freshMatched || null);
        }
      } catch (error) {
        console.error("Error fetching video:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchVideo();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const nextVideo = useMemo(() => {
    if (!allVideos || !Array.isArray(allVideos) || allVideos.length <= 1 || !id) return null;
    const currentIndex = allVideos.findIndex((v: any) => v._id === id);
    if (currentIndex === -1) return allVideos[0];
    return allVideos[(currentIndex + 1) % allVideos.length];
  }, [allVideos, id]);

  const handleNextVideo = () => {
    if (nextVideo?._id) {
      const query: Record<string, string> = { autoplay: "true" };
      if (partyId) query.party = partyId;
      router.push({
        pathname: `/watch/${nextVideo._id}`,
        query,
      });
    }
  };

  // Start or Toggle Watch Party
  const handleStartWatchParty = () => {
    if (!partyId) {
      const newPartyId = `party_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
      setPartyId(newPartyId);
      setIsPartyOpen(true);
      router.push(
        {
          pathname: router.pathname,
          query: { ...router.query, party: newPartyId },
        },
        undefined,
        { shallow: true }
      );
    } else {
      setIsPartyOpen(!isPartyOpen);
    }
  };

  const handleCloseParty = () => {
    setIsPartyOpen(false);
    setPartyId(null);
    const query = { ...router.query };
    delete query.party;
    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  const handleSyncReceived = (
    action: "play" | "pause" | "seek",
    time: number,
    senderName: string
  ) => {
    setIncomingSync({
      action,
      time,
      senderName,
      timestamp: Date.now(),
    });
  };

  const handleBroadcastSync = (
    action: "play" | "pause" | "seek",
    time: number
  ) => {
    if (broadcastSyncRef.current) {
      broadcastSyncRef.current(action, time);
    }
  };

  if (loading && !currentVideo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0f0f0f] text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
          <span>Loading video...</span>
        </div>
      </div>
    );
  }

  if (!currentVideo && !loading) {
    return (
      <div className="p-8 text-gray-700 dark:text-gray-300 min-h-screen bg-white dark:bg-[#0f0f0f]">
        Video not found
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video & Details Column */}
          <div className="lg:col-span-2 space-y-4">
            {currentVideo && (
              <Videopplayer
                key={currentVideo._id}
                video={currentVideo}
                nextVideo={nextVideo}
                onNextVideo={handleNextVideo}
                isWatchPartyActive={isPartyOpen && Boolean(partyId)}
                onSyncAction={handleBroadcastSync}
                incomingSync={incomingSync}
                autoPlay={Boolean(autoplay === "true" || autoplay === "1")}
              />
            )}

            {currentVideo && (
              <VideoInfo
                video={currentVideo}
                onStartWatchParty={handleStartWatchParty}
                isPartyActive={isPartyOpen && Boolean(partyId)}
              />
            )}

            <Comments videoId={id as string} />
          </div>

          {/* Right Column (Watch Party Panel or Related Videos) */}
          <div className="space-y-4">
            {isPartyOpen && partyId ? (
              <div className="sticky top-4">
                <WatchPartyManager
                  partyId={partyId}
                  videoId={id as string}
                  user={user}
                  onClose={handleCloseParty}
                  onSyncReceived={handleSyncReceived}
                  onBroadcastSyncRef={broadcastSyncRef}
                />
              </div>
            ) : null}

            <RelatedVideos videos={allVideos} />
          </div>
        </div>
      </div>
    </div>
  );
}
