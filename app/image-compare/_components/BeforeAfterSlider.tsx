"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { type UploadedImage } from "./types";

export type BeforeAfterSliderProps = {
  processed: UploadedImage | null;
  original: UploadedImage | null;
  initialPosition?: number;
};

export function BeforeAfterSlider({
  processed,
  original,
  initialPosition = 50,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const aspect = useMemo(() => {
    if (processed) return processed.width / processed.height;
    if (original) return original.width / original.height;
    return undefined;
  }, [processed, original]);

  const updatePosition = useCallback((clientX: number, element: HTMLDivElement | null) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      element.setPointerCapture(event.pointerId);
      setDragging(true);
      updatePosition(event.clientX, element);
    },
    [updatePosition]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      updatePosition(event.clientX, event.currentTarget);
    },
    [dragging, updatePosition]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }, []);

  const handleHandleDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const element = containerRef.current;
      if (!element) return;
      element.setPointerCapture(event.pointerId);
      setDragging(true);
      updatePosition(event.clientX, element);
    },
    [updatePosition]
  );

  const handleHandleUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const element = containerRef.current;
    if (element) {
      element.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }, []);

  const containerStyle = aspect ? { aspectRatio: `${aspect}` } : undefined;

  if (!processed || !original) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Before–After Slider</h2>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="h-2 w-56 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900 dark:bg-zinc-700 dark:accent-zinc-100"
          aria-label="Adjust comparison"
        />
      </div>

      <div
        className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-zinc-200 bg-black shadow-sm dark:border-zinc-800"
        style={containerStyle}
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setDragging(false)}
        role="presentation"
      >
        <Image
          src={original.src}
          alt="Original image"
          fill
          sizes="(min-width: 768px) 70vw, 100vw"
          className="object-contain"
          unoptimized
        />

        <div
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <Image
            src={processed.src}
            alt="Processed image"
            fill
            sizes="(min-width: 768px) 70vw, 100vw"
            className="object-contain"
            unoptimized
          />
        </div>

        <div
          className="absolute top-0 h-full border-l border-white transition-[border-color] dark:border-black"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        >
          <button
            type="button"
            className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black bg-white shadow-lg outline-none transition focus-visible:ring-2 focus-visible:ring-black/60 dark:border-white dark:bg-black dark:focus-visible:ring-white/70"
            onPointerDown={handleHandleDown}
            onPointerUp={handleHandleUp}
            aria-label="Drag to adjust comparison"
          />
        </div>
      </div>
    </section>
  );
}


