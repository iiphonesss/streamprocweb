import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { secureFetchImage } from "@/lib/secure-fetch";
import { DIRS, skuSafe, toPublicPath } from "@/lib/paths";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/card-studio";

export async function ensureOriginal(
  sku: string,
  sourceUrl: string
): Promise<{ absolute: string; publicPath: string }> {
  const safe = skuSafe(sku);
  const abs = path.join(DIRS.originals, `${safe}.webp`);
  try {
    await fs.access(abs);
    return { absolute: abs, publicPath: toPublicPath(abs) };
  } catch {
    // download
  }

  await fs.mkdir(DIRS.originals, { recursive: true });

  if (sourceUrl.startsWith("/") || sourceUrl.startsWith("file:")) {
    throw new Error("Local/file URLs are not allowed for remote fetch");
  }

  const { buffer } = await secureFetchImage(sourceUrl);
  await sharp(buffer)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "cover" })
    .webp({ quality: 92 })
    .toFile(abs);

  return { absolute: abs, publicPath: toPublicPath(abs) };
}

export async function getOrCreateDigitization(sku: string) {
  const product = await prisma.importedProduct.findUnique({ where: { sku } });
  if (!product) throw new Error("Product not found");
  const images = product.images as string[];
  const sourceUrl = images[0];
  if (!sourceUrl) throw new Error("Product has no images[0]");

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
        status: "draft",
      },
    });
  } else if (!dig.originalPath) {
    dig = await prisma.digitizationResult.update({
      where: { id: dig.id },
      data: { originalPath: original.publicPath },
    });
  }

  return { product, dig, originalAbsolute: original.absolute };
}
