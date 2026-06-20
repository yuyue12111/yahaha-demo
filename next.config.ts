import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output → slim runner image; CMD `node server.js`. See Dockerfile.
  output: "standalone",
  reactStrictMode: true,
  // bullmq/ioredis 是 node-only：保持为外部包（运行时从 node_modules require，不进 webpack bundle）。
  serverExternalPackages: ["bullmq", "ioredis"],
  // BullMQ 在运行时用 fs 读 *.lua 命令脚本；standalone 的 nft 静态追踪会漏，显式纳入（POST/retry 用 queue.add）。
  outputFileTracingIncludes: {
    "/api/tasks": ["./node_modules/bullmq/dist/**"],
    "/api/tasks/**": ["./node_modules/bullmq/dist/**"],
  },
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
          // 纵深安全 headers（B4）：均不影响游戏 iframe（frame-src 已显式允 MinIO 产物源）。
          { key: "X-Content-Type-Options", value: "nosniff" }, // 禁 MIME 嗅探
          { key: "X-Frame-Options", value: "DENY" }, // frame-ancestors 的旧浏览器兜底（本站不被内嵌）
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
