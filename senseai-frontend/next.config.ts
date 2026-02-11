import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix Next.js Turbopack "workspace root" warnings in mono-repos.
  // We want Turbopack to treat THIS folder as the project root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
