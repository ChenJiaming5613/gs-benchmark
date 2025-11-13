"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { type UploadedImage } from "./types";

export type UploadPanelProps = {
  processedLabel?: string;
  originalLabel?: string;
  onImagesChange?: (processed: UploadedImage | null, original: UploadedImage | null) => void;
  initialProcessed?: UploadedImage | null;
  initialOriginal?: UploadedImage | null;
};

export function UploadPanel({
  processedLabel = "Processed Image",
  originalLabel = "Original Image",
  onImagesChange,
  initialProcessed = null,
  initialOriginal = null,
}: UploadPanelProps) {
  const [processed, setProcessed] = useState<UploadedImage | null>(initialProcessed);
  const [original, setOriginal] = useState<UploadedImage | null>(initialOriginal);
  const [error, setError] = useState<string | null>(null);

  // sync internal state with external initial values (e.g., restored from cache)
  // do not call onImagesChange here to avoid loops; page.tsx already owns the source of truth
  if (initialProcessed !== processed) {
    // lightweight sync on render; values are small and changes rare
    // eslint-disable-next-line react-hooks/rules-of-hooks
    setProcessed(initialProcessed);
  }
  if (initialOriginal !== original) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    setOriginal(initialOriginal);
  }

  const readFile = useCallback((file: File): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : null;
        if (!result) {
          reject(new Error("Unable to read file"));
          return;
        }

        const img = new window.Image();
        img.onload = () => {
          resolve({
            src: result,
            width: img.naturalWidth,
            height: img.naturalHeight,
            name: file.name,
          });
        };
        img.onerror = () => reject(new Error("Invalid image"));
        img.src = result;
      };
      reader.onerror = () => reject(new Error("Read error"));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleChange =
    (slot: "processed" | "original") =>
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      setError(null);
      try {
        const uploaded = await readFile(file);
        if (slot === "processed") {
          setProcessed(uploaded);
          onImagesChange?.(uploaded, original);
        } else {
          setOriginal(uploaded);
          onImagesChange?.(processed, uploaded);
        }
      } catch (err) {
        setError("Unable to load image");
      }
    };

  const handleClear = useCallback(() => {
    setProcessed(null);
    setOriginal(null);
    setError(null);
    onImagesChange?.(null, null);
  }, [onImagesChange]);

  return (
    <section className="grid gap-8 md:grid-cols-2">
      <Uploader label={processedLabel} image={processed} onChange={handleChange("processed")} />
      <Uploader label={originalLabel} image={original} onChange={handleChange("original")} />
      <div className="md:col-span-2 -mt-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200 dark:focus:ring-zinc-400 dark:focus:ring-offset-black"
          >
            Clear
          </button>
          {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        </div>
      </div>
    </section>
  );
}

type UploaderProps = {
  label: string;
  image: UploadedImage | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

function Uploader({ label, image, onChange }: UploaderProps) {
  return (
    <label className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <span className="text-base font-medium">{label}</span>
      <input
        type="file"
        accept="image/*"
        onChange={onChange}
        className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-100 dark:file:text-black dark:hover:file:bg-zinc-200"
      />
      <div className="relative flex h-80 w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
        {image ? (
          <Image
            src={image.src}
            alt={`${label} Preview`}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-contain"
            unoptimized
          />
        ) : (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">No image</span>
        )}
      </div>
    </label>
  );
}


