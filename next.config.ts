import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: () => Date.now().toString(),
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
