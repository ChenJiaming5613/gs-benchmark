import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

type ResultsRow = {
  experiment: string;
  iteration: string;
  rawIteration: string;
  metrics: Record<string, number | null>;
};

type ResultsRequestBody = {
  directories?: unknown;
};

type ParsedDirectory = {
  original: string;
  resultsPath: string;
  experiment: string;
};

const NORMALIZE_ITERATION_REGEX = /(\d+)(?!.*\d)/;

async function calculateDirectorySize(directoryPath: string): Promise<number> {
  let total = 0;

  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        total += await calculateDirectorySize(fullPath);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          total += stats.size;
        } catch {
          continue;
        }
      }
    }
  } catch {
    // ignore directories that cannot be read
  }

  return total;
}

async function computePointCloudSizeMb(
  baseDirectory: string,
  iterationName: string,
  normalizedIteration: string
): Promise<number | null> {
  const candidates = new Set<string>();
  candidates.add(path.join(baseDirectory, "point_cloud", `iteration_${normalizedIteration}`));

  if (iterationName) {
    candidates.add(path.join(baseDirectory, "point_cloud", iterationName));
  }

  if (normalizedIteration && normalizedIteration !== iterationName) {
    candidates.add(path.join(baseDirectory, "point_cloud", normalizedIteration));
  }

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (!stats.isDirectory()) {
        continue;
      }

      const totalBytes = await calculateDirectorySize(candidate);
      return totalBytes / (1024 * 1024);
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeIterationName(name: string): string {
  const match = name.match(NORMALIZE_ITERATION_REGEX);
  if (match?.[1]) {
    return match[1];
  }

  return name;
}

async function parseDirectory(directory: string): Promise<ResultsRow[]> {
  const resolved = path.resolve(directory);
  const parsed: ParsedDirectory = {
    original: directory,
    resultsPath: path.join(resolved, "results.json"),
    experiment: resolved,
  };

  let content: string;
  try {
    content = await fs.readFile(parsed.resultsPath, "utf8");
  } catch {
    throw new Error(`Unable to read ${parsed.resultsPath}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(`Invalid results.json format: ${parsed.resultsPath}`);
  }

  if (!data || typeof data !== "object") {
    throw new Error(`results.json has invalid content: ${parsed.resultsPath}`);
  }

  const entries = Object.entries(data as Record<string, unknown>);
  const rows: ResultsRow[] = [];

  for (const [iterationName, metrics] of entries) {
    if (!metrics || typeof metrics !== "object") {
      continue;
    }

    const normalizedIteration = normalizeIterationName(iterationName);
    const metricsRecord: Record<string, number | null> = {};

    for (const [metricName, value] of Object.entries(metrics as Record<string, unknown>)) {
      if (typeof value === "number") {
        metricsRecord[metricName] = value;
      } else if (typeof value === "string" && value.trim()) {
        const parsedValue = Number(value);
        metricsRecord[metricName] = Number.isFinite(parsedValue) ? parsedValue : null;
      } else {
        metricsRecord[metricName] = null;
      }
    }

    const pointCloudSize = await computePointCloudSizeMb(
      parsed.resultsPath.replace(/results\.json$/, ""),
      iterationName,
      normalizedIteration
    );
    if (typeof pointCloudSize === "number" && Number.isFinite(pointCloudSize)) {
      metricsRecord.point_cloud_size_mb = pointCloudSize;
    } else {
      metricsRecord.point_cloud_size_mb = null;
    }

    rows.push({
      experiment: parsed.experiment,
      iteration: normalizedIteration,
      rawIteration: iterationName,
      metrics: metricsRecord,
    });
  }

  return rows;
}

export async function POST(request: Request) {
  let body: ResultsRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.directories)) {
    return NextResponse.json({ error: "The directories field must be an array." }, { status: 400 });
  }

  const directories = body.directories
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());

  if (!directories.length) {
    return NextResponse.json({ rows: [] });
  }

  const uniqueDirectories = Array.from(new Set(directories));
  const rows: ResultsRow[] = [];
  const errors: string[] = [];

  for (const directory of uniqueDirectories) {
    try {
      const next = await parseDirectory(directory);
      rows.push(...next);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : `Unable to read directory: ${directory}`;
      errors.push(message);
    }
  }

  return NextResponse.json({ rows, errors });
}
