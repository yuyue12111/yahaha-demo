import { Rng } from "../rng";
import type { ChatInput, ChatResult, ModelClient, VisionInput, VisionResult } from "./types";

/**
 * 确定性、输入敏感的 mock 模型 —— 无 key 也能离线复现整条流水线（Fatal #3/#5）。
 * chat(schema): 据 seedKey 播种 → 合成一份 GameSpec 形状对象，交给传入的 schema 校验（保证合法）。
 * 不同 prompt → 不同种子 → 不同 spec/调色/玩法 → 不同 bundle 字节（证非固定假数据）。
 */

// 创意词池（全部由种子确定性选取）。
const GENRES = ["arcade", "reaction", "dodge", "collector", "runner"] as const;
const MODES = ["dodge", "catch", "reaction"] as const; // 引擎玩法分支（CODER 据 genre 再定）

const THEME_KEYWORDS: Array<{ k: RegExp; theme: string; hue: number }> = [
  { k: /space|star|galaxy|cosmo|宇宙|星|太空/i, theme: "deep-space neon", hue: 265 },
  { k: /ocean|sea|water|fish|deep|海|鱼|水/i, theme: "bioluminescent abyss", hue: 190 },
  { k: /forest|jungle|tree|leaf|森林|树|丛林/i, theme: "glowing forest", hue: 140 },
  { k: /city|cyber|neon|street|urban|城市|赛博|街/i, theme: "cyberpunk skyline", hue: 305 },
  { k: /fire|lava|volcano|heat|火|岩浆/i, theme: "molten arcade", hue: 18 },
  { k: /ice|snow|frost|winter|冰|雪/i, theme: "frostbyte grid", hue: 205 },
  { k: /candy|sweet|sugar|糖|甜/i, theme: "candy circuit", hue: 330 },
  { k: /medieval|castle|knight|kingdom|中世纪|城堡|骑士|王国/i, theme: "castle torchlight", hue: 34 },
  { k: /magic|wizard|arcane|spell|rune|魔法|法师|符文|奥术/i, theme: "arcane sigils", hue: 275 },
  { k: /desert|sand|dune|oasis|沙漠|沙丘|绿洲/i, theme: "sunscorch dunes", hue: 40 },
  { k: /wasteland|ruin|apocalyp|废土|末日|废墟/i, theme: "rustfall wastes", hue: 22 },
  { k: /steam|steampunk|gear|brass|蒸汽|齿轮|黄铜/i, theme: "brass steamworks", hue: 30 },
  { k: /crystal|gem|prism|diamond|水晶|宝石|棱镜/i, theme: "prismatic cavern", hue: 168 },
  { k: /haunted|ghost|spooky|grave|幽灵|鬼|墓地|恐怖/i, theme: "haunted hollow", hue: 285 },
];

/** prompt 关键词 → 玩法 mode（C1：替代 rng.pick，让玩法贴合语义；无匹配才退化随机）。 */
const MODE_KEYWORDS: Array<{ k: RegExp; mode: (typeof MODES)[number] }> = [
  { k: /catch|collect|grab|gather|接住|接|抓|收集|捡/i, mode: "catch" },
  { k: /react|reflex|tap|click|aim|whack|反应|点击|瞄|敲/i, mode: "reaction" },
  { k: /dodge|avoid|evade|escape|躲避|躲|闪避|避开/i, mode: "dodge" },
  { k: /run|runner|parkour|dash|sprint|跑酷|奔跑|冲刺|跑/i, mode: "dodge" }, // 跑酷 → 横向躲避骨架
];
function pickMode(brief: string, rng: Rng): (typeof MODES)[number] {
  const m = MODE_KEYWORDS.find((x) => x.k.test(brief));
  return m ? m.mode : rng.pick(MODES);
}
const FALLBACK_THEMES = [
  { theme: "synthwave grid", hue: 280 },
  { theme: "neon arcade", hue: 320 },
  { theme: "vapor drift", hue: 200 },
];

const TITLE_ADJ = ["Neon", "Hyper", "Astro", "Turbo", "Quantum", "Pixel", "Vivid", "Cosmic", "Glitch", "Lumen"];
const TITLE_NOUN = ["Drift", "Rush", "Catcher", "Dodger", "Pulse", "Runner", "Blitz", "Hopper", "Cascade", "Reactor"];

const MECHANICS_POOL = [
  "随时间累积分数",
  "速度随时长递增",
  "连击加成",
  "屏幕边缘环绕",
  "限时窗口操作",
  "漏接惩罚",
  "霓虹拖尾粒子",
];
const CONTROLS_POOL = [
  "← → 或 A / D 移动；空格 / 点击 重新开始",
  "方向键移动，触屏拖动同步；点击重开",
  "A / D 横移，松手减速；空格重开",
];

