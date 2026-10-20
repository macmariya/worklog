import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NAS の Docker で node server.js だけで動かすため
  output: "standalone",
  // 全ページが DB と Cookie に依存する動的ページなので Cache Components は使わない
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
