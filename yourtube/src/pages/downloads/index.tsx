import React from "react";

import DownloadsContent from "@/components/DownloadsContent";

const DownloadsPage =
  () => {
    return (
      <div className="flex-1 min-h-screen bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-white">
        <DownloadsContent />
      </div>
    );
  };

export default DownloadsPage;