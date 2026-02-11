import type { NextConfig } from "next";
import os from "node:os";

function detectLanHosts(): string[] {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "::1"]);
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const net of list) {
      if (net.family === "IPv4" && !net.internal && net.address) {
        hosts.add(net.address);
      }
    }
  }
  return Array.from(hosts);
}

const nextConfig: NextConfig = {
  // Fix Next.js Turbopack "workspace root" warnings in mono-repos.
  turbopack: {
    root: __dirname,
  },
  // Use current machine interfaces dynamically to avoid hardcoded IP churn.
  allowedDevOrigins: detectLanHosts(),
};

export default nextConfig;
