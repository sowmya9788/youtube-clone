import { useState } from "react";

const categories = [
  "All",
  "Music",
  "Gaming",
  "Podcasts",
  "Live",
  "Movies",
  "News",
  "Sports",
  "Technology",
  "Comedy",
  "Education",
  "Science",
  "Travel",
  "Cooking",
  "Fashion",
  "Recently uploaded",
  "Watched",
  "New to you",
];

export default function CategoryTabs() {
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <div className="w-full overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
      <div className="flex gap-2 min-w-max">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`whitespace-nowrap rounded-lg text-sm font-medium px-3 py-1.5 transition-all duration-150 cursor-pointer ${
              activeCategory === category
                ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                : "bg-gray-100 hover:bg-gray-200 dark:bg-[#272727] dark:hover:bg-[#383838] text-gray-800 dark:text-gray-200"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
