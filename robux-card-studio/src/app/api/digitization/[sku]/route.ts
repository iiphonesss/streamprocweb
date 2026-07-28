import { NextResponse } from "next/server";
import { getOrCreateDigitization } from "@/lib/digitization";
import { getAiMode } from "@/lib/openai-studio";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sku: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { sku } = await ctx.params;
    const { product, dig, imageError } = await getOrCreateDigitization(sku);
    const images = (Array.isArray(product.images) ? product.images : []) as string[];
    return NextResponse.json({
      product: {
        ...product,
        faceValue: product.faceValue != null ? Number(product.faceValue) : null,
        images,
      },
      digitization: dig,
      aiMode: getAiMode(),
      imageError: imageError ?? null,
      warning: imageError
        ? `Карточка открыта, но оригинал не скачан: ${imageError}. Можно продолжить анализ после исправления URL images[0].`
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not found";
    console.error("[GET /api/digitization]", message);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
