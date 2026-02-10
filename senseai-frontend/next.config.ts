import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix Next.js Turbopack "workspace root" warnings in mono-repos.
  turbopack: {
    root: __dirname,
  },
  // Allow dev server to be opened via LAN IP (e.g. https://10.91.174.93:3000)
  // Include any LAN IPs so dev works when opening via IP (e.g. from phone or other device)
  allowedDevOrigins: [
    "https://localhost:3000",
    "http://localhost:3000",
    "https://10.91.174.93:3000",
    "http://10.91.174.93:3000",
    "https://10.10.10.2:3000",
    "http://10.10.10.2:3000",
  ],
};

export default nextConfig;
