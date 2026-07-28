import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "better-sqlite3", "@prisma/client", "pg"],
  allowedDevOrigins: ["*.loca.lt", "loca.lt"],
  turbopack: {
    // Pin root to this app so ~/package-lock.json is ignored
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
