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
    throw new Error(`无法读取 ${parsed.resultsPath}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(`results.json 格式错误：${parsed.resultsPath}`);
  }

  if (!data || typeof data !== "object") {
    throw new Error(`results.json 内容无效：${parsed.resultsPath}`);
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
    return NextResponse.json({ error: "请求体必须是 JSON 格式" }, { status: 400 });
  }

  if (!Array.isArray(body.directories)) {
    return NextResponse.json({ error: "directories 字段必须是数组" }, { status: 400 });
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
        error instanceof Error && error.message ? error.message : `无法读取目录：${directory}`;
      errors.push(message);
    }
  }

  return NextResponse.json({ rows, errors });
}
