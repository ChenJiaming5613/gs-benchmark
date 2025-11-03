"use client";

import { ImageCard, type ImageCardProps } from "@/components/ImageCard";

export type ImageCompareItem = {
  name: string;
  directory: string;
  iteration?: string;
  label?: string;
  image: ImageCardProps["image"];
  metrics?: ImageCardProps["metrics"];
};

export type ImageCompareProps = {
  imageName: string;
  items: ImageCompareItem[];
};

export function ImageCompare({ imageName, items }: ImageCompareProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
          {imageName}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {items.length} comparisons
        </span>
      </header>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((item) => {
          const key = `${item.directory}::${item.iteration ?? "default"}::${item.image.absolutePath}`;
          const displayLabel = `${item.label ?? item.directory}${item.iteration ? ` · ${item.iteration}` : ""}`;
          return (
            <div
              key={key}
              className="flex min-w-[240px] max-w-xs flex-col gap-2"
            >
              <div
                className="truncate text-[11px] text-zinc-500 dark:text-zinc-400"
                title={item.image.absolutePath}
              >
                {displayLabel}
              </div>
              <ImageCard image={item.image} metrics={item.metrics} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
