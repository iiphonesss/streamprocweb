import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { getOrCreateDigitization } from "@/lib/digitization";
import { getAiMode, removeFrame } from "@/lib/openai-studio";
import { DIRS, fromPublicPath, skuSafe, toPublicPath } from "@/lib/paths";
import type { MasksPayload } from "@/types/card-studio";

export const runtime = "nodejs";
export const maxDuration = 180;

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
            action: "remove-frame",
            usesOpenAI: getAiMode() === "real",
            note: "Удалит рамку по frameMask и восстановит фон. Создаст clean-without-frame.webp",
          },
        },
        { status: 400 }
      );
    }

    const { dig } = await getOrCreateDigitization(sku);
    const masks = dig.masksJson as MasksPayload | null;
    if (!masks?.frameMask?.length) {
      return NextResponse.json({ error: "No frame mask" }, { status: 400 });
    }

    const source = dig.cleanWithFramePath
      ? fromPublicPath(dig.cleanWithFramePath)
      : dig.originalPath
        ? fromPublicPath(dig.originalPath)
        : null;
    if (!source) {
      return NextResponse.json({ error: "No source image" }, { status: 400 });
    }

    const outAbs = path.join(
      DIRS.cleaned,
      `${skuSafe(sku)}-clean-without-frame.webp`
    );
    const result = await removeFrame({
      imagePath: source,
      masks,
      outPath: outAbs,
      usedAiRequests: dig.aiRequestCount,
    });

    const updated = await prisma.digitizationResult.update({
      where: { id: dig.id },
      data: {
        cleanWithoutFramePath: toPublicPath(result.path),
        status: "base_created",
        aiRequestCount: dig.aiRequestCount + (result.aiUsed ? 1 : 0),
      },
    });

    return NextResponse.json({
      ok: true,
      digitization: updated,
      cleanWithoutFramePath: updated.cleanWithoutFramePath,
      aiUsed: result.aiUsed,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Remove frame failed" },
      { status: 500 }
    );
  }
}
