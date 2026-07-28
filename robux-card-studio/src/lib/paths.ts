import path from "path";

export const PROJECT_ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd());

export const DIRS = {
  data: path.join(PROJECT_ROOT, "data"),
  uploads: path.join(PROJECT_ROOT, "uploads"),
  originals: path.join(PROJECT_ROOT, "originals"),
  masks: path.join(PROJECT_ROOT, "masks"),
  cleaned: path.join(PROJECT_ROOT, "cleaned"),
  frames: path.join(PROJECT_ROOT, "frames"),
  templates: path.join(PROJECT_ROOT, "templates"),
  results: path.join(PROJECT_ROOT, "results"),
  exports: path.join(PROJECT_ROOT, "exports"),
} as const;

export function toPublicPath(absolutePath: string): string {
  const rel = path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
  return `/api/media/${rel}`;
}

export function fromPublicPath(publicPath: string): string {
  const cleaned = publicPath
    .replace(/^\/api\/media\//, "")
    .replace(/^\/media\//, "")
    .replace(/^\/+/, "");
  const absolute = path.resolve(PROJECT_ROOT, cleaned);
  if (!absolute.startsWith(PROJECT_ROOT)) {
    throw new Error("Path traversal blocked");
  }
  return absolute;
}

export function skuSafe(sku: string): string {
  return sku.replace(/[^a-zA-Z0-9_-]/g, "_");
}
