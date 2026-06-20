import { Rng } from "../rng";
import type { AgentContext, CoderOutput, EngineTuning, GameSpec, NodeResult } from "./types";
import { CoderOutput as CoderOutputSchema } from "./types";

/** 产物自带 CSP（docs/05/07）：connect-src 'none' 阻断外联；写进 index.html 的 meta 才真正生效。 */
const CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'";

export const BUNDLE_CSP = CSP;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * 颜色守卫（docs/07 纵深）：bg/grid 会内联进 index.html 的 <style>、game.js、cover.svg。
 * 切真模型后这些字段由模型可控 → 只放行安全 CSS 颜色（#hex / rgb()/rgba() 数值形式），
 * 非法（含 `</style><script>`、`"/>` 等注入）一律回退默认，绝不让任意串进入 HTML/SVG/JS 字面量。
 */
function safeColor(v: string | undefined, fallback: string): string {
  const s = (v ?? "").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^rgba?\(\s*[\d.\s,%/]+\)$/i.test(s)) return s;
  return fallback;
}

function indexHtml(spec: GameSpec): string {
  const bg = safeColor(spec.engine?.bg, "#0c0a14");
  return `<!doctype html>
<html lang="zh">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <!-- CSP enforced here (MinIO serves static objects without a CSP header). connect-src 'none' blocks exfiltration. -->
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <title>${esc(spec.title)}</title>
    <style>
      html, body { margin: 0; height: 100%; background: ${bg}; overflow: hidden;
        font-family: ui-sans-serif, system-ui, sans-serif; -webkit-tap-highlight-color: transparent; user-select: none; }
      #game-root { width: 100vw; height: 100vh; }
      canvas { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="game-root"><canvas id="c"></canvas></div>
    <script src="./game.js"></script>
  </body>
</html>
`;
}

/**
 * 通用霓虹街机引擎（dodge / catch / reaction）。SPEC 由 CODER 内联在头部，使每个游戏的字节与玩法
 * 随 GameSpec 变化（异输入异产物）。说 Yahaha postMessage 协议 v1：boot/restart 发 GAME_LOADED、
 * 计分发 GAME_SCORE、结束发 GAME_ENDED、未捕获异常发 GAME_ERROR（→ 失败态，绝不白屏）。
 */
