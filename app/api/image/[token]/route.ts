import { NextResponse } from "next/server";
import { createReadStream, promises as fs } from "fs";
import path from "path";

const decodeToken = (token: string) =>
  Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  );

const guessContentType = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".tiff":
      return "image/tiff";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: "Image token is required." }, { status: 400 });
  }

  let filePath: string;

  try {
    filePath = decodeToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  const response = new NextResponse(stream as unknown as ReadableStream);

  response.headers.set("Content-Type", guessContentType(filePath));
  response.headers.set("Cache-Control", "no-store");

  return response;
}
