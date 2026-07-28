import { NextResponse } from "next/server";
import { getOrCreateDigitization } from "@/lib/digitization";
import { getAiMode } from "@/lib/openai-studio";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sku: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { sku } = await ctx.params;
    const { product, dig } = await getOrCreateDigitization(sku);
    return NextResponse.json({
      product: {
        ...product,
        faceValue: product.faceValue != null ? Number(product.faceValue) : null,
        images: product.images as string[],
      },
      digitization: dig,
      aiMode: getAiMode(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Not found" },
      { status: 404 }
    );
  }
}
