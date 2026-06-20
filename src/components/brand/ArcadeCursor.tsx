"use client";

import { useEffect, useRef } from "react";

/**
 * 街机指针（arcade cursor）—— 进入平台后把系统光标换成霓虹「瞄准镜 reticle」：
 * 中心精准白点（即时跟随）+ 外环 reticle（轻微拖尾）+ 文本输入处变青色竖光标。
 * 悬停可点元素 → 放大变洋红；按下 → 收缩。纯展示层，`pointer-events:none` 绝不挡交互。
 *
 * 红线② 安全：本层是 host 文档里的 fixed 覆盖元素；`cursor:none` 不会穿入跨域 sandbox iframe，
 * 指针进入 Play/预览 iframe 时 host 收不到 pointermove → 自动隐藏自定义光标、让位原生光标。
 * 仅在「细指针 + 可悬停」设备接管（触屏不动）；`prefers-reduced-motion` 下取消拖尾与自旋。
 */

const INTERACTIVE =
  'a, button, [role="button"], label, select, summary, .yh-clickable, input[type="checkbox"], input[type="radio"], input[type="file"], input[type="submit"], input[type="button"], input[type="search"]';
const TEXTUAL =
  'textarea, [contenteditable="true"], input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="url"], input[type="tel"]';

export function ArcadeCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const canHover = window.matchMedia("(hover: hover)").matches;
    if (!fine || !canHover) return; // 触屏 / 无鼠标：保持系统光标
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ring = ringRef.current;
    const dot = dotRef.current;
    const text = textRef.current;
    if (!ring || !dot || !text) return;

    const html = document.documentElement;
    html.classList.add("yh-cursor-active");

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let rx = tx;
    let ry = ty;
    let visible = false;
    let raf = 0;

    const show = () => {
      if (visible) return;
      visible = true;
      ring.classList.remove("is-hidden");
      dot.classList.remove("is-hidden");
      text.classList.remove("is-hidden");
    };
    const hide = () => {
      if (!visible) return;
      visible = false;
      ring.classList.add("is-hidden");
      dot.classList.add("is-hidden");
      text.classList.add("is-hidden");
    };

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const p = `translate3d(${tx}px, ${ty}px, 0)`;
      dot.style.transform = p;
      text.style.transform = p;
      if (reduce) ring.style.transform = p;
      show();

      const el = e.target as Element | null;
      const isText = !!el?.closest?.(TEXTUAL);
      const isInteractive = !isText && !!el?.closest?.(INTERACTIVE);
      ring.classList.toggle("is-text", isText);
      ring.classList.toggle("is-hover", isInteractive);
      dot.classList.toggle("is-text", isText);
      text.classList.toggle("is-text", isText);
    };
    const onDown = () => ring.classList.add("is-down");
    const onUp = () => ring.classList.remove("is-down");
    // 指针离开文档（含进入跨域 iframe，如 Play/预览）/ 窗口失焦 / 切到后台 → 让位原生光标。
    // mouseout 的 relatedTarget=null 是「移出文档（含进 iframe）」最可靠的信号。
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) hide();
    };
    const onLeave = () => hide();
    const onBlur = () => hide();
    const onVis = () => {
      if (document.hidden) hide();
    };

    const loop = () => {
      const k = reduce ? 1 : 0.3;
      rx += (tx - rx) * k;
      ry += (ty - ry) * k;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    if (!reduce) raf = requestAnimationFrame(loop);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseout", onOut);
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseout", onOut);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      html.classList.remove("yh-cursor-active");
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="yh-cur yh-cur-ring is-hidden" aria-hidden>
        <span className="yh-cur-reticle">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11V5a2 2 0 0 1 2-2h6" />
              <path d="M23 3h6a2 2 0 0 1 2 2v6" />
              <path d="M31 23v6a2 2 0 0 1-2 2h-6" />
              <path d="M11 31H5a2 2 0 0 1-2-2v-6" />
            </g>
          </svg>
        </span>
      </div>
      <div ref={dotRef} className="yh-cur yh-cur-dot is-hidden" aria-hidden />
      <div ref={textRef} className="yh-cur yh-cur-text is-hidden" aria-hidden />
    </>
  );
}
