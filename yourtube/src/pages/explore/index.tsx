import React, { Suspense } from "react";
import Videogrid from "@/components/Videogrid";
import CategoryTabs from "@/components/category-tabs";

export default function ExplorePage() {
  return (
    <div className="w-full px-4 md:px-6 pb-12">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Explore</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Discover videos from all creators</p>
      </div>
      <CategoryTabs />
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading videos...</div>}>
        <Videogrid />
      </Suspense>
    </div>
  );
}
