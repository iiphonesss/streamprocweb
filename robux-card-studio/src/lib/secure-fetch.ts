import dns from "dns/promises";
import { isIP } from "net";
import sharp from "sharp";

const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("127.") || ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  return false;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Blocked host");
  }
  if (
    url.hostname.includes("metadata") ||
    url.pathname.includes("latest/meta-data")
  ) {
    throw new Error("Metadata endpoints are blocked");
  }

  const host = url.hostname;
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private IP blocked");
  } else {
    const records = await dns.lookup(host, { all: true });
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        throw new Error("Resolved private IP blocked");
      }
    }
  }
  return url;
}

export async function secureFetchImage(
  rawUrl: string
): Promise<{ buffer: Buffer; mime: string }> {
  let current = await assertSafeUrl(rawUrl);
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: { Accept: "image/*,*/*;q=0.8" },
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        redirects += 1;
        if (redirects > MAX_REDIRECTS) throw new Error("Too many redirects");
        const loc = res.headers.get("location");
        if (!loc) throw new Error("Redirect without location");
        current = await assertSafeUrl(new URL(loc, current).toString());
        continue;
      }

      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > MAX_BYTES) throw new Error("File too large");

      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_BYTES) throw new Error("File too large");
      const buffer = Buffer.from(ab);

      const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      if (mime && !mime.startsWith("image/")) {
        throw new Error(`Invalid MIME: ${mime}`);
      }

      const meta = await sharp(buffer).metadata();
      if (!meta.format) throw new Error("Sharp could not parse image");

      return { buffer, mime: mime || `image/${meta.format}` };
    } finally {
      clearTimeout(timer);
    }
  }
}
