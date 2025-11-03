export type EvalCachePayload = {
  directories: string[];
  experimentNames?: Record<string, string>;
  selectedRowKeys?: string[];
  savedAt?: string;
};

const STORAGE_KEY = "gs-benchmark/eval-cache";

const isBrowser = () => typeof window !== "undefined";

export const loadEvalCache = (): EvalCachePayload | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const directories = Array.isArray(parsed.directories) ? parsed.directories : [];
    const experimentNames = parsed.experimentNames && typeof parsed.experimentNames === "object"
      ? (parsed.experimentNames as Record<string, string>)
      : undefined;
    const selectedRowKeys = Array.isArray(parsed.selectedRowKeys) ? parsed.selectedRowKeys : undefined;
    const savedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : undefined;

    return { directories, experimentNames, selectedRowKeys, savedAt };
  } catch (error) {
    console.error("Failed to read eval cache", error);
    return null;
  }
};

export const saveEvalCache = (payload: EvalCachePayload) => {
  if (!isBrowser()) {
    return false;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...payload, savedAt: new Date().toISOString() })
    );
    return true;
  } catch (error) {
    console.error("Failed to write eval cache", error);
    return false;
  }
};
