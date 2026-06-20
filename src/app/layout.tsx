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
        {/* 首帧前给 <html> 加 .intro-seen → CSS 隐藏覆盖层（避免闪黑场）。
            intro 只在“裸首页”(/ 且无 query) 才有资格播；任何搜索结果(/?search=)/深链一律跳过。
            存 sessionStorage（每会话一次：新标签页/新会话重新迎接，同会话内导航不重播），与 IntroOverlay 门控逐字一致。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var bare=location.pathname==='/'&&!location.search;if(sessionStorage.getItem('yahaha-intro-seen')||!bare)document.documentElement.classList.add('intro-seen')}catch(e){}",
          }}
        />
        {children}
        {/* 入场动画（仅裸首页、每会话一次，盖在真 app 上播完淡出；reduced-motion 跳过） */}
        <IntroOverlay />
        {/* 街机指针（细指针设备接管系统光标；触屏/reduced-motion 自适配；对红线② 零影响） */}
        <ArcadeCursor />
      </body>
    </html>
  );
}
