"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

/** 登录/注册共用表单。注册先 POST /api/auth/register，再 credentials 登录；登录直接 signIn。 */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
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
    </form>
  );
}
