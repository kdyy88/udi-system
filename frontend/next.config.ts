import path from "path";
import dotenv from "dotenv";
import type { NextConfig } from "next";

// Load the workspace-root .env so NEXT_PUBLIC_* vars are available
// even when `next dev` is started from the frontend/ directory.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // In dev, prevent the browser from caching Turbopack chunks.
  // This stops stale-chunk errors after every dev-server restart.
  ...(isDev && {
    async headers() {
      return [
        {
          source: "/_next/static/:path*",
          headers: [{ key: "Cache-Control", value: "no-store" }],
        },
      ];
    },
  }),
};

export default nextConfig;