const ENGINE = String.raw`(function () {
  "use strict";
  var SPEC = __SPEC__;
  var SRC = "yahaha-game", V = 1;
  function send(t, p) { try { parent.postMessage({ source: SRC, v: V, type: t, payload: p }, "*"); } catch (e) {} }
  window.addEventListener("error", function (ev) { send("GAME_ERROR", { message: String((ev && ev.message) || "runtime error") }); });

  var canvas = document.getElementById("c"), ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1;
  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  window.addEventListener("resize", resize); resize();

  var player, ents, score, lastScore, spawnT, speed, running, over, lives, scoreClock;
  var keys = { left: false, right: false }, pointerX = null;
  var REACTION = SPEC.mode === "reaction";

  function reset() {
    player = { x: W / 2, y: 0, w: 34, h: 14, vx: 0 };
    ents = []; score = 0; lastScore = -1; spawnT = 0; speed = 1; scoreClock = 0;
    running = true; over = false; lives = SPEC.misses;
    pushScore(true);
    send("GAME_LOADED"); // boot + 本地重开都广播，宿主与游戏不脱节
  }
  function pushScore(f) { if (f || score !== lastScore) { lastScore = score; send("GAME_SCORE", { score: score }); } }

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    else if ((e.key === " " || e.key === "Enter") && over) reset();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " ") e.preventDefault();
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });
  window.addEventListener("pointerdown", function (e) {
    if (over) { reset(); return; }
    if (REACTION) tapAt(e.clientX, e.clientY); else pointerX = e.clientX;
  });
  window.addEventListener("pointermove", function (e) { if (e.buttons && !REACTION) pointerX = e.clientX; });
  window.addEventListener("pointerup", function () { pointerX = null; });
  window.addEventListener("message", function (e) {
    var d = e.data; if (!d || d.source !== "yahaha-host" || d.v !== 1) return; if (d.type === "HOST_RESTART") reset();
  });

  function spawn() {
    if (REACTION) {
      var r = 20 + Math.random() * 16;
      ents.push({ x: r + Math.random() * (W - 2 * r), y: 50 + r + Math.random() * (H - 2 * r - 90), r: r, life: 1.5, age: 0 });
    } else {
      var w = 24 + Math.random() * 46;
      ents.push({ x: Math.random() * (W - w), y: -40, w: w, h: 15 + Math.random() * 12, vy: SPEC.speed + speed * 38 + Math.random() * 60 });
    }
  }
  function tapAt(px, py) {
    for (var i = ents.length - 1; i >= 0; i--) { var e = ents[i];
      var dx = px - e.x, dy = py - e.y; if (dx * dx + dy * dy <= e.r * e.r) { ents.splice(i, 1); score += 15; pushScore(true); return; } }
  }
  function gameOver() { running = false; over = true; pushScore(true); send("GAME_ENDED", { score: score }); }

  function update(dt) {
    if (!running) return;
    speed += dt * SPEC.accel * 22;
    if (!REACTION) {
      var ACC = 1200, MAXV = 480;
      if (keys.left) player.vx -= ACC * dt; if (keys.right) player.vx += ACC * dt;
      if (pointerX != null) player.vx += Math.sign(pointerX - player.x) * ACC * dt;
      player.vx *= 0.86; if (player.vx > MAXV) player.vx = MAXV; if (player.vx < -MAXV) player.vx = -MAXV;
      player.x += player.vx * dt; player.y = H - 58;
      if (player.x < player.w / 2) { player.x = player.w / 2; player.vx = 0; }
      if (player.x > W - player.w / 2) { player.x = W - player.w / 2; player.vx = 0; }
    }
    spawnT += dt * 1000;
    var interval = Math.max(240, SPEC.spawnMs - speed * 28);
    if (spawnT >= interval) { spawnT = 0; spawn(); }

    var px = player.x - player.w / 2, py = player.y - player.h / 2;
    for (var i = ents.length - 1; i >= 0; i--) {
      var e = ents[i];
      if (REACTION) {
        e.age += dt;
        if (e.age >= e.life) { ents.splice(i, 1); lives--; if (lives <= 0) { gameOver(); return; } }
        continue;
      }
      e.y += e.vy * dt;
      var hit = px < e.x + e.w && px + player.w > e.x && py < e.y + e.h && py + player.h > e.y;
      if (SPEC.mode === "dodge") {
        if (hit) { gameOver(); return; }
        if (e.y > H + 40) { ents.splice(i, 1); score += 10; }
      } else { // catch
        if (hit) { ents.splice(i, 1); score += 12; }
        else if (e.y > H + 40) { ents.splice(i, 1); lives--; if (lives <= 0) { gameOver(); return; } }
      }
    }
    if (SPEC.mode === "dodge") { scoreClock += dt; if (scoreClock >= 0.5) { scoreClock -= 0.5; score += 1; } }
    pushScore(false);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function draw() {
    ctx.fillStyle = SPEC.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = SPEC.grid; ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }

    for (var i = 0; i < ents.length; i++) {
      var e = ents[i]; ctx.save(); ctx.shadowColor = SPEC.c1; ctx.shadowBlur = 14; ctx.fillStyle = SPEC.c1;
      if (REACTION) {
        var k = 1 - e.age / e.life; var rr = e.r * (0.5 + 0.5 * k);
        ctx.globalAlpha = 0.35 + 0.65 * k; ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.fill();
      } else { roundRect(e.x, e.y, e.w, e.h, 5); ctx.fill(); }
      ctx.restore();
    }
    if (!REACTION) {
      ctx.save(); ctx.shadowColor = SPEC.c2; ctx.shadowBlur = 18;
      var g = ctx.createLinearGradient(player.x - 17, 0, player.x + 17, 0);
      g.addColorStop(0, SPEC.c0); g.addColorStop(1, SPEC.c2); ctx.fillStyle = g;
      roundRect(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, 6); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = "#f4f1fa"; ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("SCORE " + score, 14, 28);
    if (SPEC.mode !== "dodge") { ctx.fillStyle = SPEC.c1; ctx.fillText("LIVES " + Math.max(0, lives), 14, 50); }

    if (over) {
      ctx.fillStyle = "rgba(12,10,20,0.72)"; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center"; ctx.fillStyle = "#f4f1fa"; ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 8);
      ctx.fillStyle = "#9d95b0"; ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("空格 / 点击 重新开始", W / 2, H / 2 + 22); ctx.textAlign = "start";
    }
  }

  var lastT = 0;
  function loop(t) { if (!lastT) lastT = t; var dt = (t - lastT) / 1000; lastT = t; if (dt > 0.05) dt = 0.05; update(dt); draw(); requestAnimationFrame(loop); }
  reset(); requestAnimationFrame(loop);
})();
`;

