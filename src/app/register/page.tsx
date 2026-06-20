import { Suspense } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand/Logo";
import { AuthForm } from "@/components/auth/AuthForm";
import { AmbientBackdrop } from "@/components/brand/AmbientBackdrop";
import { oauthEnabled } from "@/lib/auth";

// 运行时渲染：OAuth 按钮按运行时 env 凭据决定（env-gated），不可静态预渲染。
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <AmbientBackdrop variant="auth" />
      <div className="relative w-full max-w-sm rounded-xl border border-hairline bg-surface p-7 shadow-modal">
        <Link href="/" className="mb-5 inline-flex">
          <Brand float />
        </Link>
        <h1 className="text-[18px] font-bold text-ink">创建账号</h1>
        <p className="mb-5 mt-1 text-[13px] text-ink-muted">加入 Yahaha，开始创作与游玩。</p>
        <Suspense>
          <AuthForm mode="register" oauth={oauthEnabled} />
        </Suspense>
        <p className="mt-4 text-[13px] text-ink-muted">
          已有账号？
          <Link href="/login" className="ml-1 text-brand-cyan hover:underline">
            登录
          </Link>
        </p>
      </div>
    </main>
  );
}
