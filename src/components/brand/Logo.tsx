"use client";

import { useEffect, useRef } from "react";

/**
 * 品牌标志 = 像素霓虹 Y-Fork（参考稿 `Yahaha Pixel Logo`）。
 * 三段：左臂洋红 / 右臂青 / 主干紫，汇于中心白热点；Bayer 有序抖动 + 霓虹辉光 bloom + CRT 扫描线。
 * canvas 绘制（替换原 SVG 版）；保持 <YForkLogo size float> 接口不变（drop-in，所有调用点无需改）。
 */

// 渐变 def 历史保留（根布局渲染一次；像素 logo 不再引用，留作兼容不删，避免改动其他文件）。
export function BrandDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="yh-gPlay" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF3BA7" />
          <stop offset="1" stopColor="#C03BFF" />
        </linearGradient>
        <linearGradient id="yh-gCreate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#27E0FF" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── 像素 Y-fork 绘制核心（与 Pixel Logo 参考稿一致） ──────────────────────────
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

const SEGS: { a: [number, number]; b: [number, number]; c: string }[] = [
  { a: [0.23, 0.18], b: [0.5, 0.5], c: "#FF3BA7" }, // 左臂 = 玩（洋红）
  { a: [0.77, 0.18], b: [0.5, 0.5], c: "#27E0FF" }, // 右臂 = 创作（青）
  { a: [0.5, 0.5], b: [0.5, 0.87], c: "#C03BFF" }, // 主干（紫）
];

function segDist(px: number, py: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = dx * dx + dy * dy || 1;
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / L;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

function drawPixelY(canvas: HTMLCanvasElement, N: number, glow: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width,
    H = canvas.height,
    cw = W / N,
    ch = H / N;
  ctx.clearRect(0, 0, W, H);

  // 离屏先画清晰的抖动 Y 精灵，再叠霓虹 bloom + crisp。
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
      if (dM < 0.13) color = "#FFFFFF"; // 中心白热
      sx.globalAlpha = Math.min(1, inten);
      sx.fillStyle = color;
      const pad = Math.max(1, cw * 0.1);
      sx.fillRect(Math.floor(gx * cw) + pad, Math.floor(gy * ch) + pad, Math.ceil(cw) - 2 * pad, Math.ceil(ch) - 2 * pad);
    }

  if (glow > 0.3) {
    ctx.save();
    ctx.filter = "blur(" + glow + "px)";
    ctx.globalAlpha = 0.75;
    ctx.drawImage(sp, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(sp, 0, 0);
  // CRT 扫描线
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = "#05030a";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1.3);
  ctx.globalAlpha = 1;
}

export function YForkLogo({ size = 28, float = false }: { size?: number; float?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.max(1, Math.round(size * dpr));
    c.height = c.width;
    // 降采样网格随尺寸：大标用细网格，favicon 用粗网格仍可辨。
    const N = size >= 200 ? 18 : size >= 48 ? 16 : size >= 28 ? 13 : 11;
    drawPixelY(c, N, Math.max(2, c.width * 0.1));
  }, [size]);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center ${float ? "yh-floaty" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <canvas ref={ref} style={{ width: size, height: size, display: "block", imageRendering: "pixelated" }} />
    </span>
  );
}

/** logo + "Yahaha" 字标（字重 800，沿用站点字体）。 */
export function Brand({ size = 28, float = false }: { size?: number; float?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <YForkLogo size={size} float={float} />
      <span className="font-extrabold tracking-tight" style={{ fontSize: Math.round(size * 0.6) }}>
        Yahaha
      </span>
    </span>
  );
}
