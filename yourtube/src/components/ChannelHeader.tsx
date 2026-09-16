import React, { useState } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { useUser } from "@/lib/AuthContext";
import { toast } from "sonner";

const ChannelHeader = ({ channel, user }: any) => {
  const { isSubscribed: checkSubscribed, toggleSubscribe } = useUser() as any;
  const [subscribing, setSubscribing] = useState(false);

  const channelId = channel?._id;
  const channelName = channel?.channelname || channel?.name;
  const isSubscribed = checkSubscribed(channelId, channelName);

  const handleSubscribe = async () => {
    if (!user) {
      toast.error("Please sign in to subscribe to channels");
      return;
    }
    setSubscribing(true);
    try {
      await toggleSubscribe({
        channelId,
        channelName,
      });
    } finally {
      setSubscribing(false);
    }
  };

  const isOwner = user && channel && user?._id === channel?._id;

  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative h-32 md:h-48 lg:h-64 bg-gradient-to-r from-red-600 via-purple-700 to-indigo-800 overflow-hidden"></div>

      {/* Channel Info */}
      <div className="px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Avatar className="w-20 h-20 md:w-32 md:h-32 border-2 border-white dark:border-gray-800 shadow">
            <AvatarFallback className="text-2xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              {channel?.channelname?.[0] || "C"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white">
              {channel?.channelname || "Channel"}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>
                @
                {channel?.channelname?.toLowerCase().replace(/\s+/g, "") ||
                  "channel"}
              </span>
            </div>
            {channel?.description && (
              <p className="text-sm text-gray-700 dark:text-gray-300 max-w-2xl">
                {channel?.description}
              </p>
            )}
          </div>

          <div>
            {isOwner ? (
              <Button
                variant="outline"
                className="rounded-full font-medium text-sm px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#272727] dark:hover:bg-[#383838] dark:text-white border-0"
              >
                Customize channel
              </Button>
            ) : (
              <Button
                onClick={handleSubscribe}
                disabled={subscribing}
                className={`rounded-full font-medium text-sm px-5 py-2 transition-all cursor-pointer ${
                  isSubscribed
                    ? "bg-gray-200 hover:bg-gray-300 dark:bg-[#272727] dark:hover:bg-[#383838] text-gray-800 dark:text-gray-200"
                    : "bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black"
                } ${subscribing ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {subscribing ? "Updating..." : isSubscribed ? "Subscribed" : "Subscribe"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelHeader;
