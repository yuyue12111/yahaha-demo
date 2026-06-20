"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 入场动画（参考稿 `Yahaha Pixel Intro`）：街机点阵场上，~?? 个像素从四周飞入、沿三段汇聚拼成
 * **像素霓虹 Y-fork**（左臂洋红 / 右臂青 / 主干紫 / 中心白热），点亮后霓虹 bloom + CRT 扫描线脉冲；
 * 「LOADING YAHAHA」字样淡出 → 覆盖层淡出，露出底下真实 app（其侧栏 logo 即同款像素 Y，视觉连贯）。
 *
 * 落地差异：作为 fixed inset-0 覆盖层盖在真 app 上，播完淡出卸载。每会话一次（sessionStorage）、
 * `prefers-reduced-motion` 直接跳过、Skip 按钮。纯 canvas 2D，无依赖、离线安全，对红线零影响（纯展示）。
 */

const SEEN_KEY = "yahaha-intro-seen";
const N = 18;

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

export function IntroOverlay() {
  const [gone, setGone] = useState(false); // 完全卸载
  const [revealing, setRevealing] = useState(false); // 淡出露出 app
  const [lit, setLit] = useState(false); // LOADING 字样淡出

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const kickRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const t0Ref = useRef(0);
  const ipRef = useRef<Pix[] | null>(null);
  const cwRef = useRef(0);

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

    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (kickRef.current) cancelAnimationFrame(kickRef.current);
      rafRef.current = null;
      kickRef.current = null;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));

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
      const el = (performance.now() - t0Ref.current) / 1000;
      const c = canvasRef.current;
      if (c) drawIntro(c, el);
      if (el < 7.5) rafRef.current = requestAnimationFrame(loop);
      else rafRef.current = null;
    };

    const begin = () => {
      const c = canvasRef.current;
      if (!c || c.clientWidth === 0) {
        kickRef.current = requestAnimationFrame(begin);
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      ipRef.current = null;
      t0Ref.current = performance.now();
      loop();
    };
    begin();

    timersRef.current.push(setTimeout(() => setLit(true), 2100));
    timersRef.current.push(setTimeout(() => setRevealing(true), 3300));
    timersRef.current.push(
      setTimeout(() => {
        stop();
        setGone(true);
      }, 4300),
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
      className="fixed inset-0 z-[100] overflow-hidden transition-opacity duration-[800ms] ease-out"
      style={{
        background: "#08050F",
        opacity: revealing ? 0 : 1,
        pointerEvents: revealing ? "none" : "auto",
      }}
      role="presentation"
    >
      {/* 街机点阵场 + CRT 横扫 + 中心辉光（参考稿 overlay） */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "5px 5px" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "repeating-linear-gradient(0deg,rgba(5,3,10,.5) 0,rgba(5,3,10,.5) 1.4px,transparent 1.4px,transparent 3px)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 110% at 50% 47%,rgba(124,92,255,.12),transparent 60%)" }}
        aria-hidden
      />

      {/* 像素 Y 拼合 canvas（居中，逻辑 47% 高与粒子汇聚锚点一致） */}
      <div className="pointer-events-none absolute left-1/2 top-[47%] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <canvas ref={canvasRef} className="block h-[min(58vw,260px)] w-[min(58vw,260px)]" style={{ imageRendering: "pixelated" }} />
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
        className="absolute right-6 top-5 z-[6] rounded-pill border border-hairline-strong bg-white/[0.04] px-4 py-2 font-mono text-[11px] tracking-[0.05em] text-ink-muted backdrop-blur transition-colors hover:bg-white/10 hover:text-ink"
      >
        SKIP ▸
      </button>
    </div>
  );
}
