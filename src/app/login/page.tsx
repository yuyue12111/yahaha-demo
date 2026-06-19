import { Suspense } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand/StarLogo";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-surface p-7">
        <Link href="/" className="mb-5 inline-flex">
          <Brand />
        </Link>
        <h1 className="text-[18px] font-bold text-ink">登录</h1>
        <p className="mb-5 mt-1 text-[13px] text-ink-muted">欢迎回来。</p>
        {/* useSearchParams 需 Suspense 边界（Next 15） */}
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
        <p className="mt-4 text-[13px] text-ink-muted">
          还没有账号？
          <Link href="/register" className="ml-1 text-brand-cyan hover:underline">
            注册
          </Link>
        </p>
      </div>
    </main>
  );
}
