import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { getOrCreateDigitization } from "@/lib/digitization";
import { extractFrameAsset } from "@/lib/openai-studio";
import { DIRS, fromPublicPath, skuSafe, toPublicPath } from "@/lib/paths";
import type { FrameAnalysis, MasksPayload } from "@/types/card-studio";

export const runtime = "nodejs";

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
            action: "extract-frame",
            usesOpenAI: false,
            note: "Локальное извлечение frame.png по маске. При низком качестве — needs_review.",
          },
        },
        { status: 400 }
      );
    }

    const { dig } = await getOrCreateDigitization(sku);
    const masks = dig.masksJson as MasksPayload | null;
    const frame = dig.frameAnalysisJson as FrameAnalysis | null;
    if (!masks?.frameMask?.length || !frame) {
      return NextResponse.json(
        { error: "Frame analysis/mask missing" },
        { status: 400 }
      );
    }

    const source = dig.originalPath
      ? fromPublicPath(dig.originalPath)
      : null;
    if (!source) {
      return NextResponse.json({ error: "No original" }, { status: 400 });
    }

    const outAbs = path.join(DIRS.frames, `${skuSafe(sku)}-frame.png`);
    const extracted = await extractFrameAsset({
      imagePath: source,
      frame,
      frameMask: masks.frameMask,
      outPath: outAbs,
    });

    const updated = await prisma.digitizationResult.update({
      where: { id: dig.id },
      data: {
        frameAssetPath:
          extracted.status === "ok" && extracted.path
            ? toPublicPath(extracted.path)
            : null,
        frameExtractionStatus: extracted.status,
      },
    });

    return NextResponse.json({
      ok: true,
      digitization: updated,
      frameExtractionStatus: extracted.status,
      frameAssetPath: updated.frameAssetPath,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extract failed" },
      { status: 500 }
    );
  }
}
