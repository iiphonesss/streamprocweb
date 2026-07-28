import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "sharp",
    "better-sqlite3",
    "@prisma/client",
    "pg",
    "@prisma/adapter-better-sqlite3",
  ],
  allowedDevOrigins: ["*.loca.lt", "loca.lt"],
  // When running `npm run dev` from robux-card-studio, cwd is the app root.
  // Prevents Turbopack from picking ~/package-lock.json as monorepo root.
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
