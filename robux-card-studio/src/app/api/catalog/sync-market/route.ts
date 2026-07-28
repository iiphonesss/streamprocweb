import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchMarketProductsReadOnly, marketDbConfigured } from "@/lib/market-db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    configured: marketDbConfigured(),
    mode: "read-only",
    note: marketDbConfigured()
      ? "MARKET_DATABASE_URL задан. POST /api/catalog/sync-market для синхронизации."
      : "Добавьте MARKET_DATABASE_URL в .env.local (read-only Postgres). Production не изменяется.",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.confirm) {
      return NextResponse.json(
        {
          error: "Confirmation required",
          willRun: {
            action: "sync-market-readonly",
            writesToMarketDb: false,
            note: "Только SELECT из market DB → upsert в локальный SQLite Card Studio. Production/market DB не изменяется.",
          },
        },
        { status: 400 }
      );
    }

    if (!marketDbConfigured()) {
      return NextResponse.json(
        {
          error: "MARKET_DATABASE_URL не задан",
          hint: "Вставьте connection string в robux-card-studio/.env.local и перезапустите dev-сервер.",
        },
        { status: 400 }
      );
    }

    const { products, source } = await fetchMarketProductsReadOnly();
    let imported = 0;
    let updated = 0;

    for (const p of products) {
      const existing = await prisma.importedProduct.findUnique({
        where: { sku: p.sku },
      });
      const data = {
        name: p.name,
        brand: p.brand,
        category: p.category,
        faceValue: p.faceValue,
        faceCurrency: p.faceCurrency,
        description: p.description,
        images: p.images,
        isActive: p.isActive,
        rawData: JSON.parse(JSON.stringify(p.rawData)) as object,
      };
      if (existing) {
        await prisma.importedProduct.update({ where: { sku: p.sku }, data });
        updated += 1;
      } else {
        await prisma.importedProduct.create({ data: { sku: p.sku, ...data } });
        imported += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      source,
      imported,
      updated,
      total: products.length,
      writesToMarketDb: false,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Market sync failed" },
      { status: 500 }
    );
  }
}
