import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const template = await prisma.cardTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

const PatchSchema = z.object({
  name: z.string().optional(),
  frameEnabled: z.boolean().optional(),
  textRegions: z.array(z.any()).optional(),
  textStyles: z.record(z.string(), z.any()).optional(),
  addedObjects: z.array(z.any()).optional(),
  status: z.string().optional(),
  baseMode: z.string().optional(),
  baseImagePath: z.string().optional(),
  frameAssetPath: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = PatchSchema.parse(await req.json());
    const template = await prisma.cardTemplate.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.frameEnabled != null ? { frameEnabled: body.frameEnabled } : {}),
        ...(body.textRegions ? { textRegionsJson: body.textRegions } : {}),
        ...(body.textStyles ? { textStylesJson: body.textStyles } : {}),
        ...(body.addedObjects ? { addedObjectsJson: body.addedObjects } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.baseMode ? { baseMode: body.baseMode } : {}),
        ...(body.baseImagePath ? { baseImagePath: body.baseImagePath } : {}),
        ...(body.frameAssetPath !== undefined
          ? { frameAssetPath: body.frameAssetPath }
          : {}),
      },
    });
    return NextResponse.json({ ok: true, template });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}
