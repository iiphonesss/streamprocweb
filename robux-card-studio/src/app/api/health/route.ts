import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { marketDbConfigured } from "@/lib/market-db";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, unknown> = {
    ok: true,
    cwd: process.cwd(),
    databaseUrl: process.env.DATABASE_URL ?? "(default file:./data/card-studio.db)",
    marketDbConfigured: marketDbConfigured(),
  };

  try {
    const count = await prisma.importedProduct.count();
    checks.sqlite = { ok: true, products: count };
  } catch (e) {
    checks.ok = false;
    checks.sqlite = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const generated = path.join(process.cwd(), "src/generated/prisma/client.ts");
  checks.prismaClientGenerated = fs.existsSync(generated);

  return NextResponse.json(checks, { status: checks.ok ? 200 : 500 });
}
