import SearchResult from "@/components/SearchResult";
import { useRouter } from "next/router";
import React, { Suspense } from "react";

const index = () => {
  const router = useRouter();
  const { q } = router.query;
  const searchQuery = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="max-w-6xl">
        {searchQuery && (
          <div className="mb-4">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
              Search results for "{searchQuery}"
            </h1>
          </div>
        )}
        <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading search results...</div>}>
          <SearchResult query={searchQuery} />
        </Suspense>
      </div>
    </div>
  );
};

export default index;
