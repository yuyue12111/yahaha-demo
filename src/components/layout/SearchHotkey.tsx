"use client";

import { useEffect } from "react";

/**
 * 让顶栏搜索框的 `⌘K / Ctrl+K` 角标名副其实：全局监听快捷键 → 聚焦 #global-search。
 * 仅在非输入态触发（在别的输入框里按 ⌘K 不抢焦点）。返回 null，纯行为组件。
 */
export function SearchHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        const input = document.getElementById("global-search") as HTMLInputElement | null;
        if (!input) return;
        e.preventDefault();
        input.focus();
        input.select?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
