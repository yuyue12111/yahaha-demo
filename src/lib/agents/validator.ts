import { env } from "../env";
import type { AgentContext, CoderOutput, NodeResult, ValidationResult } from "./types";
import { ValidationResult as ValidationResultSchema } from "./types";

/**
 * VALIDATOR —— 对生成产物做**静态**校验（docs/04/07）：运行时契约存在性 + 体积 + CSP。
 * **绝不执行生成代码**（docs/07 §1）：只做结构/字符串检查 + 字节统计。失败抛出 → 任务 FAILED
 * （docs/08：终态失败记录失败节点；CODER 模板化恒合法，故 happy path 必过）。
 */
export async function runValidator(
  _ctx: AgentContext,
  coder: CoderOutput,
): Promise<NodeResult<ValidationResult>> {
  const byPath = new Map(coder.files.map((f) => [f.path, f.content]));
  const errors: string[] = [];

  const html = byPath.get("index.html");
  if (!html) errors.push("缺 index.html");
  else {
    if (!/id="game-root"/.test(html)) errors.push("index.html 缺 #game-root 挂载点（docs/06）");
    if (!/Content-Security-Policy/i.test(html)) errors.push("index.html 缺 CSP meta");
    if (!/connect-src 'none'/.test(html)) errors.push("CSP 未含 connect-src 'none'");
    if (!/src="\.\/game\.js"/.test(html)) errors.push("index.html 未引用 ./game.js");
  }

  const js = byPath.get("game.js");
  if (!js) errors.push("缺 game.js");
  else {
    if (!/GAME_LOADED/.test(js)) errors.push("game.js 未实现 GAME_LOADED 生命周期");
    if (!/["']yahaha-game["']/.test(js)) errors.push("game.js 未用 postMessage 信封 source");
  }

  const bundleBytes = coder.files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  if (bundleBytes > env.MAX_BUNDLE_BYTES) {
    errors.push(`bundle ${bundleBytes}B 超过上限 ${env.MAX_BUNDLE_BYTES}B`);
  }

  if (errors.length > 0) {
    throw new Error(`VALIDATOR 不通过：${errors.join("；")}`);
  }

  const output = ValidationResultSchema.parse({
    ok: true,
    errors: [],
    coverPath: byPath.has("cover.svg") ? "cover.svg" : undefined,
    bundleBytes,
  });
  return {
    output,
    inputSummary: `${coder.files.length} 文件 / ${bundleBytes}B`,
    outputSummary: `契约存在性 OK · ≤${env.MAX_BUNDLE_BYTES}B · cover=${output.coverPath ?? "none"}`,
  };
}
