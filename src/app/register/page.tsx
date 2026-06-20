import { Suspense } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand/Logo";
import { AuthForm } from "@/components/auth/AuthForm";

export default function RegisterPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 28% 18%, rgba(192,59,255,.18), transparent 52%), radial-gradient(circle at 80% 92%, rgba(39,224,255,.14), transparent 52%)",
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-xl border border-hairline bg-surface p-7 shadow-modal">
        <Link href="/" className="mb-5 inline-flex">
          <Brand float />
        </Link>
        <h1 className="text-[18px] font-bold text-ink">创建账号</h1>
        <p className="mb-5 mt-1 text-[13px] text-ink-muted">加入 Yahaha，开始创作与游玩。</p>
        <Suspense>
          <AuthForm mode="register" />
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
