"use client";

import { useState } from "react";
import { UploadPanel } from "./_components/UploadPanel";
import { BeforeAfterSlider } from "./_components/BeforeAfterSlider";
import { type UploadedImage } from "./_components/types";

export default function ImageComparePage() {
  const [processedImage, setProcessedImage] = useState<UploadedImage | null>(null);
  const [originalImage, setOriginalImage] = useState<UploadedImage | null>(null);

  return (
    <main className="min-h-screen bg-zinc-50 py-12 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Image Compare</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload a processed image and its original version to inspect the differences.
          </p>
        </header>

        <UploadPanel
          processedLabel="Processed Image"
          originalLabel="Original Image"
          onImagesChange={(processed, original) => {
            setProcessedImage(processed);
            setOriginalImage(original);
          }}
        />

        {processedImage && originalImage && (
          <BeforeAfterSlider processed={processedImage} original={originalImage} />
        )}
      </div>
    </main>
  );
}

