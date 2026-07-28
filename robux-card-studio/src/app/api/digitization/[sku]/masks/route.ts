import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDigitization } from "@/lib/digitization";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sku: string }> };

const RegionSchema = z.object({
  id: z.string(),
  role: z.enum(["text", "variable", "frame", "preserve"]),
  variableRole: z
    .enum(["title", "denomination", "currency", "country", "footer", "other"])
    .optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string().optional(),
});

const MasksSchema = z.object({
  textMask: z.array(RegionSchema),
  variableMask: z.array(RegionSchema),
  frameMask: z.array(RegionSchema),
  preserveMask: z.array(RegionSchema),
  confirmed: z.boolean().optional(),
  textRegions: z.array(z.any()).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { sku } = await ctx.params;
    const body = MasksSchema.parse(await req.json());
    const { dig } = await getOrCreateDigitization(sku);

    const masks = {
      textMask: body.textMask,
      variableMask: body.variableMask,
      frameMask: body.frameMask,
      preserveMask: body.preserveMask,
    };

    const updated = await prisma.digitizationResult.update({
      where: { id: dig.id },
      data: {
        masksJson: masks,
        ...(body.textRegions ? { textRegionsJson: body.textRegions } : {}),
        status: body.confirmed ? "masks_confirmed" : dig.status,
      },
    });

    return NextResponse.json({ ok: true, digitization: updated, masks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Masks update failed" },
      { status: 400 }
    );
  }
}
