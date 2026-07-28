import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { getOrCreateDigitization } from "@/lib/digitization";
import { createCleanWithFrame, getAiMode } from "@/lib/openai-studio";
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
            action: "clean-background",
            usesOpenAI: getAiMode() === "real",
            note: "Удалит текст в подтверждённых масках, сохранит объекты и рамку. Создаст clean-with-frame.webp",
          },
        },
        { status: 400 }
      );
    }

    const { dig, originalAbsolute } = await getOrCreateDigitization(sku);
    if (dig.status !== "masks_confirmed" && !body.force) {
      return NextResponse.json(
        { error: "Confirm masks before clean-background" },
        { status: 400 }
      );
    }

    const masks = dig.masksJson as MasksPayload | null;
    if (!masks) {
      return NextResponse.json({ error: "No masks" }, { status: 400 });
    }

    const outAbs = path.join(DIRS.cleaned, `${skuSafe(sku)}-clean-with-frame.webp`);
    const result = await createCleanWithFrame({
      imagePath: dig.originalPath
        ? fromPublicPath(dig.originalPath)
        : originalAbsolute,
      masks,
      outPath: outAbs,
      usedAiRequests: dig.aiRequestCount,
    });

    const updated = await prisma.digitizationResult.update({
      where: { id: dig.id },
      data: {
        cleanWithFramePath: toPublicPath(result.path),
        status: "base_created",
        aiRequestCount: dig.aiRequestCount + (result.aiUsed ? 1 : 0),
      },
    });

    return NextResponse.json({
      ok: true,
      digitization: updated,
      cleanWithFramePath: updated.cleanWithFramePath,
      aiUsed: result.aiUsed,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Clean failed" },
      { status: 500 }
    );
  }
}
