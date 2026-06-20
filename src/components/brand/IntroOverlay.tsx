"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 入场动画（参考稿 `Yahaha Intro.dc.html`）：canvas 粒子从四周飞入，沿三段汇聚成 Y-fork
 * （左臂洋红 / 右臂青 / 主干紫→绿）+ 双光束扫过 + 中心辉光；~3s「YaHaHa」字标 + tagline 逐字浮现；
 * ~4.35s 爆散 → 覆盖层淡出，露出底下真实 app（非参考稿里的 mock home）。
 *
 * 落地差异：作为 fixed inset-0 覆盖层盖在真 app 上，播完淡出卸载。每会话一次（sessionStorage）、
 * `prefers-reduced-motion` 直接跳过、Skip/重播按钮。纯 canvas 2D，无依赖、离线安全，对红线零影响（纯展示）。
 */

type Part = {
  sx: number; sy: number; tx: number; ty: number;
  free: boolean; col: string; size: number; ph: number; spd: number; bvx: number; bvy: number;
};

const SEEN_KEY = "yahaha-intro-seen";

export function IntroOverlay() {
  const [gone, setGone] = useState(false); // 完全卸载
  const [revealing, setRevealing] = useState(false); // 淡出露出 app
  const [wordmark, setWordmark] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const kickRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const t0Ref = useRef(0);
  const stateRef = useRef<{ parts: Part[]; cx: number; cy: number; W: number; H: number; ctx: CanvasRenderingContext2D | null }>({
    parts: [], cx: 0, cy: 0, W: 0, H: 0, ctx: null,
  });

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
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

    const setup = () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth || window.innerWidth;
      const h = c.clientHeight || window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.205;
      const A: [number, number] = [cx - s, cy - s * 1.25];
      const B: [number, number] = [cx + s, cy - s * 1.25];
      const M: [number, number] = [cx, cy - s * 0.02];
      const S: [number, number] = [cx, cy + s * 1.5];
      const lerp = (p: number[], q: number[], t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const dens = 1;
      const perSeg = Math.round(205 * dens);
      const targets: { x: number; y: number; tag: "L" | "R" | "S" }[] = [];
      ([[A, M, "L"], [B, M, "R"], [M, S, "S"]] as [number[], number[], "L" | "R" | "S"][]).forEach(([p, q, tag]) => {
        const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        for (let i = 0; i < perSeg; i++) {
          const t = i / (perSeg - 1);
          const b = lerp(p, q, t);
          const j = (Math.random() - 0.5) * s * 0.11;
          targets.push({ x: b[0] + nx * j, y: b[1] + ny * j, tag });
        }
      });
      const pal: Record<string, [string, string]> = { L: ["#FF3BA7", "#C03BFF"], R: ["#27E0FF", "#3B82F6"], S: ["#C03BFF", "#5DE2B0"] };
      const N = targets.length;
      const free = Math.floor(N * 0.4);
      const parts: Part[] = [];
      for (let i = 0; i < N + free; i++) {
        const isFree = i >= N;
        const tgt = isFree ? null : targets[i];
        const ang = Math.random() * Math.PI * 2, rad = Math.max(w, h) * (0.4 + Math.random() * 0.65);
        const sx = cx + Math.cos(ang) * rad, sy = cy + Math.sin(ang) * rad * 0.8;
        const col = isFree
          ? (Math.random() < 0.5 ? "#7C5CFF" : "#27E0FF")
          : (Math.random() < 0.5 ? pal[tgt!.tag][0] : pal[tgt!.tag][1]);
        parts.push({
          sx, sy,
          tx: isFree ? sx : tgt!.x, ty: isFree ? sy : tgt!.y,
          free: isFree, col,
          size: isFree ? Math.random() * 1.1 + 0.4 : Math.random() * 1.5 + 0.8,
          ph: Math.random() * Math.PI * 2, spd: 0.5 + Math.random() * 0.8,
          bvx: Math.random() - 0.5, bvy: Math.random() - 0.5,
        });
      }
      stateRef.current = { parts, cx, cy, W: w, H: h, ctx };
    };

    const loop = () => {
      const { ctx, parts, cx, cy, W: w, H: h } = stateRef.current;
      if (!ctx) return;
      const el = (performance.now() - t0Ref.current) / 1000;
      const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));
      const conv = ease((el - 1.0) / 2.0);
      const burst = Math.max(0, el - 4.35);

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(8,5,16,0.32)";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        let x: number, y: number, a: number, sz: number;
        const drift = Math.sin(el * p.spd + p.ph);
        if (p.free) {
          x = p.sx + drift * 14 + p.bvx * el * 7;
          y = p.sy + Math.cos(el * p.spd + p.ph) * 14 + p.bvy * el * 7;
          a = 0.16 * Math.min(1, el / 0.9) * (burst > 0 ? Math.max(0, 1 - burst * 1.3) : 1);
          sz = p.size;
        } else {
          let bx = p.sx + (p.tx - p.sx) * conv, by = p.sy + (p.ty - p.sy) * conv;
          bx += drift * (1 - conv) * 10;
          by += Math.cos(el * p.spd + p.ph) * (1 - conv) * 10;
          if (burst > 0) {
            const dx = p.tx - cx, dy = p.ty - cy, len = Math.hypot(dx, dy) || 1;
            const v = burst * burst * 460;
            bx = p.tx + (dx / len) * v + p.bvx * burst * 70;
            by = p.ty + (dy / len) * v + p.bvy * burst * 70;
          }
          x = bx; y = by;
          const solid = Math.min(1, Math.max(0, (el - 1.0) / 2.2));
          a = (0.24 + 0.62 * solid) * Math.min(1, el / 0.6);
          if (burst > 0) a *= Math.max(0, 1 - burst * 1.2);
          sz = p.size * (1 + conv * 0.55);
        }
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      const glow = Math.min(1, Math.max(0, (el - 2.5) / 1.5)) * (burst > 0 ? Math.max(0, 1 - burst * 1.5) : 1);
      if (glow > 0) {
        ctx.globalAlpha = glow * 0.5;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.42);
        g.addColorStop(0, "rgba(192,59,255,0.5)");
        g.addColorStop(0.5, "rgba(124,92,255,0.14)");
        g.addColorStop(1, "rgba(124,92,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      const sweep = (el - 1.4) / 1.9;
      if (sweep >= 0 && sweep <= 1) {
        const fade = 0.12 * Math.max(0, 1 - Math.abs(sweep - 0.5) * 1.4);
        const beam = (x: number, col: string) => {
          const grad = ctx.createLinearGradient(x - 150, 0, x + 150, 0);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(0.5, col);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = fade;
          ctx.fillStyle = grad;
          ctx.fillRect(x - 150, 0, 300, h);
        };
        beam(sweep * w, "rgba(255,59,167,1)");
        beam((1 - sweep) * w, "rgba(39,224,255,1)");
      }

      ctx.globalAlpha = 1;
      if (el < 7.5) rafRef.current = requestAnimationFrame(loop);
      else rafRef.current = null;
    };

    const begin = () => {
      const c = canvasRef.current;
      if (!c || c.clientWidth === 0) {
        kickRef.current = requestAnimationFrame(begin);
        return;
      }
      setup();
      t0Ref.current = performance.now();
      loop();
    };
    begin();

    timersRef.current.push(setTimeout(() => setWordmark(true), 3000));
    timersRef.current.push(setTimeout(() => setRevealing(true), 4350));
    timersRef.current.push(
      setTimeout(() => {
        stop();
        setGone(true);
      }, 5400),
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

  // 入场动画为每会话一次的进场；播完淡出即卸载，不在各页留浮动入口。
  if (gone) return null;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden transition-opacity duration-[900ms] ease-out"
      style={{
        background: "radial-gradient(130% 120% at 50% 38%,#160c28 0%,#0a0612 60%,#06040d 100%)",
        opacity: revealing ? 0 : 1,
        pointerEvents: revealing ? "none" : "auto",
      }}
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      {/* 暗角 vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 100% at 50% 50%,transparent 52%,rgba(6,4,13,.55) 100%)" }}
      />
      {/* wordmark + tagline */}
      <div className="pointer-events-none absolute left-0 right-0 top-[63%] text-center">
        <div className="text-[clamp(28px,4.4vw,46px)] font-extrabold leading-none tracking-[0.04em]">
          {["Y", "a", "h", "a", "h", "a"].map((ch, i) => (
            <span
              key={i}
              className="inline-block transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
              style={{
                color: "#F4F1FA",
                textShadow: "0 0 22px rgba(192,59,255,.5), 0 0 8px rgba(39,224,255,.35)",
                transitionDelay: `${i * 0.085}s`,
                opacity: wordmark ? 1 : 0,
                transform: wordmark ? "none" : "translateY(16px)",
              }}
            >
              {ch}
            </span>
          ))}
        </div>
        <div
          className="mt-4 text-[14.5px] tracking-[0.02em] text-ink-muted transition-opacity duration-700"
          style={{ transitionDelay: "0.6s", opacity: wordmark ? 1 : 0 }}
        >
          从一句话，到一个可玩的世界
        </div>
      </div>
      {/* skip */}
      <button
        type="button"
        onClick={skip}
        className="absolute right-7 top-6 z-[6] rounded-pill border border-hairline-strong bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium text-ink-muted backdrop-blur transition-colors hover:bg-white/10 hover:text-ink"
      >
        跳过 ▸
      </button>
    </div>
  );
}
