import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDigitization } from "@/lib/digitization";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sku: string }> };

const Schema = z.object({
  baseMode: z.enum(["original", "clean_with_frame", "clean_without_frame"]),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { sku } = await ctx.params;
    const { baseMode } = Schema.parse(await req.json());
    const { dig } = await getOrCreateDigitization(sku);

    if (baseMode === "clean_with_frame" && !dig.cleanWithFramePath) {
      return NextResponse.json(
        { error: "clean-with-frame not ready" },
        { status: 400 }
      );
    }
    if (baseMode === "clean_without_frame" && !dig.cleanWithoutFramePath) {
      return NextResponse.json(
        { error: "clean-without-frame not ready" },
        { status: 400 }
      );
    }

    const updated = await prisma.digitizationResult.update({
      where: { id: dig.id },
      data: { selectedBaseMode: baseMode },
    });

    return NextResponse.json({ ok: true, digitization: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Select base failed" },
      { status: 400 }
    );
  }
}
