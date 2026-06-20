import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BrandDefs } from "@/components/brand/Logo";

// Vendored (next/font/local) → no build-time network; --font-sans drives the Tailwind sans stack.
const jakarta = localFont({
  src: [
    { path: "./fonts/PlusJakartaSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/PlusJakartaSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/PlusJakartaSans-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/PlusJakartaSans-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yahaha — AI Native 互动游戏平台",
  description: "登录 → Create（异步多 Agent 生成）→ 发布 → Play（远端产物隔离运行）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={jakarta.variable}>
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        <BrandDefs />
        {children}
      </body>
    </html>
  );
}
