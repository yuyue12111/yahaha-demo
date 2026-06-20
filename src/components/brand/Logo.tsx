"use client";

import { useEffect, useRef } from "react";

/**
 * 品牌标志 = 像素霓虹 Y-Fork（参考稿 `Yahaha Pixel Logo`）。
 * 三段：左臂洋红 / 右臂青 / 主干紫，汇于中心白热点；Bayer 有序抖动 + 霓虹辉光 bloom + CRT 扫描线。
 * canvas 绘制（替换原 SVG 版）；保持 <YForkLogo size float> 接口不变（drop-in，所有调用点无需改）。
 */

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

// ── 像素字标 "YAHAHA"（参考稿 Pixel Logo 的 Silkscreen lockup）：canvas 5×7 位模渲染，
//    与像素 logo 同一套技术（自带、离线安全、不引入字体/联网，保红线⑤）。YAHAHA 只需 Y/A/H 三字模。
const GLYPHS: Record<string, string[]> = {
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
};
const WORD = "YAHAHA";

/**
 * 像素字标。`height` 可传 px 数字（侧栏/Brand）或 CSS 串如 "0.78em"（随标题字号缩放，用于 Create 标题内联）。
 * 内部固定高分辨率绘制，CSS 缩放 + image-rendering:pixelated 保持锐利。
 */
export function PixelWordmark({
  height = 18,
  color = "#F4F1FA",
  glow = true,
  className = "",
}: {
  height?: number | string;
  color?: string;
  glow?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rows = 7,
      colsPer = 5,
      gap = 1,
      cell = 8; // 内部分辨率（device px/格）
    const totalCols = WORD.length * colsPer + (WORD.length - 1) * gap;
    c.width = totalCols * cell;
    c.height = rows * cell;
    ctx.clearRect(0, 0, c.width, c.height);
    const draw = (fill: string, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      let colOff = 0;
      for (const ch of WORD) {
        const g = GLYPHS[ch];
        for (let r = 0; r < rows; r++)
          for (let k = 0; k < colsPer; k++) {
            if (g[r][k] === "1") {
              const pad = Math.max(0.5, cell * 0.08);
              ctx.fillRect((colOff + k) * cell + pad, r * cell + pad, cell - 2 * pad, cell - 2 * pad);
            }
          }
        colOff += colsPer + gap;
      }
      ctx.globalAlpha = 1;
    };
    if (glow) {
      ctx.save();
      ctx.filter = "blur(" + cell * 0.5 + "px)";
      draw(color, 0.45);
      ctx.restore();
    }
    draw(color, 1);
  }, [color, glow]);
  const h = typeof height === "number" ? `${height}px` : height;
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Yahaha"
      className={className}
      style={{ height: h, width: "auto", display: "block", imageRendering: "pixelated" }}
    />
  );
}

/** logo + 像素 "YAHAHA" 字标。 */
export function Brand({ size = 28, float = false }: { size?: number; float?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <YForkLogo size={size} float={float} />
      <PixelWordmark height={Math.round(size * 0.5)} />
    </span>
  );
}
