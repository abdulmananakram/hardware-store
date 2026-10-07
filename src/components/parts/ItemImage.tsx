"use client";

import { useApp } from "@/lib/store";
import { Item } from "@/lib/types";

interface ItemImageProps {
  item: Item;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  rounded?: string;
}

const SIZE_CLASSES: Record<string, { box: string; img: string; emoji: string }> = {
  sm: { box: "w-10 h-10 rounded-lg", img: "w-10 h-10 rounded-lg", emoji: "text-xl" },
  md: { box: "w-12 h-12 rounded-lg", img: "w-12 h-12 rounded-lg", emoji: "text-2xl" },
  lg: { box: "w-16 h-16 rounded-xl", img: "w-16 h-16 rounded-xl", emoji: "text-3xl" },
  xl: { box: "w-20 h-20 rounded-2xl", img: "w-20 h-20 rounded-2xl", emoji: "text-4xl" },
};

/**
 * Displays an item's image with the priority rule:
 * 1. Item's own photoUrl (if set)
 * 2. Category's default image (if set)
 * 3. Emoji icon fallback
 */
export function ItemImage({ item, size = "md", className = "", rounded }: ItemImageProps) {
  const imageUrl = useApp((s) => s.getItemImageUrl(item));
  const classes = SIZE_CLASSES[size];
  const boxClass = `${classes.box} ${className} bg-slate-50 flex items-center justify-center overflow-hidden shrink-0`;
  const imgClass = `${rounded || classes.img} ${className} object-cover shrink-0`;

  if (imageUrl) {
    // Use Next.js Image if available; here plain img for simplicity
    return (
       
      <img
        src={imageUrl}
        alt={item.name}
        className={imgClass}
        loading="lazy"
        onError={(e) => {
          // Hide broken image, show fallback emoji via parent
          (e.currentTarget as HTMLImageElement).style.display = "none";
          const fallback = (e.currentTarget.parentElement?.querySelector(".emoji-fallback") as HTMLElement);
          if (fallback) fallback.style.display = "flex";
        }}
      />
    );
  }

  return (
    <div className={boxClass}>
      <span className={classes.emoji}>{item.icon}</span>
    </div>
  );
}

/**
 * Wrapper that handles broken images by swapping to emoji fallback
 */
export function ItemImageWithFallback({ item, size = "md", className = "", rounded }: ItemImageProps) {
  const imageUrl = useApp((s) => s.getItemImageUrl(item));
  const classes = SIZE_CLASSES[size];
  const boxClass = `${classes.box} ${className} bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative`;

  if (!imageUrl) {
    return (
      <div className={boxClass}>
        <span className={classes.emoji}>{item.icon}</span>
      </div>
    );
  }

  return (
    <div className={boxClass}>
      { }
      <img
        src={imageUrl}
        alt={item.name}
        className={`absolute inset-0 w-full h-full ${rounded || ""} object-cover`}
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <span className={`emoji-fallback ${classes.emoji}`} style={{ display: "none" }}>
        {item.icon}
      </span>
    </div>
  );
}

/**
 * Variant for grid layouts where the box fills its parent (e.g. aspect-square grid cell).
 * Doesn't apply fixed width/height — uses parent's.
 */
export function ItemGridImage({ item, rounded = "rounded-lg" }: { item: Item; rounded?: string }) {
  const imageUrl = useApp((s) => s.getItemImageUrl(item));
  const boxClass = `${rounded} bg-slate-50 flex items-center justify-center overflow-hidden relative`;

  if (!imageUrl) {
    return (
      <div className={boxClass}>
        <span className="text-3xl">{item.icon}</span>
      </div>
    );
  }

  return (
    <div className={boxClass}>
      { }
      <img
        src={imageUrl}
        alt={item.name}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <span className="emoji-fallback text-3xl" style={{ display: "none" }}>
        {item.icon}
      </span>
    </div>
  );
}
