"use client";

import { useState } from "react";

export type DirectorySelectorResult =
  | { success: true; directory?: string }
  | { success: false; error: string };

type DirectorySelectorProps = {
  directories: string[];
  loading?: boolean;
  selecting?: boolean;
  disabled?: boolean;
  onAdd: (directory: string) => Promise<DirectorySelectorResult>;
  onRemove: (index: number) => void;
  onPick?: () => Promise<
    | { success: true; directory: string }
    | { success: false; error: string }
    | null
  >;
};

export function DirectorySelector({
  directories,
  loading = false,
  selecting = false,
  disabled = false,
  onAdd,
  onRemove,
  onPick,
}: DirectorySelectorProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetError = () => {
    if (error) {
      setError(null);
    }
  };

  const handleAdd = async (rawValue?: string) => {
    const value = rawValue ?? input;
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Please enter a directory path");
      return;
    }

    const result = await onAdd(trimmed);
    if (result.success) {
      setInput("");
      setError(null);
    } else {
      setError(result.error);
    }
  };

  const handlePick = async () => {
    if (!onPick || selecting || loading || disabled) {
      return;
    }

    try {
      const result = await onPick();
      if (!result) {
        return;
      }

      if (!result.success) {
        setError(result.error);
        return;
      }

      setInput(result.directory);
      await handleAdd(result.directory);
    } catch (pickError) {
      const message =
        pickError instanceof Error ? pickError.message : "Failed to open directory picker";
      setError(message);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-300 bg-white p-6 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="space-y-2">
        <label className="font-medium" htmlFor="directory-input">
          Model Paths Selector
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Directories are read locally and never uploaded. You can add multiple model_path entries.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
          <input
            id="directory-input"
            className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
            type="text"
            placeholder="e.g. C:\\path\\to\\model_path"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              resetError();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleAdd();
              }
            }}
            disabled={loading || selecting || disabled}
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            disabled={loading || selecting || disabled}
          >
            {loading ? "Validating..." : "Add"}
          </button>
          {onPick && (
            <button
              type="button"
              onClick={handlePick}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-300"
              disabled={loading || selecting || disabled}
            >
              {selecting ? "Opening directory picker..." : "Use directory picker"}
            </button>
          )}
        </div>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      {directories.length > 0 ? (
        <ul className="space-y-2">
          {directories.map((directory, index) => (
            <li
              key={`${directory}-${index}`}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              <div className="flex-1 overflow-hidden">
                <span className="truncate text-zinc-700 dark:text-zinc-200">
                  {directory}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetError();
                  onRemove(index);
                }}
                className="shrink-0 rounded-md border border-transparent px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/30"
                disabled={loading || selecting || disabled}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No directories added yet. Please enter or pick a model_path first.
        </p>
      )}

    </section>
  );
}
