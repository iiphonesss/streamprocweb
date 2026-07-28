import { NextResponse } from "next/server";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fromPublicPath, DIRS, toPublicPath, skuSafe } from "@/lib/paths";
import { renderCard } from "@/lib/render-card";
import type {
  AddedObject,
  EditableTextRegion,
  TextStyle,
} from "@/types/card-studio";

export const runtime = "nodejs";

const SeriesSchema = z.object({
  templateId: z.string(),
  denominations: z.array(z.union([z.number(), z.string()])).min(1),
  currency: z.string().optional(),
  title: z.string().optional(),
  country: z.string().optional(),
  footer: z.string().optional(),
  productSku: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = SeriesSchema.parse(await req.json());
    const template = await prisma.cardTemplate.findUnique({
      where: { id: body.templateId },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // No OpenAI — only bindings + render
    const textRegions = template.textRegionsJson as EditableTextRegion[];
    const textStyles = template.textStylesJson as Record<string, TextStyle>;
    const addedObjects = (template.addedObjectsJson as AddedObject[]) ?? [];
    const baseAbs = fromPublicPath(template.baseImagePath);
    const frameAbs = template.frameAssetPath
      ? fromPublicPath(template.frameAssetPath)
      : null;

    const created = [];
    for (const den of body.denominations) {
      const value = String(den);
      const bindings: Record<string, string> = {
        denomination: value,
        currency: body.currency ?? "",
        title: body.title ?? "",
        country: body.country ?? "",
        footer: body.footer ?? "",
      };

      const fileName = `${skuSafe(template.sourceSku)}-${value}-${Date.now()}.webp`;
      const outAbs = path.join(DIRS.exports, fileName);
      await renderCard({
        baseImagePath: baseAbs,
        frameAssetPath: frameAbs,
        frameEnabled: template.frameEnabled,
        textRegions,
        textStyles,
        addedObjects,
        bindings,
        outPath: outAbs,
      });

      const card = await prisma.generatedCard.create({
        data: {
          templateId: template.id,
          productSku: body.productSku ?? template.sourceSku,
          dataJson: { bindings, denomination: value },
          outputPath: toPublicPath(outAbs),
          status: "draft",
        },
      });
      created.push(card);
    }

    return NextResponse.json({
      ok: true,
      count: created.length,
      cards: created,
      note: "Series created without OpenAI",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Series failed" },
      { status: 400 }
    );
  }
}
