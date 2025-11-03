"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DirectorySelector,
  type DirectorySelectorResult,
} from "@/components/DirectorySelector";
import { type ImageMetric } from "@/components/ImageCard";
import {
  MetricsOverview,
  type MetricsOverviewRow,
} from "@/components/MetricsOverview";
import { ImageGallery, type ImageGalleryDirectory } from "@/components/ImageGallery";

type ImageEntry = {
  token: string;
  name: string;
  relativePath: string;
  absolutePath: string;
};

type MetricMap = Record<string, Record<string, number>>;

type IterationSummary = {
  name: string;
  renders: ImageEntry[];
  metrics?: MetricMap;
  overview?: Record<string, number>;
};

type DirectoryData = {
  images: ImageEntry[];
  iterations: IterationSummary[];
};

export default function EvalPage() {
  const [directories, setDirectories] = useState<string[]>([]);
  const [activeDirectory, setActiveDirectory] = useState<string | null>(null);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [iterations, setIterations] = useState<IterationSummary[]>([]);
  const [, setSelectedIterationName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedMetricRowKeys, setSelectedMetricRowKeys] = useState<string[]>([]);
  const [selectedMetricRowData, setSelectedMetricRowData] = useState<MetricsOverviewRow[]>([]);
  const [directoryData, setDirectoryData] = useState<Record<string, DirectoryData>>({});

  const fetchImages = useCallback(
    async (targetDirectory: string): Promise<DirectorySelectorResult> => {
      const trimmed = targetDirectory.trim();

      if (!trimmed) {
        setImages([]);
        setError("Please select a valid directory");
        return { success: false, error: "Please select a valid directory" };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/list-images", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ directory: trimmed }),
        });

        const payload = await response.json();

        if (!response.ok) {
          setImages([]);
          setIterations([]);
          setSelectedIterationName(null);
          const message = payload?.error || "Unable to read directory";
          setError(message);
          return { success: false, error: message };
        }

        const nextImages = Array.isArray(payload.images) ? payload.images : [];
        const nextIterations: IterationSummary[] = Array.isArray(payload.iterations)
          ? payload.iterations
          : [];

        setImages(nextImages);
        setIterations(nextIterations);
        const normalizedDirectory =
          typeof payload.baseDirectory === "string" && payload.baseDirectory.trim()
            ? payload.baseDirectory.trim()
            : trimmed;

        setActiveDirectory(normalizedDirectory);
        setDirectoryData((previous) => ({
          ...previous,
          [normalizedDirectory]: {
            images: nextImages,
            iterations: nextIterations,
          },
        }));

        if (nextIterations.length > 0) {
          setSelectedIterationName((previous) => {
            if (previous && nextIterations.some((item) => item.name === previous)) {
              return previous;
            }

            return nextIterations[0]?.name ?? null;
          });
        } else {
          setSelectedIterationName(null);
        }

        return { success: true, directory: normalizedDirectory };
      } catch (fetchError) {
        console.error(fetchError);
        setImages([]);
        setIterations([]);
        setSelectedIterationName(null);
        const message = "Cannot connect to the server. Please ensure the local service is running.";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    }, []);

  const handleAddDirectory = useCallback(
    async (value: string): Promise<DirectorySelectorResult> => {
      const result = await fetchImages(value);

      if (!result.success) {
        return result;
      }

      const normalized = (result.directory ?? value).trim();
      if (!normalized) {
        return { success: false, error: "Invalid directory" };
      }

      let alreadyExists = false;

      setDirectories((prev) => {
        if (prev.includes(normalized)) {
          alreadyExists = true;
          return prev;
        }

        if (prev.length === 0) {
          return [normalized];
        }

        return [...prev, normalized];
      });

      if (alreadyExists) {
        return { success: false, error: `Directory already exists: ${normalized}` };
      }

      return { success: true, directory: normalized };
    },
    [fetchImages]
  );

  const handleRemoveDirectory = useCallback(
    (index: number) => {
      setDirectories((prev) => {
        if (index < 0 || index >= prev.length) {
          return prev;
        }

        const removedDirectory = prev[index];
        const next = prev.filter((_, currentIndex) => currentIndex !== index);

        setDirectoryData((prevData) => {
          if (!removedDirectory) {
            return prevData;
          }
          const nextData = { ...prevData };
          delete nextData[removedDirectory];
          return nextData;
        });

        if (removedDirectory === activeDirectory) {
          const fallback = next[0] ?? null;
          if (fallback) {
            void fetchImages(fallback);
          } else {
            setActiveDirectory(null);
            setImages([]);
            setIterations([]);
            setSelectedIterationName(null);
            setError(null);
          }
        }

        return next;
      });
    },
    [activeDirectory, fetchImages]
  );

  const handlePickDirectory = useCallback(
    async (): Promise<
      | { success: true; directory: string }
      | { success: false; error: string }
      | null
    > => {
      setSelecting(true);
      setError(null);

      try {
        const response = await fetch("/api/select-directory", {
          method: "POST",
        });

        const payload = await response.json();

        if (!response.ok) {
          const message = payload?.error || "Unable to open directory picker";
          setError(message);
          return { success: false, error: message };
        }

        const chosenDirectory =
          typeof payload.directory === "string" ? payload.directory.trim() : "";

        if (!chosenDirectory) {
          const message = "No directory selected";
          setError(message);
          return { success: false, error: message };
        }

        return { success: true, directory: chosenDirectory };
      } catch (pickError) {
        console.error(pickError);
        const message = "Unable to open directory picker. Please ensure the server allows UI access.";
        setError(message);
        return { success: false, error: message };
      } finally {
        setSelecting(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!directories.length && activeDirectory) {
      setActiveDirectory(null);
      setImages([]);
      setIterations([]);
      setSelectedIterationName(null);
      setDirectoryData({});
    }
  }, [directories, activeDirectory]);

  const galleryDirectories = useMemo<ImageGalleryDirectory[]>(() => {
    if (!selectedMetricRowData.length) {
      return [];
    }

    const results: ImageGalleryDirectory[] = [];

    for (const row of selectedMetricRowData) {
      const directoryEntry = directoryData[row.experiment];
      if (!directoryEntry) {
        continue;
      }

      if (row.rawIteration === "__gt__") {
        const maxIterationName = directoryEntry.iterations[0]?.name;
        if (!maxIterationName) {
          continue;
        }

        const normalizedPrefix = `test/${maxIterationName}/gt/`;
        const gtImages = directoryEntry.images.filter((image) => {
          const relative = image.relativePath.replace(/\\/g, "/");
          return relative.startsWith(normalizedPrefix);
        });

        if (!gtImages.length) {
          continue;
        }

        const imagesWithMetrics = gtImages
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
          .map((image) => ({
            name: image.name,
            image: { token: image.token, absolutePath: image.absolutePath },
            metrics: undefined,
          }));

        results.push({
          directory: row.experiment,
          expName: row.experimentName ?? row.experiment,
          iteration: "gt",
          label: `${row.experimentName ?? row.experiment} · gt`,
          images: imagesWithMetrics,
        });

        continue;
      }

      const iteration = directoryEntry.iterations.find(
        (item) => item.name === row.rawIteration || item.name === row.iteration
      );

      if (!iteration) {
        continue;
      }

      const displayIterationName =
        (row.iteration && row.iteration !== "-")
          ? row.iteration
          : iteration.name.replace(/^ours_/, "") || iteration.name;

      const imagesWithMetrics = iteration.renders.map((render) => {
        const metrics: ImageMetric[] = iteration.metrics
          ? Object.entries(iteration.metrics).reduce<ImageMetric[]>((acc, [metricName, values]) => {
              const value = values?.[render.name];
              if (typeof value === "number") {
                acc.push({ name: metricName, value });
              }
              return acc;
            }, [])
          : [];

        return {
          name: render.name,
          image: { token: render.token, absolutePath: render.absolutePath },
          metrics: metrics.length > 0 ? metrics : undefined,
        };
      });

      results.push({
        directory: row.experiment,
        expName: row.experimentName ?? row.experiment,
        iteration: displayIterationName,
        label: `${row.experimentName ?? row.experiment} · ${displayIterationName}`,
        images: imagesWithMetrics,
      });
    }

    return results;
  }, [directoryData, selectedMetricRowData]);

  return (
    <main className="min-h-screen bg-zinc-50 py-12 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold">Evaluation Browser</h1>
        </header>

        <DirectorySelector
          directories={directories}
          loading={loading}
          selecting={selecting}
          onAdd={handleAddDirectory}
          onRemove={handleRemoveDirectory}
          onPick={handlePickDirectory}
        />

        <MetricsOverview
          directories={directories}
          selectedRowKeys={selectedMetricRowKeys}
          onSelectedRowKeysChange={(keys, rows) => {
            setSelectedMetricRowKeys(keys);
            if (Array.isArray(rows)) {
              setSelectedMetricRowData(rows);
            }
          }}
        />

        {galleryDirectories.length > 0 && <ImageGallery directories={galleryDirectories} />}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

      </div>
    </main>
  );
}
