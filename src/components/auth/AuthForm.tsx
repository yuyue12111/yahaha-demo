"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

/**
 * 登录/注册共用表单。注册先 POST /api/auth/register，再 credentials 登录；登录直接 signIn。
 * `oauth` 由服务端页面据 env 凭据传入：配齐才渲染对应第三方按钮（缺则仅邮箱登录，红线⑤）。
 */
export function AuthForm({
  mode,
  oauth,
}: {
  mode: "login" | "register";
  oauth?: { google: boolean; github: boolean };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");

    try {
      if (mode === "register") {
        const displayName = String(fd.get("displayName") || "");
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, displayName }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          setError(j?.error?.message ?? "注册失败");
          setPending(false);
          return;
        }
      }
      const r = await signIn("credentials", { email, password, redirect: false });
      if (r?.error) {
        setError("邮箱或密码错误");
        setPending(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("出错了，请重试");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {mode === "register" ? (
        <Field name="displayName" label="展示名" placeholder="你的名字" autoComplete="nickname" required />
      ) : null}
      <Field name="email" type="email" label="邮箱" placeholder="you@example.com" autoComplete="email" required />
      <Field
        name="password"
        type="password"
        label="密码"
        placeholder={mode === "register" ? "至少 8 位" : "••••••••"}
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        required
      />
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      <Button variant="primary" size="lg" type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "请稍候…" : mode === "register" ? "创建账号" : "登录"}
      </Button>

      {/* OAuth 第三方登录：仅在该 provider 配齐凭据时渲染（env-gated）。点击 → NextAuth OAuth 流程 → 回调 /api/auth/callback/{provider} → 账号绑定（auth.ts linkOAuthAccount）。 */}
      {oauth && (oauth.google || oauth.github) ? (
        <>
          <div className="my-1 flex items-center gap-3 text-[11px] text-ink-faint">
            <span className="h-px flex-1 bg-hairline" />
            <span>或继续使用</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <div className="flex gap-2">
            {oauth.google ? (
              <OAuthButton provider="google" label="Google" next={next}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M21.6 12.2c0-.65-.06-1.27-.17-1.86H12v3.53h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.2z" />
                  <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.23-2.5c-.9.6-2.05.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22z" />
                  <path fill="#FBBC05" d="M6.41 13.9a6 6 0 0 1 0-3.8V7.51H3.07a10 10 0 0 0 0 8.98l3.34-2.59z" />
                  <path fill="#EA4335" d="M12 5.98c1.47 0 2.78.5 3.81 1.49l2.86-2.86C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.07 7.51l3.34 2.59C7.2 7.74 9.4 5.98 12 5.98z" />
                </svg>
              </OAuthButton>
            ) : null}
            {oauth.github ? (
              <OAuthButton provider="github" label="GitHub" next={next}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49l-.01-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
                </svg>
              </OAuthButton>
            ) : null}
          </div>
        </>
      ) : null}
    </form>
  );
}

/** OAuth 第三方登录按钮：点击发起 NextAuth OAuth 流程，成功回 next。 */
function OAuthButton({
  provider,
  label,
  next,
  children,
}: {
  provider: "google" | "github";
  label: string;
  next: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => signIn(provider, { callbackUrl: next })}
      aria-label={`使用 ${label} 登录`}
      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-hairline-strong text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
    >
      {children}
      {label}
    </button>
  );
}
