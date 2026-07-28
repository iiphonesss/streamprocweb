import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cards = await prisma.generatedCard.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ cards });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load cards";
    console.error("[GET /api/cards]", message);
    return NextResponse.json(
      {
        error: message,
        cards: [],
        hint: "Run: npx prisma generate && npx prisma migrate dev",
      },
      { status: 500 }
    );
  }
}
