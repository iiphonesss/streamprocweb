import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { secureFetchImage } from "@/lib/secure-fetch";
import { DIRS, skuSafe, toPublicPath } from "@/lib/paths";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/card-studio";

function resolveImageUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = (process.env.MARKET_IMAGE_BASE_URL ?? "").replace(/\/$/, "");
  if (base && trimmed.startsWith("/")) return `${base}${trimmed}`;
  if (base) return `${base}/${trimmed.replace(/^\.\//, "")}`;
  return trimmed;
}

export async function ensureOriginal(
  sku: string,
  sourceUrl: string
): Promise<{ absolute: string | null; publicPath: string | null; error?: string }> {
  const safe = skuSafe(sku);
  const abs = path.join(DIRS.originals, `${safe}.webp`);
  try {
    await fs.access(abs);
    return { absolute: abs, publicPath: toPublicPath(abs) };
  } catch {
    // need download
  }

  const url = resolveImageUrl(sourceUrl);
  if (!url) {
    return { absolute: null, publicPath: null, error: "Empty images[0]" };
  }

  try {
    await fs.mkdir(DIRS.originals, { recursive: true });

    if (url.startsWith("file:")) {
      return {
        absolute: null,
        publicPath: null,
        error: "file: URLs are not allowed",
      };
    }

    // Local uploads under /api/media or public paths are not remote-fetched
    if (url.startsWith("/")) {
      return {
        absolute: null,
        publicPath: null,
        error: `Relative image URL needs MARKET_IMAGE_BASE_URL. Got: ${url}`,
      };
    }

    const { buffer } = await secureFetchImage(url);
    await sharp(buffer)
      .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "cover" })
      .webp({ quality: 92 })
      .toFile(abs);

    return { absolute: abs, publicPath: toPublicPath(abs) };
  } catch (e) {
    return {
      absolute: null,
      publicPath: null,
      error: e instanceof Error ? e.message : "Image download failed",
    };
  }
}

export async function getOrCreateDigitization(sku: string) {
  const product = await prisma.importedProduct.findUnique({ where: { sku } });
  if (!product) throw new Error(`Товар ${sku} не найден. Сначала импортируйте каталог.`);

  const images = (Array.isArray(product.images) ? product.images : []) as string[];
  const sourceUrl = images[0];
  if (!sourceUrl) {
    throw new Error(`У товара ${sku} нет images[0]. Добавьте URL изображения.`);
  }

  let dig = await prisma.digitizationResult.findFirst({
    where: { productSku: sku },
    orderBy: { updatedAt: "desc" },
  });

  const original = await ensureOriginal(sku, sourceUrl);

  if (!dig) {
    dig = await prisma.digitizationResult.create({
      data: {
        productSku: sku,
        sourceImageUrl: sourceUrl,
        originalPath: original.publicPath,
        status: original.publicPath ? "draft" : "image_pending",
      },
    });
  } else if (!dig.originalPath && original.publicPath) {
    dig = await prisma.digitizationResult.update({
      where: { id: dig.id },
      data: {
        originalPath: original.publicPath,
        status: dig.status === "image_pending" ? "draft" : dig.status,
      },
    });
  }

  return {
    product,
    dig,
    originalAbsolute: original.absolute,
    imageError: original.error,
  };
}
