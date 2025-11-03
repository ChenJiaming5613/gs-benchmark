import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
  ".tiff",
  ".heic",
  ".heif",
]);

const encodePath = (filePath: string) =>
  Buffer.from(filePath, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const isImageFile = (filePath: string) =>
  IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const walkDirectory = async (targetDir: string) => {
  const results: { name: string; fullPath: string }[] = [];
  const queue: string[] = [targetDir];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    let dirEntries;
    try {
      dirEntries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      // Skip directories we cannot access
      continue;
    }

    for (const entry of dirEntries) {
      const entryPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (entry.isFile() && isImageFile(entry.name)) {
        results.push({ name: entry.name, fullPath: entryPath });
      }
    }
  }

  return results;
};

type ImagePayload = {
  name: string;
  relativePath: string;
  absolutePath: string;
  token: string;
};

type ListRequestBody = {
  directory?: string;
};

type IterationSummary = {
  name: string;
  renders: ImagePayload[];
  metrics?: Record<string, Record<string, number>>;
  overview?: Record<string, number>;
};

export async function POST(request: Request) {
  let body: ListRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "请求体必须是 JSON 格式" },
      { status: 400 }
    );
  }

  const directory = body.directory?.trim();

  if (!directory) {
    return NextResponse.json(
      { error: "请提供要扫描的目录路径" },
      { status: 400 }
    );
  }

  const resolvedDirectory = path.resolve(directory);

  let stats;
  try {
    stats = await fs.stat(resolvedDirectory);
  } catch (error) {
    return NextResponse.json(
      { error: "无法访问指定目录，请确认路径是否正确" },
      { status: 400 }
    );
  }

  if (!stats.isDirectory()) {
    return NextResponse.json(
      { error: "指定路径不是一个目录" },
      { status: 400 }
    );
  }

  const records = await walkDirectory(resolvedDirectory);

  const images: ImagePayload[] = records.map(({ name, fullPath }) => ({
    name,
    relativePath: path.relative(resolvedDirectory, fullPath) || name,
    absolutePath: fullPath,
    token: encodePath(fullPath),
  }));

  const perViewPath = path.join(resolvedDirectory, "per_view.json");
  let perView: Record<string, Record<string, Record<string, number>>> | null =
    null;

  const resultsPath = path.join(resolvedDirectory, "results.json");
  let results: Record<string, Record<string, number>> | null = null;

  try {
    const raw = await fs.readFile(perViewPath, "utf8");
    perView = JSON.parse(raw);
  } catch {
    perView = null;
  }

  try {
    const raw = await fs.readFile(resultsPath, "utf8");
    results = JSON.parse(raw);
  } catch {
    results = null;
  }

  const iterations: IterationSummary[] = [];

  const testDir = path.join(resolvedDirectory, "test");
  try {
    const entries = await fs.readdir(testDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const iterationName = entry.name;

      if (!iterationName.startsWith("ours_")) {
        continue;
      }

      const rendersDir = path.join(testDir, iterationName, "renders");

      let renderFiles: ImagePayload[] = [];

      try {
        const files = await fs.readdir(rendersDir, { withFileTypes: true });

        renderFiles = files
          .filter((file) => file.isFile() && isImageFile(file.name))
          .map((file) => {
            const fullPath = path.join(rendersDir, file.name);
            return {
              name: file.name,
              relativePath: path.relative(resolvedDirectory, fullPath) || file.name,
              absolutePath: fullPath,
              token: encodePath(fullPath),
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
      } catch {
        renderFiles = [];
      }

      iterations.push({
        name: iterationName,
        renders: renderFiles,
        metrics: perView?.[iterationName] ?? undefined,
        overview: results?.[iterationName] ?? undefined,
      });
    }
  } catch {
    // ignore if test directory missing
  }

  iterations.sort((a, b) => b.name.localeCompare(a.name, "en", { numeric: true }));

  return NextResponse.json({
    images,
    iterations,
    baseDirectory: resolvedDirectory,
  });
}
