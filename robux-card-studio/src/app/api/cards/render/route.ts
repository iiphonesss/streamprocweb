import { NextResponse } from "next/server";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DIRS, fromPublicPath, toPublicPath, skuSafe } from "@/lib/paths";
import { renderCard } from "@/lib/render-card";
import type {
  AddedObject,
  EditableTextRegion,
  TextStyle,
} from "@/types/card-studio";

export const runtime = "nodejs";

const RenderSchema = z.object({
  templateId: z.string(),
  bindings: z.record(z.string(), z.string()),
  productSku: z.string().optional(),
  save: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  try {
    const body = RenderSchema.parse(await req.json());
    const template = await prisma.cardTemplate.findUnique({
      where: { id: body.templateId },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const outAbs = path.join(
      DIRS.results,
      `${skuSafe(template.sourceSku)}-preview-${Date.now()}.webp`
    );

    await renderCard({
      baseImagePath: fromPublicPath(template.baseImagePath),
      frameAssetPath: template.frameAssetPath
        ? fromPublicPath(template.frameAssetPath)
        : null,
      frameEnabled: template.frameEnabled,
      textRegions: template.textRegionsJson as EditableTextRegion[],
      textStyles: template.textStylesJson as Record<string, TextStyle>,
      addedObjects: (template.addedObjectsJson as AddedObject[]) ?? [],
      bindings: body.bindings,
      outPath: outAbs,
    });

    let card = null;
    if (body.save) {
      card = await prisma.generatedCard.create({
        data: {
          templateId: template.id,
          productSku: body.productSku ?? template.sourceSku,
          dataJson: { bindings: body.bindings },
          outputPath: toPublicPath(outAbs),
          status: "draft",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      outputPath: toPublicPath(outAbs),
      card,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Render failed" },
      { status: 400 }
    );
  }
}
