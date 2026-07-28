import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProductStatus } from "@/lib/status";
import { STATUS_LABELS } from "@/types/card-studio";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sku: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { sku } = await ctx.params;
  const product = await prisma.importedProduct.findUnique({ where: { sku } });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const status = await getProductStatus(sku);
  const images = product.images as string[];
  return NextResponse.json({
    product: {
      ...product,
      faceValue: product.faceValue != null ? Number(product.faceValue) : null,
      images,
      status,
      statusLabel: STATUS_LABELS[status],
      primaryImage: images[0] ?? null,
    },
  });
}
