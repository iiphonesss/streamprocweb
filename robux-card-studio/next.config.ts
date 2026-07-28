import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "better-sqlite3", "@prisma/client", "pg"],
  allowedDevOrigins: ["*.loca.lt", "loca.lt"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
