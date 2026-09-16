import CategoryTabs from "@/components/category-tabs";
import Videogrid from "@/components/Videogrid";
import { Suspense } from "react";

export default function Home() {
  return (
    <div className="w-full px-4 md:px-6 pt-4 pb-12">
      <CategoryTabs />
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading videos...</div>}>
        <Videogrid />
      </Suspense>
    </div>
  );
}
