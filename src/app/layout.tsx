import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { IntroOverlay } from "@/components/brand/IntroOverlay";
import { ArcadeCursor } from "@/components/brand/ArcadeCursor";

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
        {children}
        {/* 入场动画（每会话一次，盖在真 app 上播完淡出；reduced-motion 跳过） */}
        <IntroOverlay />
        {/* 街机指针（细指针设备接管系统光标；触屏/reduced-motion 自适配；对红线② 零影响） */}
        <ArcadeCursor />
      </body>
    </html>
  );
}
