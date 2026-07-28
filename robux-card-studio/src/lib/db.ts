import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function resolveDbPath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "file:./data/card-studio.db";
  const filePath = dbUrl.replace(/^file:/, "");
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  return absolute;
}

function createClient() {
  const absolute = resolveDbPath();
  const adapter = new PrismaBetterSqlite3({ url: `file:${absolute}` });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/** Lazy proxy so a DB init failure does not crash route module import. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
