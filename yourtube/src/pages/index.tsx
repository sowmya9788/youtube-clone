import CategoryTabs from "@/components/category-tabs";
import Videogrid from "@/components/Videogrid";
import { Suspense, useState } from "react";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <div className="w-full px-4 md:px-6 pt-4 pb-12">
      <CategoryTabs onCategoryChange={setActiveCategory} />
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading videos...</div>}>
        <Videogrid category={activeCategory} />
      </Suspense>
    </div>
  );
}
