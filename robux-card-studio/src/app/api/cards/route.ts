import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const cards = await prisma.generatedCard.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ cards });
}
