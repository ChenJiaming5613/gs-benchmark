"use client";

import { useMemo } from "react";

import { ImageCompare, type ImageCompareItem } from "@/components/ImageCompare";
import type { ImageCardProps } from "@/components/ImageCard";

export type ImageGalleryDirectory = {
  directory: string;
  expName: string;
  iteration?: string;
  label?: string;
  images: {
    name: string;
    image: ImageCardProps["image"];
    metrics?: ImageCardProps["metrics"];
  }[];
};

export type ImageGalleryProps = {
  directories: ImageGalleryDirectory[];
};

export function ImageGallery({ directories }: ImageGalleryProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, ImageCompareItem[]>();

    directories.forEach((entry) => {
      entry.images.forEach(({ name, image, metrics }) => {
        const list = map.get(name) ?? [];
        list.push({
          name,
          directory: entry.directory,
          iteration: entry.iteration,
          label: entry.expName,
          image,
          metrics,
        });
        map.set(name, list);
      });
    });

    const orderMap = new Map<string, number>();
    directories.forEach((entry, index) => {
      orderMap.set(`${entry.directory}__${entry.iteration ?? "__"}`, index);
    });

    for (const list of map.values()) {
      list.sort((a, b) => {
        const keyA = `${a.directory}__${a.iteration ?? "__"}`;
        const keyB = `${b.directory}__${b.iteration ?? "__"}`;
        const orderA = orderMap.get(keyA) ?? Number.MAX_SAFE_INTEGER;
        const orderB = orderMap.get(keyB) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        const labelA = a.label ?? a.directory;
        const labelB = b.label ?? b.directory;
        return labelA.localeCompare(labelB, "en", { numeric: true });
      });
    }

    return map;
  }, [directories]);

  if (grouped.size === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        Select directories above to compare. Ensure each directory contains images with matching names.
      </p>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div>
        <p className="font-medium">Image Comparisons</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Compare identically named images across the selected directories and iterations above.
        </p>
      </div>
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([imageName, items]) => (
          <ImageCompare key={imageName} imageName={imageName} items={items} />
        ))}
      </div>
    </section>
  );
}
