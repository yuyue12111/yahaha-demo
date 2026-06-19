import type { AgentContext, AssetPlan, AssetRef, GameSpec, NodeResult } from "./types";
import { AssetPlan as AssetPlanSchema } from "./types";

/**
 * ASSET_CURATOR —— 把上传素材映射到 spec 的精灵/背景角色，缺口记为占位（程序生成/调色板）。
 * CP3 渲染走程序化 canvas（调色板驱动），故映射主要进 AgentLog/AssetPlan 作"上传被引用"的证据；
 * 上传对生成的真实影响经 INGEST 描述 → brief → seedKey → spec 调色/玩法链路达成（异上传异产物）。
 */
export async function runAssetCurator(
  _ctx: AgentContext,
  spec: GameSpec,
  assetRefs: AssetRef[],
): Promise<NodeResult<AssetPlan>> {
  const mappings: { assetId: string; role: string; s3Key: string }[] = [];
  const placeholders: { id: string; role: string; note: string }[] = [];

  const uploads = [...assetRefs];
  for (const req of spec.requiredAssets) {
    const up = uploads.shift();
    if (up) {
      mappings.push({ assetId: up.assetId, role: req.role, s3Key: up.key });
    } else {
      placeholders.push({ id: req.id, role: req.role, note: "程序生成 / 调色板占位" });
    }
  }
  // 多出的上传也记一条映射（未消费的素材仍标注已纳入计划）。
  for (const up of uploads) {
    mappings.push({ assetId: up.assetId, role: "extra", s3Key: up.key });
  }

  const output = AssetPlanSchema.parse({ mappings, placeholders });
  return {
    output,
    inputSummary: `${spec.requiredAssets.length} 个所需角色 ⨯ ${assetRefs.length} 个上传`,
    outputSummary: `映射 ${mappings.length} · 占位 ${placeholders.length}`,
  };
}
