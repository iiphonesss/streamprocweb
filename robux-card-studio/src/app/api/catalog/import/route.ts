import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DIRS } from "@/lib/paths";

export const runtime = "nodejs";

const ProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().nullish(),
  category: z.string().nullish(),
  faceValue: z.union([z.number(), z.string(), z.null()]).optional(),
  faceCurrency: z.string().nullish(),
  description: z.string().nullish(),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().optional().default(true),
}).passthrough();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const filePath =
      typeof body.path === "string"
        ? path.resolve(process.cwd(), body.path)
        : path.join(DIRS.data, "catalog.json");

    if (!filePath.startsWith(process.cwd())) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.products)
        ? parsed.products
        : null;

    if (!list) {
      return NextResponse.json(
        { error: "catalog.json must be an array or { products: [] }" },
        { status: 400 }
      );
    }

    let imported = 0;
    let updated = 0;

    for (const item of list) {
      const p = ProductSchema.parse(item);
      const faceValue =
        p.faceValue === null || p.faceValue === undefined || p.faceValue === ""
          ? null
          : Number(p.faceValue);

      const existing = await prisma.importedProduct.findUnique({
        where: { sku: p.sku },
      });

      const data = {
        name: p.name,
        brand: p.brand ?? null,
        category: p.category ?? null,
        faceValue: faceValue != null && !Number.isNaN(faceValue) ? faceValue : null,
        faceCurrency: p.faceCurrency ?? null,
        description: p.description ?? null,
        images: p.images,
        isActive: p.isActive ?? true,
        rawData: JSON.parse(JSON.stringify(p)) as object,
      };

      if (existing) {
        await prisma.importedProduct.update({
          where: { sku: p.sku },
          data,
        });
        updated += 1;
      } else {
        await prisma.importedProduct.create({
          data: { sku: p.sku, ...data },
        });
        imported += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      imported,
      updated,
      total: list.length,
      source: path.relative(process.cwd(), filePath),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