/**
 * L7：GameSpec.engine 可选（真实模型可能省略）。缺省时据 spec 确定性派生默认 engine
 * （仅由输入决定 → 保红线③：无 Date.now/random），避免对 `spec.engine` 的非空断言崩 CODER。
 */
function resolveEngine(spec: GameSpec): EngineTuning {
  // bg/grid 经颜色守卫（流入 game.js 的 ctx.fillStyle/strokeStyle）；其余字段是数值，Zod 已约束。
  if (spec.engine)
    return {
      ...spec.engine,
      bg: safeColor(spec.engine.bg, "#0c0a14"),
      grid: safeColor(spec.engine.grid, "rgba(124,92,255,0.10)"),
    };
  const rng = new Rng(`engine:${spec.title}|${spec.genre}|${spec.theme}`);
  const byGenre: Record<string, EngineTuning["mode"]> = {
    collector: "catch",
    catcher: "catch",
    runner: "dodge",
    dodge: "dodge",
    reaction: "reaction",
  };
  const mode = byGenre[spec.genre.toLowerCase()] ?? rng.pick(["dodge", "catch", "reaction"] as const);
  return {
    mode,
    bg: "#0c0a14",
    grid: "rgba(124,92,255,0.10)",
    speed: rng.int(120, 210),
    accel: Number(rng.range(0.03, 0.08).toFixed(3)),
    spawnMs: rng.int(520, 900),
    misses: mode === "catch" ? rng.int(3, 5) : 1,
  };
}

function gameJs(spec: GameSpec): string {
  const e = resolveEngine(spec);
  const inlined = {
    mode: e.mode,
    c0: spec.palette[0],
    c1: spec.palette[1] ?? spec.palette[0],
    c2: spec.palette[2] ?? spec.palette[1] ?? spec.palette[0],
    bg: e.bg,
    grid: e.grid,
    speed: e.speed,
    accel: e.accel,
    spawnMs: e.spawnMs,
    misses: e.misses,
  };
  return (
    `/* ${spec.title} — generated by Yahaha CODER (mode=${e.mode}). Speaks postMessage protocol v1. */\n` +
    ENGINE.replace("__SPEC__", JSON.stringify(inlined))
  );
}

