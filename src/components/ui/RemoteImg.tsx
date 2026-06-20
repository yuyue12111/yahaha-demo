"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * 跨域 MinIO 远端图（封面/头像/背景）的兜底封装：对象缺失/失效（存储漂移、桶重置）时
 * 不显示浏览器裸破图，而是渲染传入的 fallback（渐变占位 / 首字母圆）。
 * 仍是 MinIO src，红线① 不受影响；加 loading=lazy / decoding=async。
 */
export function RemoteImg({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 跨域 MinIO 图，刻意不用 next/image
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}
