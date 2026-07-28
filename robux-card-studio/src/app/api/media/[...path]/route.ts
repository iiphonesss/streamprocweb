import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PROJECT_ROOT } from "@/lib/paths";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "originals",
  "cleaned",
  "frames",
  "masks",
  "exports",
  "results",
  "uploads",
  "templates",
  "data",
]);

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
};

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const parts = (await ctx.params).path;
  if (!parts?.length || !ALLOWED.has(parts[0])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const absolute = path.resolve(PROJECT_ROOT, ...parts);
  if (!absolute.startsWith(PROJECT_ROOT)) {
    return NextResponse.json({ error: "Path traversal" }, { status: 403 });
  }

  try {
    const buf = await fs.readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
