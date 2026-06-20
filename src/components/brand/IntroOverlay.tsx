"use client";

import { useEffect, useRef, useState } from "react";
import { PixelWordmark } from "./Logo";

/**
 * 入场动画（参考稿 `Yahaha Pixel Intro`）：街机点阵场上像素从四周飞入、沿三段拼成像素霓虹 Y-fork，
 * 点亮后「YAHAHA」字标浮现 → **整个 lockup 飞向首页左上角侧栏 logo 的位置（dock）**，同时黑场淡出，
 * 露出底下真实 app。侧栏那枚 logo 即同款像素 Y、位置一致 → 无缝交接。
 *
 * dock 目标 = 侧栏品牌 lockup（`[data-dock-target]`，带重试测量）。测不到（移动端侧栏隐藏）退化为居中淡出。
 * 飞行用 rAF 直接驱动 transform（不依赖 CSS transition，规避 toggle 不触发的坑）。
 * 每会话一次（sessionStorage）、`prefers-reduced-motion` 跳过、SKIP。纯 canvas 2D，离线安全，红线零影响。
 */

const SEEN_KEY = "yahaha-intro-seen";
const N = 18;
const SCALE = 3.6;
const DOCK_MS = 1050;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

const SEGS: { a: [number, number]; b: [number, number]; c: string }[] = [
  { a: [0.23, 0.18], b: [0.5, 0.5], c: "#FF3BA7" },
  { a: [0.77, 0.18], b: [0.5, 0.5], c: "#27E0FF" },
  { a: [0.5, 0.5], b: [0.5, 0.87], c: "#C03BFF" },
];

