import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  ...(process.env.NEXT_DIST_DIR
    ? { typescript: { tsconfigPath: "tsconfig.acceptance.json" } }
    : {}),
};

export default nextConfig;
