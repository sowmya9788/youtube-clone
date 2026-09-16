import ChannelHeader from "@/components/ChannelHeader";
import Channeltabs from "@/components/Channeltabs";
import ChannelVideos from "@/components/ChannelVideos";
import VideoUploader from "@/components/VideoUploader";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

export default function ChannelPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser() as any;
  const [channelVideos, setChannelVideos] = useState<any[]>([]);
  const [channelData, setChannelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isOwner = Boolean(user && id && String(user._id) === String(id));

  useEffect(() => {
    if (!id) return;

    if (isOwner) {
      setChannelData(user);
    } else {
      axiosInstance
        .get(`/user/channel/${id}`)
        .then((res) => setChannelData(res.data))
        .catch(() => setChannelData({ _id: id, channelname: id, name: id }));
    }

    const fetchChannelVideos = async () => {
      try {
        const res = await axiosInstance.get("/video/getall");
        const allVideos = res.data || [];
        const userVideos = allVideos.filter(
          (v: any) =>
            v.uploader === id ||
            (isOwner &&
              (v.uploader === user?._id || v.videochanel === user?.channelname))
        );
        setChannelVideos(userVideos);
      } catch (error) {
        console.error("Error fetching channel videos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelVideos();
  }, [id, user, isOwner]);

  const activeChannel =
    channelData || (isOwner ? user : { _id: id, channelname: "Channel" });

  return (
    <div className="flex-1 min-h-screen bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto">
        <ChannelHeader channel={activeChannel} user={user} />
        <Channeltabs />
        {isOwner && (
          <div className="px-4 md:px-6 pb-6">
            <VideoUploader channelId={id as string} channelName={user?.channelname} />
          </div>
        )}
        <div className="px-4 md:px-6 pb-12">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading channel videos...</div>
          ) : (
            <ChannelVideos videos={channelVideos} />
          )}
        </div>
      </div>
    </div>
  );
}