function segDist(px: number, py: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = dx * dx + dy * dy || 1;
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / L;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

type Pix = { tx: number; ty: number; col: string; sx: number; sy: number };
type Dock = { tx: number; ty: number };

export function IntroOverlay() {
  const [gone, setGone] = useState(false);
  const [revealing, setRevealing] = useState(false); // 黑场淡出
  const [lit, setLit] = useState(false); // 字标浮现 / LOADING 淡出

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lockupRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const kickRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const t0Ref = useRef(0);
  const ipRef = useRef<Pix[] | null>(null);
  const cwRef = useRef(0);
  const dockRef = useRef<Dock | null>(null);
  const dockStartRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = !!window.sessionStorage.getItem(SEEN_KEY);
    } catch {
      seen = false;
    }
    if (reduce || seen) {
      setGone(true);
      return;
    }
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode — still play once */
    }

    const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));

    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (kickRef.current) cancelAnimationFrame(kickRef.current);
      rafRef.current = null;
      kickRef.current = null;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    const initIP = (W: number, H: number) => {
      const cw = W / N;
      cwRef.current = cw;
      const ch = H / N;
      const cxv = W * 0.5,
        cyv = H * 0.47;
      const ip: Pix[] = [];
      for (let gy = 0; gy < N; gy++)
        for (let gx = 0; gx < N; gx++) {
          const nx = (gx + 0.5) / N,
            ny = (gy + 0.5) / N;
          let best = 9,
            col = "#fff";
          for (const s of SEGS) {
            const d = segDist(nx, ny, s.a, s.b);
            if (d < best) {
              best = d;
              col = s.c;
            }
          }
          if (best <= 0.072) {
            const ang = Math.random() * 6.283,
              rad = Math.max(W, H) * (0.55 + Math.random() * 0.65);
            ip.push({ tx: gx * cw + cw / 2, ty: gy * ch + ch / 2, col, sx: cxv + Math.cos(ang) * rad, sy: cyv + Math.sin(ang) * rad });
          }
        }
      ipRef.current = ip;
    };

    const drawPixelLogo = (ctx: CanvasRenderingContext2D, W: number, H: number, o: { glow: number; alpha: number; t: number }) => {
      const cw = W / N,
        ch = H / N;
      const sp = document.createElement("canvas");
      sp.width = W;
      sp.height = H;
      const sx = sp.getContext("2d");
      if (!sx) return;
      const thick = 0.072,
        soft = 0.17;
      for (let gy = 0; gy < N; gy++)
        for (let gx = 0; gx < N; gx++) {
          const nx = (gx + 0.5) / N,
            ny = (gy + 0.5) / N;
          let best = 9,
            col = "#fff";
          for (const s of SEGS) {
            const d = segDist(nx, ny, s.a, s.b);
            if (d < best) {
              best = d;
              col = s.c;
            }
          }
          let inten = 0;
          if (best <= thick) inten = 1;
          else {
            const a = 1 - (best - thick) / soft;
            if (a > 0 && a > BAYER[gy % 4][gx % 4]) inten = 0.4 + 0.45 * a;
          }
          if (inten <= 0) continue;
          let color = col;
          const dM = Math.hypot(nx - 0.5, ny - 0.47);
          if (dM < 0.13) color = "#FFFFFF";
          sx.globalAlpha = Math.min(1, inten);
          sx.fillStyle = color;
          const pad = Math.max(1, cw * 0.1);
          sx.fillRect(Math.floor(gx * cw) + pad, Math.floor(gy * ch) + pad, Math.ceil(cw) - 2 * pad, Math.ceil(ch) - 2 * pad);
        }
      ctx.save();
      ctx.globalAlpha = 0.7 * o.alpha;
      ctx.filter = "blur(" + o.glow + "px)";
      ctx.drawImage(sp, 0, 0);
      ctx.restore();
      ctx.globalAlpha = o.alpha;
      ctx.drawImage(sp, 0, 0);
      ctx.globalAlpha = 0.13 * o.alpha;
      ctx.fillStyle = "#05030a";
      const off = (o.t * 24) % 3;
      for (let y = -3 + off; y < H; y += 3) ctx.fillRect(0, y, W, 1.3);
      ctx.globalAlpha = 1;
    };

    const drawIntro = (cv: HTMLCanvasElement, t: number) => {
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const W = cv.width,
        H = cv.height;
      if (!ipRef.current) initIP(W, H);
      ctx.clearRect(0, 0, W, H);
      const staticA = Math.max(0, Math.min(1, (t - 1.25) / 0.55));
      const partA = 1 - staticA;
      if (partA > 0.01 && ipRef.current) {
        const pr = ease(Math.min(1, t / 1.5));
        const s = cwRef.current * 0.82;
        for (const p of ipRef.current) {
          const x = p.sx + (p.tx - p.sx) * pr,
            y = p.sy + (p.ty - p.sy) * pr;
          ctx.globalAlpha = partA * (0.45 + 0.55 * pr);
          ctx.fillStyle = p.col;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
      }
      if (staticA > 0.01) {
        const pulse = t > 2.7 ? 1 + 0.16 * Math.sin(t * 1.8) : 1;
        drawPixelLogo(ctx, W, H, { glow: 9 * pulse, alpha: staticA, t });
      }
    };

    const loop = () => {
      const now = performance.now();
      const el2 = (now - t0Ref.current) / 1000;
      const c = canvasRef.current;
      if (c) drawIntro(c, el2);
      // dock 飞行：rAF 插值 transform（centered+大 → 侧栏 identity），无 CSS transition 依赖。
      const lk = lockupRef.current,
        dk = dockRef.current;
      if (lk && dk) {
        const p = dockStartRef.current == null ? 0 : ease(Math.min(1, (now - dockStartRef.current) / DOCK_MS));
        lk.style.transform = `translate(${dk.tx * (1 - p)}px,${dk.ty * (1 - p)}px) scale(${1 + (SCALE - 1) * (1 - p)})`;
      }
      if (el2 < 7.5) rafRef.current = requestAnimationFrame(loop);
      else rafRef.current = null;
    };

    const begin = () => {
      const c = canvasRef.current,
        lk = lockupRef.current;
      if (!c || !lk) {
        kickRef.current = requestAnimationFrame(begin);
        return;
      }
      c.width = 240;
      c.height = 240;
      ipRef.current = null;
      // 初始：居中放大（dock 未测到也是这个；测到后 measureDock 改 left/top，loop 用 dk 居中 transform）
      lk.style.left = "50%";
      lk.style.top = "44%";
      lk.style.transformOrigin = "center";
      lk.style.transform = `translate(-50%,-50%) scale(${SCALE})`;
      t0Ref.current = performance.now();
      loop();
    };
    begin();

    timersRef.current.push(setTimeout(() => setLit(true), 1800));
    timersRef.current.push(
      setTimeout(() => {
        // 起飞：dock 到侧栏 lockup 的左上角。测真实 [data-dock-target]（此时多半已布局）；
        // 测不到（仍在流式/Suspense）则用侧栏布局常量兜底。lockup 自身尺寸用于居中（它在覆盖层里，恒已布局）。
        const lk = lockupRef.current;
        if (!lk || window.innerWidth < 768) return; // 移动端无侧栏 → 不 dock，居中淡出
        const el = document.querySelector("[data-dock-target]") as HTMLElement | null;
        const r = el?.getBoundingClientRect();
        const tl = r && r.width > 2 ? r.left : 18; // 兜底：aside px-3.5(14) + link px-1(4)
        const tt = r && r.height > 2 ? r.top : 24; // 兜底：aside py-6(24)
        const lkW = lk.offsetWidth,
          lkH = lk.offsetHeight;
        const tx = Math.round(window.innerWidth / 2 - (tl + lkW / 2));
        const ty = Math.round(window.innerHeight * 0.44 - (tt + lkH / 2));
        lk.style.left = tl + "px";
        lk.style.top = tt + "px";
        lk.style.transformOrigin = "center";
        lk.style.transform = `translate(${tx}px,${ty}px) scale(${SCALE})`; // p=0：仍居中，避免 1 帧错位
        dockRef.current = { tx, ty };
        dockStartRef.current = performance.now();
      }, 2600),
    );
    timersRef.current.push(setTimeout(() => setRevealing(true), 3750)); // 落位后淡出黑场 → 不双 logo
    timersRef.current.push(
      setTimeout(() => {
        stop();
        setGone(true);
      }, 4800),
    );

    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (kickRef.current) cancelAnimationFrame(kickRef.current);
    timersRef.current.forEach(clearTimeout);
    setRevealing(true);
    setTimeout(() => setGone(true), 600);
  };

  if (gone) return null;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ pointerEvents: revealing ? "none" : "auto" }}
      role="presentation"
    >
      {/* 街机点阵黑场（dock 落位后淡出露出 app）；lockup 不在此层 → 飞行保持实色，卸载即无缝交接。 */}
      <div
        className="absolute inset-0 transition-opacity duration-[1000ms] ease-out"
        style={{ background: "#08050F", opacity: revealing ? 0 : 1 }}
        aria-hidden
      >
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "5px 5px" }} />
        <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg,rgba(5,3,10,.5) 0,rgba(5,3,10,.5) 1.4px,transparent 1.4px,transparent 3px)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 110% at 50% 47%,rgba(124,92,255,.12),transparent 60%)" }} />
      </div>

      {/* lockup：像素 Y canvas + YAHAHA 字标（与侧栏品牌同布局/同尺寸；transform 由 rAF 驱动） */}
      <div ref={lockupRef} className="absolute z-[60] flex items-center gap-2.5" aria-hidden>
        <canvas ref={canvasRef} style={{ width: 40, height: 40, display: "block", imageRendering: "pixelated" }} />
        <span style={{ opacity: lit ? 1 : 0, transition: "opacity .45s ease" }}>
          <PixelWordmark height={19} />
        </span>
      </div>

      {/* LOADING 字样 */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-[64%] text-center font-mono text-[11px] tracking-[0.32em] transition-opacity duration-500"
        style={{ color: "#5A5470", opacity: lit ? 0 : 1 }}
        aria-hidden
      >
        L O A D I N G&nbsp;&nbsp;Y A H A H A
      </div>

      {/* skip */}
      <button
        type="button"
        onClick={skip}
        aria-label="跳过入场动画"
        className="absolute right-6 top-5 z-[80] rounded-pill border border-hairline-strong bg-white/[0.04] px-4 py-2 font-mono text-[11px] tracking-[0.05em] text-ink-muted backdrop-blur transition-opacity duration-500 hover:bg-white/10 hover:text-ink"
        style={{ opacity: revealing ? 0 : 1 }}
      >
        SKIP ▸
      </button>
    </div>
  );
}
