"use client";

import {
  Home,
  Compass,
  PlaySquare,
  Clock,
  ThumbsUp,
  History,
  User,
  Download,
  Crown,
  Flame,
  Music2,
  Gamepad2,
  Trophy,
  Lightbulb,
  Shirt,
  Settings,
  HelpCircle,
  Film,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/router";
import Channeldialogue from "./channeldialogue";
import { useUser } from "@/lib/AuthContext";
import { Avatar, AvatarFallback } from "./ui/avatar";

const Sidebar = () => {
  const { user, isSidebarCollapsed, subscriptions } = useUser() as any;
  const router = useRouter();
  const [isdialogeopen, setisdialogeopen] = useState(false);

  // If on watch page, hide or compact sidebar to give max room to theater video
  const isWatchPage = router.pathname.startsWith("/watch");

  const isActive = (path: string) => router.pathname === path;

  // 1. MINI / COMPACT SIDEBAR (72px)
  if (isSidebarCollapsed || isWatchPage) {
    return (
      <aside className="w-18 shrink-0 bg-white dark:bg-[#0f0f0f] border-r border-gray-200 dark:border-white/10 min-h-[calc(100vh-56px)] py-2 text-gray-900 dark:text-gray-200 transition-all flex flex-col items-center select-none">
        <nav className="flex flex-col items-center gap-1 w-full px-1">
          <Link
            href="/"
            className={`flex flex-col items-center justify-center w-full py-3.5 rounded-xl text-[10px] font-medium transition-colors ${
              isActive("/")
                ? "bg-gray-100 dark:bg-[#272727] text-red-600 dark:text-white font-bold"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
            }`}
          >
            <Home className="w-5 h-5 mb-1" />
            <span>Home</span>
          </Link>

          <Link
            href="/explore"
            className={`flex flex-col items-center justify-center w-full py-3.5 rounded-xl text-[10px] font-medium transition-colors ${
              isActive("/explore")
                ? "bg-gray-100 dark:bg-[#272727] text-red-600 dark:text-white font-bold"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
            }`}
          >
            <Compass className="w-5 h-5 mb-1" />
            <span>Explore</span>
          </Link>

          <Link
            href="/subscription"
            className={`flex flex-col items-center justify-center w-full py-3.5 rounded-xl text-[10px] font-medium transition-colors ${
              isActive("/subscription")
                ? "bg-gray-100 dark:bg-[#272727] text-red-600 dark:text-white font-bold"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
            }`}
          >
            <PlaySquare className="w-5 h-5 mb-1" />
            <span>Plans</span>
          </Link>

          {user && (
            <>
              <Link
                href="/history"
                className={`flex flex-col items-center justify-center w-full py-3.5 rounded-xl text-[10px] font-medium transition-colors ${
                  isActive("/history")
                    ? "bg-gray-100 dark:bg-[#272727] text-red-600 dark:text-white font-bold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
                }`}
              >
                <History className="w-5 h-5 mb-1" />
                <span>History</span>
              </Link>

              <Link
                href="/downloads"
                className={`flex flex-col items-center justify-center w-full py-3.5 rounded-xl text-[10px] font-medium transition-colors ${
                  isActive("/downloads")
                    ? "bg-gray-100 dark:bg-[#272727] text-red-600 dark:text-white font-bold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
                }`}
              >
                <Download className="w-5 h-5 mb-1" />
                <span>Downloads</span>
              </Link>
            </>
          )}
        </nav>
      </aside>
    );
  }

  // 2. EXPANDED FULL YOUTUBE SIDEBAR (240px)
  return (
    <aside className="w-60 shrink-0 bg-white dark:bg-[#0f0f0f] border-r border-gray-200 dark:border-white/10 min-h-[calc(100vh-56px)] p-3 text-gray-900 dark:text-gray-200 transition-all select-none overflow-y-auto max-h-[calc(100vh-56px)] scrollbar-thin">
      <nav className="space-y-1">
        {/* MAIN SECTION */}
        <Link
          href="/"
          className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isActive("/")
              ? "bg-gray-100 dark:bg-[#272727] text-gray-900 dark:text-white font-bold"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </Link>

        <Link
          href="/explore"
          className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isActive("/explore")
              ? "bg-gray-100 dark:bg-[#272727] text-gray-900 dark:text-white font-bold"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
          }`}
        >
          <Compass className="w-5 h-5" />
          <span>Explore</span>
        </Link>

        <Link
          href="/subscription"
          className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isActive("/subscription")
              ? "bg-gray-100 dark:bg-[#272727] text-gray-900 dark:text-white font-bold"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
          }`}
        >
          <PlaySquare className="w-5 h-5" />
          <span>Subscriptions</span>
        </Link>

        {/* DIVIDER */}
        <div className="border-t border-gray-200 dark:border-white/10 my-2 pt-2" />

        {/* "YOU" SECTION */}
        <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          You
        </div>

        {user ? (
          <>
            <Link
              href="/history"
              className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive("/history")
                  ? "bg-gray-100 dark:bg-[#272727] text-gray-900 dark:text-white font-bold"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
              }`}
            >
              <History className="w-5 h-5" />
              <span>History</span>
            </Link>

            <Link
              href="/liked"
              className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive("/liked")
                  ? "bg-gray-100 dark:bg-[#272727] text-gray-900 dark:text-white font-bold"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
              }`}
            >
              <ThumbsUp className="w-5 h-5" />
              <span>Liked videos</span>
            </Link>

            <Link
              href="/watch-later"
              className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive("/watch-later")
                  ? "bg-gray-100 dark:bg-[#272727] text-gray-900 dark:text-white font-bold"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>Watch later</span>
            </Link>

            <Link
              href="/downloads"
              className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive("/downloads")
                  ? "bg-gray-100 dark:bg-[#272727] text-gray-900 dark:text-white font-bold"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
              }`}
            >
              <Download className="w-5 h-5" />
              <span>Downloads</span>
            </Link>

            {user?.channelname ? (
              <Link
                href={`/channel/${user?._id}`}
                className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive(`/channel/${user?._id}`)
                    ? "bg-gray-100 dark:bg-[#272727] text-gray-900 dark:text-white font-bold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
                }`}
              >
                <User className="w-5 h-5" />
                <span>Your channel</span>
              </Link>
            ) : (
              <div className="px-2 py-1.5">
                <button
                  onClick={() => setisdialogeopen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#272727] dark:hover:bg-[#383838] text-xs font-semibold text-gray-900 dark:text-white transition-colors cursor-pointer"
                >
                  Create Channel
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
            <p className="mb-3 leading-relaxed">
              Sign in to like videos, comment, and subscribe.
            </p>
          </div>
        )}

        {/* DIVIDER */}
        <div className="border-t border-gray-200 dark:border-white/10 my-2 pt-2" />

        {/* SUBSCRIPTIONS SECTION */}
        {user && (
          <>
            <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>Subscriptions</span>
              {subscriptions && subscriptions.length > 0 && (
                <span className="text-[11px] font-semibold text-gray-400">
                  {subscriptions.length}
                </span>
              )}
            </div>

            {subscriptions && subscriptions.length > 0 ? (
              <div className="space-y-0.5 max-h-56 overflow-y-auto scrollbar-thin">
                {subscriptions.map((sub: any) => {
                  const channelId = sub.channel?._id || sub.channel;
                  const channelName =
                    sub.channel?.channelname || sub.channel?.name || sub.channelName;
                  const avatarImg = sub.channel?.image;
                  const linkHref = channelId ? `/channel/${channelId}` : `/search?q=${encodeURIComponent(channelName)}`;

                  return (
                    <Link
                      key={sub._id || channelName}
                      href={linkHref}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#272727] text-gray-700 dark:text-gray-300 transition-colors group"
                      title={channelName}
                    >
                      <Avatar className="w-6 h-6 shrink-0 border border-gray-200 dark:border-gray-700">
                        {avatarImg ? (
                          <img
                            src={avatarImg}
                            alt={channelName}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <AvatarFallback className="text-[10px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                            {channelName?.[0]?.toUpperCase() || "C"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="truncate text-xs font-medium group-hover:text-gray-900 dark:group-hover:text-white">
                        {channelName}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                No subscribed channels yet
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-white/10 my-2 pt-2" />
          </>
        )}

        {/* SUBSCRIPTIONS / UPGRADE SECTION */}
        <Link
          href="/subscription"
          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>Premium Plans</span>
          </div>
          <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">
            VIP
          </span>
        </Link>

        {/* DIVIDER */}
        <div className="border-t border-gray-200 dark:border-white/10 my-3 pt-2" />

        {/* YOUTUBE FOOTER LINKS */}
        <div className="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 space-y-3">
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            <span className="hover:underline cursor-pointer">About</span>
            <span className="hover:underline cursor-pointer">Press</span>
            <span className="hover:underline cursor-pointer">Copyright</span>
            <span className="hover:underline cursor-pointer">Contact us</span>
            <span className="hover:underline cursor-pointer">Creators</span>
            <span className="hover:underline cursor-pointer">Advertise</span>
            <span className="hover:underline cursor-pointer">Developers</span>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-gray-400 dark:text-gray-500">
            <span className="hover:underline cursor-pointer">Terms</span>
            <span className="hover:underline cursor-pointer">Privacy</span>
            <span className="hover:underline cursor-pointer">Policy & Safety</span>
            <span className="hover:underline cursor-pointer">How YouTube works</span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 pt-1">
            © 2026 YourTube LLC
          </p>
        </div>
      </nav>

      <Channeldialogue
        isopen={isdialogeopen}
        onclose={() => setisdialogeopen(false)}
        mode="create"
      />
    </aside>
  );
};

export default Sidebar;