import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  reactStrictMode: false,
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
