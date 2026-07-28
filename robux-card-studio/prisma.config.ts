import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI loads .env by default via dotenv/config, but local setup uses .env.local
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const databaseUrl =
  process.env.DATABASE_URL?.trim() || "file:./data/card-studio.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
