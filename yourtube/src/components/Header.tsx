"use client";

import {
  Bell,
  Menu,
  Mic,
  Search,
  User,
  VideoIcon,
  Sun,
  Moon,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import React, { useState } from "react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Channeldialogue from "./channeldialogue";
import { useRouter } from "next/router";
import { useUser } from "@/lib/AuthContext";

const Header = () => {
  const { user, logout, handlegooglesignin, theme, toggleTheme, toggleSidebar } =
    useUser() as any;
  const [searchQuery, setSearchQuery] = useState("");
  const [isdialogeopen, setisdialogeopen] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeypress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e as any);
    }
  };

  const handleVoiceSearch = () => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        router.push(`/search?q=${encodeURIComponent(transcript)}`);
      };
      recognition.start();
    } else {
      alert("Voice search is not supported in this browser.");
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-3 md:px-4 py-2 bg-white/95 dark:bg-[#0f0f0f]/95 backdrop-blur-xs border-b border-gray-200 dark:border-white/10 text-gray-900 dark:text-white transition-colors">
      {/* LEFT: Menu & YouTube Logo */}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={() => toggleSidebar()}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#272727] text-gray-900 dark:text-white transition-colors cursor-pointer"
          title="Guide / Menu"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/" className="flex items-center gap-1 group py-1">
          <div className="flex items-center justify-center bg-[#FF0000] text-white w-8 h-6 rounded-lg shadow-xs group-hover:scale-105 transition-transform">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-lg md:text-xl font-bold tracking-tighter text-gray-900 dark:text-white ml-0.5">
            YourTube
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold self-start -mt-0.5">
            IN
          </span>
        </Link>
      </div>

      {/* CENTER: YouTube Search Bar & Voice Search */}
      <div className="flex items-center justify-center flex-1 max-w-2xl mx-2 md:mx-4">
        <form
          onSubmit={handleSearch}
          className="flex items-center flex-1 max-w-xl group"
        >
          <div className="flex items-center flex-1 relative rounded-l-full border border-gray-300 dark:border-[#303030] bg-white dark:bg-[#121212] focus-within:border-blue-600 dark:focus-within:border-blue-500 focus-within:shadow-inner px-3 py-1.5 h-10 transition-colors">
            <Search className="w-4 h-4 text-gray-400 mr-2 hidden group-focus-within:block" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onKeyPress={handleKeypress}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="flex items-center justify-center h-10 px-5 rounded-r-full bg-[#f8f8f8] hover:bg-[#f0f0f0] dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-200 border border-l-0 border-gray-300 dark:border-[#303030] transition-colors cursor-pointer"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>

        {/* Voice Search Mic Button */}
        <button
          type="button"
          onClick={handleVoiceSearch}
          className="ml-2 flex items-center justify-center h-10 w-10 rounded-full bg-[#f2f2f2] hover:bg-[#e5e5e5] dark:bg-[#1f1f1f] dark:hover:bg-[#272727] text-gray-800 dark:text-gray-200 transition-colors cursor-pointer shrink-0"
          title="Search with your voice"
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>

      {/* RIGHT: Actions, Theme, & User Profile */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Quick Theme Switcher */}
        <button
          onClick={() => toggleTheme()}
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} theme`}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#272727] text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600" />
          )}
        </button>

        {user ? (
          <>
            {/* Create / Upload Video Button */}
            <button
              onClick={() => setisdialogeopen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#272727] hover:bg-gray-200 dark:hover:bg-[#383838] text-xs font-semibold text-gray-900 dark:text-white transition-colors cursor-pointer"
              title="Create"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">Create</span>
            </button>

            {/* Notifications Bell */}
            <button
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#272727] text-gray-700 dark:text-gray-200 transition-colors cursor-pointer relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
            </button>

            {/* User Profile Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative h-8 w-8 rounded-full overflow-hidden focus:outline-hidden ring-2 ring-transparent focus:ring-red-500 cursor-pointer">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image} />
                    <AvatarFallback className="bg-red-600 text-white font-bold text-xs">
                      {user.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 bg-white dark:bg-[#282828] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-2xl p-2 shadow-2xl z-50"
                align="end"
                forceMount
              >
                {/* User Header Summary in Dropdown */}
                <div className="flex items-center gap-3 p-2 border-b border-gray-100 dark:border-white/10 mb-1">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.image} />
                    <AvatarFallback className="bg-red-600 text-white font-bold">
                      {user.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {user.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </span>
                  </div>
                </div>

                {user?.channelname ? (
                  <DropdownMenuItem
                    asChild
                    className="hover:bg-gray-100 dark:hover:bg-[#383838] rounded-xl cursor-pointer"
                  >
                    <Link href={`/channel/${user?._id}`} className="py-2">
                      Your channel
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <div className="px-2 py-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold"
                      onClick={() => setisdialogeopen(true)}
                    >
                      Create Channel
                    </Button>
                  </div>
                )}
                <DropdownMenuItem
                  asChild
                  className="hover:bg-gray-100 dark:hover:bg-[#383838] rounded-xl cursor-pointer"
                >
                  <Link href="/history" className="py-2">
                    History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="hover:bg-gray-100 dark:hover:bg-[#383838] rounded-xl cursor-pointer"
                >
                  <Link href="/liked" className="py-2">
                    Liked videos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="hover:bg-gray-100 dark:hover:bg-[#383838] rounded-xl cursor-pointer"
                >
                  <Link href="/watch-later" className="py-2">
                    Watch later
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="hover:bg-gray-100 dark:hover:bg-[#383838] rounded-xl cursor-pointer"
                >
                  <Link href="/downloads" className="py-2">
                    Downloads
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="hover:bg-gray-100 dark:hover:bg-[#383838] rounded-xl cursor-pointer"
                >
                  <Link href="/subscription" className="py-2 text-amber-500 font-semibold">
                    Upgrade Subscription
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-gray-100 dark:bg-white/10" />

                <DropdownMenuItem
                  onClick={() => toggleTheme()}
                  className="hover:bg-gray-100 dark:hover:bg-[#383838] rounded-xl cursor-pointer flex items-center justify-between py-2"
                >
                  <span className="flex items-center gap-2 text-xs">
                    {theme === "dark" ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-gray-500" />
                    )}
                    Appearance: {theme === "dark" ? "Dark" : "Light"}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-gray-100 dark:bg-white/10" />

                <DropdownMenuItem
                  onClick={logout}
                  className="hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl cursor-pointer py-2 text-xs font-semibold"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <button
            onClick={handlegooglesignin}
            className="flex items-center gap-2 border border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            <User className="w-4 h-4" />
            <span>Sign in</span>
          </button>
        )}
      </div>

      <Channeldialogue
        isopen={isdialogeopen}
        onclose={() => setisdialogeopen(false)}
        mode="create"
      />
    </header>
  );
};

export default Header;
