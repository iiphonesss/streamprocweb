import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProductStatus } from "@/lib/status";
import { STATUS_LABELS } from "@/types/card-studio";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const brand = (searchParams.get("brand") ?? "").trim();

  const products = await prisma.importedProduct.findMany({
    orderBy: { sku: "asc" },
  });

  const filtered = products.filter((p) => {
    if (brand && (p.brand ?? "") !== brand) return false;
    if (!q) return true;
    return (
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    );
  });

  const withStatus = await Promise.all(
    filtered.map(async (p) => {
      const status = await getProductStatus(p.sku);
      const images = p.images as string[];
      return {
        ...p,
        faceValue: p.faceValue != null ? Number(p.faceValue) : null,
        images,
        status,
        statusLabel: STATUS_LABELS[status],
        primaryImage: images[0] ?? null,
      };
    })
  );

  const brands = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean) as string[])
  ).sort();

  return NextResponse.json({ products: withStatus, brands });
}