/** 玩法图标（V1）：据 mode 画可辨识的矢量骨架，居中于 (0,0)，调色板着色（确定性）。 */
function coverGlyph(mode: string, a: string, b: string, c: string): string {
  if (mode === "reaction") {
    return (
      `<circle r="58" fill="none" stroke="${a}" stroke-width="2" opacity="0.35"/>` +
      `<circle r="40" fill="none" stroke="${b}" stroke-width="2" opacity="0.55"/>` +
      `<circle r="22" fill="none" stroke="${c}" stroke-width="2" opacity="0.85"/>` +
      `<circle r="9" fill="${a}"/>`
    );
  }
  if (mode === "catch") {
    return (
      `<circle cx="-22" cy="-44" r="9" fill="${b}"/>` +
      `<circle cx="16" cy="-22" r="7" fill="${c}"/>` +
      `<circle cx="-3" cy="0" r="8" fill="${a}"/>` +
      `<path d="M-44 38 L44 38 L33 66 L-33 66 Z" fill="none" stroke="${a}" stroke-width="4" stroke-linejoin="round"/>`
    );
  }
  // dodge（默认）：坠落障碍 + 底部玩家条
  return (
    `<path d="M-34 -46 L-19 -16 L-49 -16 Z" fill="${b}"/>` +
    `<path d="M18 -30 L32 0 L4 0 Z" fill="${c}"/>` +
    `<path d="M-6 6 L9 36 L-21 36 Z" fill="${a}" opacity="0.85"/>` +
    `<rect x="-27" y="54" width="54" height="14" rx="7" fill="url(#g)"/>`
  );
}

/** 调色板 + 玩法驱动的 3:4 封面（降级阶梯 SVG 缩略图，无需 Chromium；确定性，红线③）。 */
function coverSvg(spec: GameSpec): string {
  const a = spec.palette[0];
  const b = spec.palette[1] ?? a;
  const c = spec.palette[2] ?? b;
  const bg = safeColor(spec.engine?.bg, "#0c0a14");
  const grid = safeColor(spec.engine?.grid, "rgba(124,92,255,0.12)");
  const mode = spec.engine?.mode ?? "dodge";
  let lines = "";
  for (let x = 24; x < 300; x += 28) lines += `<line x1="${x}" y1="0" x2="${x}" y2="400" stroke="${grid}" stroke-width="1"/>`;
  for (let y = 24; y < 400; y += 28) lines += `<line x1="0" y1="${y}" x2="300" y2="${y}" stroke="${grid}" stroke-width="1"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400" role="img" aria-label="${esc(spec.title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.4" r="0.55">
      <stop offset="0" stop-color="${a}" stop-opacity="0.5"/><stop offset="1" stop-color="${a}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="300" height="400" fill="${bg}"/>
  ${lines}
  <rect width="300" height="400" fill="url(#glow)"/>
  <g transform="translate(150 162)">${coverGlyph(mode, a, b, c)}</g>
  <rect x="0" y="296" width="300" height="104" fill="${bg}" opacity="0.62"/>
  <rect x="20" y="312" width="44" height="4" rx="2" fill="url(#g)"/>
  <text x="20" y="348" font-family="ui-sans-serif, system-ui, sans-serif" font-size="24" font-weight="800" fill="#f4f1fa">${esc(spec.title)}</text>
  <text x="20" y="372" font-family="ui-monospace, monospace" font-size="11" fill="#9d95b0">${esc(mode)} · neon arcade</text>
</svg>
`;
}

/**
 * CODER —— 产出自包含 HTML5 canvas 游戏（满足 docs/06 运行时契约：挂 #game-root + postMessage 生命周期）。
 * 通用引擎 + 内联 SPEC：玩法/配色/速度随 GameSpec 变 → 产物字节随输入变（规避红线③）。
 */
export async function runCoder(_ctx: AgentContext, spec: GameSpec): Promise<NodeResult<CoderOutput>> {
  const files = [
    { path: "index.html", content: indexHtml(spec), contentType: "text/html" },
    { path: "game.js", content: gameJs(spec), contentType: "application/javascript" },
    { path: "cover.svg", content: coverSvg(spec), contentType: "image/svg+xml" },
  ];
  const output = CoderOutputSchema.parse({ files });
  const bytes = files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  return {
    output,
    // 确定性模板（不调模型）→ token 成本恒为 0（B3：6 节点全量记 token）。
    tokensIn: 0,
    tokensOut: 0,
    inputSummary: `GameSpec(${spec.title}, mode=${spec.engine?.mode})`,
    outputSummary: `${files.length} 文件 · ${bytes} bytes · index.html+game.js+cover.svg`,
  };
}
