import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/card-studio";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1),
  sourceSku: z.string().min(1),
  digitizationId: z.string().optional(),
  baseMode: z.enum(["original", "clean_with_frame", "clean_without_frame"]),
  baseImagePath: z.string().min(1),
  frameAssetPath: z.string().optional().nullable(),
  frameEnabled: z.boolean().default(true),
  textRegions: z.array(z.any()),
  textStyles: z.record(z.string(), z.any()),
  addedObjects: z.array(z.any()).optional(),
  canvas: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

export async function GET() {
  const templates = await prisma.cardTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  try {
    const body = CreateSchema.parse(await req.json());
    const template = await prisma.cardTemplate.create({
      data: {
        name: body.name,
        sourceSku: body.sourceSku,
        digitizationId: body.digitizationId ?? null,
        baseMode: body.baseMode,
        baseImagePath: body.baseImagePath,
        frameAssetPath: body.frameAssetPath ?? null,
        frameEnabled: body.frameEnabled,
        canvasJson: body.canvas ?? {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
        },
        textRegionsJson: body.textRegions,
        textStylesJson: body.textStyles,
        addedObjectsJson: body.addedObjects ?? [],
        status: "ready",
      },
    });
    return NextResponse.json({ ok: true, template });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 }
    );
  }
}
