"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * 头像 / 背景图上传：presign → 浏览器直传 MinIO（profile/* 公开）→ PATCH 持久化 → 刷新。
 * app 绝不经手字节（红线①：直传 MinIO）。
 */
export function ProfileImageUpload({
  kind,
  className,
  children,
}: {
  kind: "avatar" | "banner";
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const presign = await fetch("/api/profile/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, filename: file.name, contentType: file.type, bytes: file.size }),
      });
      if (!presign.ok) {
        const e = await presign.json().catch(() => null);
        throw new Error(e?.error?.message ?? `presign 失败 ${presign.status}`);
      }
      const { putUrl, publicUrl } = (await presign.json()) as { putUrl: string; publicUrl: string };

      const put = await fetch(putUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) throw new Error(`直传 MinIO 失败 ${put.status}`);

      const patch = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [kind === "avatar" ? "avatarUrl" : "bannerUrl"]: publicUrl }),
      });
      if (!patch.ok) {
        const e = await patch.json().catch(() => null);
        throw new Error(e?.error?.message ?? `保存失败 ${patch.status}`);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={className} title={err ?? undefined}>
        {busy ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/30"
            style={{ borderTopColor: "#fff" }}
            aria-hidden
          />
        ) : (
          children
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
