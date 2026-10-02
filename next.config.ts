import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  outputFileTracingIncludes: {
    "/r/**": ["app/lib/submission-algorithm.ts", "app/lib/file-field.ts", "app/lib/upload-limits.ts", "components/ui/form.tsx"],
  },
  ...(process.env.NEXT_DIST_DIR
    ? { typescript: { tsconfigPath: "tsconfig.acceptance.json" } }
    : {}),
};

export default nextConfig;
