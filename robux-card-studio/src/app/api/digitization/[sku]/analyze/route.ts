import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDigitization } from "@/lib/digitization";
import { analyzeCardStructure } from "@/lib/openai-studio";
import { fromPublicPath } from "@/lib/paths";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ sku: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { sku } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (!body.confirm) {
      return NextResponse.json(
        {
          error: "Confirmation required",
          willRun: {
            action: "analyze",
            usesOpenAI: true,
            note: "Анализ структуры карточки. Перед image edit маски нужно подтвердить вручную.",
          },
        },
        { status: 400 }
      );
    }

    const { product, dig, originalAbsolute } = await getOrCreateDigitization(sku);
    const result = await analyzeCardStructure({
      sku,
      name: product.name,
      faceValue: product.faceValue != null ? Number(product.faceValue) : null,
      faceCurrency: product.faceCurrency,
      imagePath: dig.originalPath
        ? fromPublicPath(dig.originalPath)
        : originalAbsolute,
      usedAiRequests: dig.aiRequestCount,
    });

    const updated = await prisma.digitizationResult.update({
      where: { id: dig.id },
      data: {
        textRegionsJson: result.textRegions,
        masksJson: result.masks,
        frameAnalysisJson: result.frame,
        analysisSummaryJson: result.summary,
        status: "analyzed",
        aiRequestCount: dig.aiRequestCount + (result.aiUsed ? 1 : 0),
      },
    });

    return NextResponse.json({
      ok: true,
      digitization: updated,
      summary: result.summary,
      frame: result.frame,
      textRegions: result.textRegions,
      masks: result.masks,
      aiUsed: result.aiUsed,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analyze failed" },
      { status: 500 }
    );
  }
}
