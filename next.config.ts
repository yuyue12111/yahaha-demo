import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output → slim runner image; CMD `node server.js`. See Dockerfile.
  output: "standalone",
  reactStrictMode: true,
  // 站点级纵深防御（docs/07 §1）：限制本站可嵌入的 iframe 源为 MinIO 产物源，并禁止本站被他人内嵌。
  // 只设 frame-src/frame-ancestors，不碰 default-src/script-src，避免误伤 Next 运行时（主隔离仍是 sandbox iframe）。
  async headers() {
    const s3Public = process.env.S3_PUBLIC_ENDPOINT || "http://localhost:9000";
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-src 'self' ${s3Public}; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
