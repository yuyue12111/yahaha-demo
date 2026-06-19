import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output → slim runner image; CMD `node server.js`. See Dockerfile.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
