import { env } from "../env";
import type { AgentContext, GameSpec, IngestOutput, NodeResult } from "./types";
import { GameSpec as GameSpecSchema } from "./types";

const SYSTEM =
  "你是游戏设计模型。把创意 brief 转成结构化 GameSpec(JSON)：title/genre/summary/" +
  "mechanics/controls/winCondition/loseCondition/theme/palette(#rrggbb 数组)/requiredAssets。" +
  "面向单 canvas 的霓虹街机小游戏，玩法限 dodge/catch/reaction 之一。";

/**
 * PLANNER —— 创意 brief → 结构化 GameSpec（docs/04）。
 * model.chat 带 schema → JSON mode；输出不合契约则**节点内有限修复重试**（MAX_AGENT_RETRIES），
 * 仍失败则抛 → 任务 FAILED（docs/08 模型坏输出恢复）。mock 路径恒合法。
 */
export async function runPlanner(
  ctx: AgentContext,
  ingest: IngestOutput,
): Promise<NodeResult<GameSpec>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= env.MAX_AGENT_RETRIES; attempt++) {
    try {
      const res = await ctx.model.chat<GameSpec>({
        system: SYSTEM,
        messages: [{ role: "user", content: ingest.brief }],
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
    }
  }
  throw new Error(
    `PLANNER：模型输出 ${env.MAX_AGENT_RETRIES + 1} 次均不合 GameSpec 契约：${String(lastErr)}`,
  );
}