/** HSL → #rrggbb（确定性配色，不依赖随机）。 */
function hsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** 据种子 + brief 合成一份 GameSpec 形状对象（字段名与 docs/04 GameSpec 一致）。 */
export function synthesizeGameSpec(rng: Rng, brief: string): Record<string, unknown> {
  const matched = THEME_KEYWORDS.find((t) => t.k.test(brief));
  const base = matched ?? rng.pick(FALLBACK_THEMES);
  const hue = base.hue + rng.int(-12, 12);
  const theme = base.theme;

  const genre = rng.pick(GENRES);
  const adj = rng.pick(TITLE_ADJ);
  const noun = rng.pick(TITLE_NOUN);
  const title = `${adj} ${noun}`;

  // 三色霓虹 palette：主色 / 邻近色 / 互补点缀，由 hue 旋转得到（异主题异配色）。
  const palette = [
    hsl(hue, 90, 60),
    hsl(hue + rng.int(24, 60), 88, 62),
    hsl(hue + 180, 85, 64),
  ];

  const mechanics = rng.sample(MECHANICS_POOL, rng.int(2, 3));
  const controls = rng.pick(CONTROLS_POOL);
  const mode = pickMode(brief, rng); // 关键词驱动（语义贴合）；无匹配退化确定性随机

  const winCondition =
    mode === "reaction" ? "在限时内点中尽量多的目标累积高分" : "存活并尽可能久地累积分数";
  const loseCondition =
    mode === "catch" ? "漏接 3 个目标即结束" : mode === "dodge" ? "碰到坠落障碍即结束" : "错过窗口耗尽生命即结束";

  const summary = `${theme}风格的${genre}小游戏：${mechanics[0]}，${
    mode === "catch" ? "接住坠落的霓虹目标" : mode === "dodge" ? "躲避坠落的霓虹障碍" : "在窗口期点中闪现目标"
  }。`;

  return {
    title,
    genre,
    summary,
    mechanics,
    controls,
    winCondition,
    loseCondition,
    theme,
    palette,
    requiredAssets: [
      { id: "player", role: "sprite", description: `${theme} 主角精灵` },
      { id: "target", role: "sprite", description: mode === "dodge" ? "坠落障碍" : "坠落目标" },
      { id: "background", role: "background", description: `${theme} 背景` },
    ],
    // 引擎调参（GameSpec.engine，docs/04 已登记）：CODER 内联进 game.js，使字节随输入变。
    engine: {
      mode,
      bg: hsl(hue, 38, 7),
      grid: hsl(hue, 40, 18),
      speed: Math.round(rng.range(120, 220)),
      accel: Number(rng.range(0.03, 0.08).toFixed(3)),
      spawnMs: Math.round(rng.range(520, 920)),
      misses: mode === "catch" ? rng.int(3, 5) : 1,
    },
  };
}

export class MockModelClient implements ModelClient {
  readonly provider = "mock";

  async chat<T = unknown>(input: ChatInput): Promise<ChatResult<T>> {
    const seedKey = input.seedKey ?? input.messages.map((m) => m.content).join("\n");
    const rng = new Rng(`chat:${seedKey}`);
    const brief = input.messages.map((m) => m.content).join("\n");

    if (input.schema) {
      const candidate = synthesizeGameSpec(rng, brief);
      // 交给调用方 schema 校验：若字段漂移会抛 → 节点内修复重试（与真实模型路径一致）。
      const object = input.schema.parse(candidate) as T;
      return { object, tokensIn: estTokens(brief), tokensOut: 180 };
    }

    const text = `「${brief.slice(0, 40)}」→ seeded design notes #${rng.int(1000, 9999)}`;
    return { text, tokensIn: estTokens(brief), tokensOut: estTokens(text) };
  }

  async vision(input: VisionInput): Promise<VisionResult> {
    const rng = new Rng(`vision:${input.seedKey ?? ""}:${input.hint ?? ""}`);
    const palettes = ["暖色霓虹", "冷色青蓝", "高对比洋红", "柔和紫调"];
    const subjects = ["一个角色精灵", "一片背景纹理", "一组几何图形", "一个发光图标"];
    const text = `上传素材（${input.hint ?? "image"}）看起来是${rng.pick(subjects)}，主色调偏${rng.pick(
      palettes,
    )}，适合作为${rng.bool() ? "主角" : "背景"}使用。`;
    return { text, tokensIn: 64, tokensOut: estTokens(text) };
  }
}

function estTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}
