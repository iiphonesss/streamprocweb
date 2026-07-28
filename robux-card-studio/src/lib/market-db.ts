import { Client } from "pg";
import { z } from "zod";

/**
 * Read-only sync from external Robux Market DB.
 * NEVER runs INSERT/UPDATE/DELETE against the market DB.
 */

const RowSchema = z.object({
  sku: z.string(),
  name: z.string(),
  brand: z.string().nullish(),
  category: z.string().nullish(),
  faceValue: z.union([z.number(), z.string(), z.null()]).optional(),
  faceCurrency: z.string().nullish(),
  description: z.string().nullish(),
  images: z.unknown().optional(),
  isActive: z.union([z.boolean(), z.number(), z.string()]).optional(),
});

export type MarketProductRow = z.infer<typeof RowSchema>;

const DEFAULT_QUERIES = [
  `SELECT sku, name, brand, category, "faceValue" AS "faceValue", "faceCurrency" AS "faceCurrency", description, images, "isActive" AS "isActive" FROM "Product" WHERE COALESCE("isActive", true) = true ORDER BY sku ASC LIMIT 5000`,
  `SELECT sku, name, brand, category, face_value AS "faceValue", face_currency AS "faceCurrency", description, images, is_active AS "isActive" FROM products WHERE COALESCE(is_active, true) = true ORDER BY sku ASC LIMIT 5000`,
  `SELECT sku, name, brand, category, "faceValue" AS "faceValue", "faceCurrency" AS "faceCurrency", description, images, "isActive" AS "isActive" FROM "ImportedProduct" ORDER BY sku ASC LIMIT 5000`,
];

function assertSelectOnly(sql: string) {
  const normalized = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!/^\s*select\b/i.test(normalized)) {
    throw new Error("Market sync SQL must be SELECT-only");
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do)\b/i.test(normalized)) {
    throw new Error("Refusing non-SELECT SQL against market DB");
  }
}

function normalizeImages(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      if (raw.startsWith("http")) return [raw];
    }
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.urls)) {
      return obj.urls.filter((x): x is string => typeof x === "string");
    }
  }
  return [];
}

function normalizeActive(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return !["false", "0", "no", "inactive"].includes(v.toLowerCase());
  return true;
}

export async function fetchMarketProductsReadOnly(): Promise<{
  products: Array<{
    sku: string;
    name: string;
    brand: string | null;
    category: string | null;
    faceValue: number | null;
    faceCurrency: string | null;
    description: string | null;
    images: string[];
    isActive: boolean;
    rawData: Record<string, unknown>;
  }>;
  source: string;
}> {
  const url = process.env.MARKET_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "MARKET_DATABASE_URL не задан. Добавьте read-only connection string в .env.local"
    );
  }

  // Block accidental write URLs that look like admin write users? We can't know.
  // Enforce SELECT-only at SQL level.
  const customSql = process.env.MARKET_PRODUCTS_SQL?.trim();
  const queries = customSql ? [customSql] : DEFAULT_QUERIES;
  for (const q of queries) assertSelectOnly(q);

  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    query_timeout: 15_000,
    options: "-c default_transaction_read_only=on",
  });

  await client.connect();
  try {
    await client.query("SET default_transaction_read_only = on");
    await client.query("SET STATEMENT_TIMEOUT TO 15000");

    let result: { rows: Record<string, unknown>[] } | null = null;
    let lastError: Error | null = null;
    for (const sql of queries) {
      try {
        result = await client.query(sql);
        break;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    if (!result) {
      throw lastError ?? new Error("No market products query succeeded");
    }
    const products = [];

    for (const row of result.rows) {
      const parsed = RowSchema.safeParse(row);
      if (!parsed.success) continue;
      const p = parsed.data;
      const face =
        p.faceValue === null || p.faceValue === undefined || p.faceValue === ""
          ? null
          : Number(p.faceValue);

      products.push({
        sku: p.sku,
        name: p.name,
        brand: p.brand ?? null,
        category: p.category ?? null,
        faceValue: face != null && !Number.isNaN(face) ? face : null,
        faceCurrency: p.faceCurrency ?? null,
        description: p.description ?? null,
        images: normalizeImages(p.images),
        isActive: normalizeActive(p.isActive),
        rawData: row as Record<string, unknown>,
      });
    }

    return {
      products,
      source: "MARKET_DATABASE_URL (read-only SELECT)",
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function marketDbConfigured(): boolean {
  return Boolean(process.env.MARKET_DATABASE_URL?.trim());
}
