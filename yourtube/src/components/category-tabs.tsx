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
  "Entertainment",
  "Recently uploaded",
  "Watched",
  "New to you",
];

interface CategoryTabsProps {
  onCategoryChange?: (category: string) => void;
}

export default function CategoryTabs({ onCategoryChange }: CategoryTabsProps) {
  const [activeCategory, setActiveCategory] = useState("All");

  const handleSelect = (category: string) => {
    setActiveCategory(category);
    onCategoryChange?.(category);
  };

  return (
    <div className="w-full overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
      <div className="flex gap-2 min-w-max">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleSelect(category)}
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
