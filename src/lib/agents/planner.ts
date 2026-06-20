import { env } from "../env";
import type { Msg } from "../model";
import type { AgentContext, GameSpec, IngestOutput, NodeResult } from "./types";
import { GameSpec as GameSpecSchema } from "./types";

// 精确到字段类型的契约（真实模型需要明确 shape，否则会把 controls 写成对象、requiredAssets 写成字符串）。
const SYSTEM = [
  "你是游戏设计模型。把创意 brief 转成**严格符合下述结构的 GameSpec JSON 对象**，只输出 JSON，不要解释、不要 markdown 代码块。",
  "字段（类型必须精确）：",
  "- title: string；genre: string；summary: string（一句话）",
  "- mechanics: string[]（≥1 条玩法点）",
  '- controls: **string**（一句话操作说明，如 "← → / A D 移动；空格重开"）',
  "- winCondition: string；loseCondition: string；theme: string",
  '- palette: string[]，**每个元素是 "#rrggbb" 十六进制**（≥1，建议 3 个）',
  '- requiredAssets: **对象数组**，每项 = { "id": string, "role": "sprite"|"background"|"sfx", "description": string }',
  '- engine: { "mode": "dodge"|"catch"|"reaction", "bg": "#rrggbb", "grid": string, "speed": number, "accel": number, "spawnMs": number, "misses": 正整数 }',
  "约束：单 canvas 霓虹街机小游戏；engine.mode 必须是 dodge/catch/reaction 之一，贴合 brief（躲避→dodge，接住/收集→catch，反应/点击→reaction）。",
  '示例（务必同形）：{"title":"Neon Dodge","genre":"arcade","summary":"躲避坠落霓虹障碍，越久越快","mechanics":["随时间加速","漏接惩罚"],"controls":"← → / A D 移动；空格重开","winCondition":"尽量久地存活累积分数","loseCondition":"碰到障碍即结束","theme":"deep-space neon","palette":["#7c5cff","#27e0ff","#ff5cc8"],"requiredAssets":[{"id":"player","role":"sprite","description":"主角精灵"},{"id":"bg","role":"background","description":"星空背景"}],"engine":{"mode":"dodge","bg":"#0c0a14","grid":"rgba(124,92,255,0.1)","speed":160,"accel":0.05,"spawnMs":700,"misses":1}}',
].join("\n");

/**
 * PLANNER —— 创意 brief → 结构化 GameSpec（docs/04）。
 * model.chat 带 schema → JSON mode；输出不合契约则**节点内有限修复重试**（MAX_AGENT_RETRIES）：
 * 每次失败把 Zod 错误回喂给模型让它修正（真实模型路径）；mock 按 seedKey 恒定，忽略增量消息。
 * 仍失败则抛 → 任务 FAILED（docs/08 模型坏输出恢复）。
 */
export async function runPlanner(
  ctx: AgentContext,
  ingest: IngestOutput,
): Promise<NodeResult<GameSpec>> {
  let lastErr: unknown;
  const messages: Msg[] = [{ role: "user", content: ingest.brief }];
  for (let attempt = 0; attempt <= env.MAX_AGENT_RETRIES; attempt++) {
    try {
      const res = await ctx.model.chat<GameSpec>({
        system: SYSTEM,
        messages,
        schema: GameSpecSchema,
        seedKey: ctx.seedKey,
      });
      const spec = res.object as GameSpec;
      return {
        output: spec,
        inputSummary: `brief(${ingest.brief.length} 字) → GameSpec`,
        outputSummary: `${spec.title} · ${spec.genre} · mode=${spec.engine?.mode ?? "?"} · ${spec.palette.length} 色`,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
      };
    } catch (e) {
      lastErr = e;
      // 回喂错误让模型修正（mock 忽略此增量、仍按 seedKey 确定性）。
      messages.push({
        role: "user",
        content: `上次输出不符合 GameSpec 契约，校验错误：${String(e).slice(0, 700)}。请严格按字段类型只输出修正后的合法 JSON。`,
      });
    }
  }
  throw new Error(
    `PLANNER：模型输出 ${env.MAX_AGENT_RETRIES + 1} 次均不合 GameSpec 契约：${String(lastErr)}`,
  );
}
