import HistoryContent from "@/components/HistoryContent";
import React, { Suspense } from "react";

export default function HistoryPage() {
  return (
    <main className="flex-1 p-4 md:p-6">
      <div className="max-w-5xl">
        <h1 className="text-xl md:text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Watch history
        </h1>
        <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading history...</div>}>
          <HistoryContent />
        </Suspense>
      </div>
    </main>
  );
}
