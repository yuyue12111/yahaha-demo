# 04 · Agent 工作流契约

> 多 Agent 状态机在 worker 进程内执行（`src/lib/agents/`）。每节点：类型化 IO（Zod）+ 写 `AgentLog` + 可独立重试。
> 这是规避 3.4.1/3.4.4 与"异步+多Agent"约束的核心。**不是单次黑盒调用**。

## 编排选型理由

自研 TS 类型状态机（非 LangGraph/外部框架）：2 天 solo 下零额外框架学习、全 TS 同仓类型贯通、易从 `GenerationTask` 行持久化/恢复。
rubric 只要求**可见的多步编排 + 独立 IO**，不要求具体框架名。文档点名 **LangGraph.js / Hermes** 为流程分叉变复杂后的升级路径。

## 节点链（默认 6 节点；最小回退 3 节点 `PLANNER→CODER→VALIDATOR`）

```
INGEST → PLANNER → ASSET_CURATOR → CODER → VALIDATOR → PACKAGER
```

每节点签名：`(input) => Promise<output>`，IO 用 Zod 校验；`emit(seq, agentName, title, io)` 写 `AgentLog` + 发 Redis。

| 节点 | 输入 | 输出 | 职责 |
|------|------|------|------|
| `INGEST` | `{ prompt, assetRefs[] }` | `{ brief, assetDescriptions[] }` | 归一多模态：图片经 `VISION_MODEL` 转场景/资产描述，让上传**真影响生成**；无 vision 模型则退化纯文本。 |
| `PLANNER` | `{ brief }` | `GameSpec` | 创意 → 结构化设计规格（见下 Schema）。 |
| `ASSET_CURATOR` | `{ spec, assets[] }` | `AssetPlan` | 把上传素材映射到精灵/背景，缺口用占位/生成；输出含 S3 key 映射。 |
| `CODER` | `{ spec, assetPlan }` | `{ files: {path,content}[] }` | 产出自包含 HTML5 游戏（满足运行时契约：挂载 `#game-root` + postMessage 生命周期）。内部可带有限自修复。 |
| `VALIDATOR` | `{ files }` | `{ ok, errors[], coverPng? }` | 静态解析(acorn/esbuild) + 运行时契约存在性 + 体积/安全扫描；**可选** headless 冒烟渲染并截图当封面。 |
| `PACKAGER` | `{ files, validation }` | `{ manifest, bundleKeys[], coverKey, manifestUrl }` | 算哈希、组 `manifest.json`、上传 MinIO 版本化路径、写 `Version`。 |

## GameSpec（PLANNER 输出，Zod 契约）

```jsonc
{
  "title": "string",
  "genre": "string",                 // 如 arcade / puzzle / reaction
  "summary": "string",
  "mechanics": ["string"],           // 核心玩法
  "controls": "string",              // 如 "方向键移动，空格跳"
  "winCondition": "string",
  "loseCondition": "string",
  "theme": "string",
  "palette": ["#rrggbb"],            // 配色
  "requiredAssets": [{ "id": "string", "role": "sprite|background|sfx", "description": "string" }]
}
```

## AssetPlan（ASSET_CURATOR 输出）

```jsonc
{
  "mappings": [{ "assetId": "string", "role": "string", "s3Key": "string" }],
  "placeholders": [{ "id": "string", "role": "string", "note": "用占位/程序生成" }]
}
```

## 模型 seam（可插拔 + 可确定性 mock）

接口 `src/lib/model/`：
```ts
interface ModelClient {
  chat(input: { system?: string; messages: Msg[]; schema?: ZodSchema }): Promise<{ text|object, tokensIn, tokensOut }>;
  vision(input: { imageUrl|imageBytes; prompt: string }): Promise<{ text, tokensIn, tokensOut }>;
}
```
- 实现：`codex`（Yahaha GPT-5.5，OpenAI 兼容 baseURL+key）、`openai`、`anthropic`、`mock`。
- 选择：env `MODEL_PROVIDER`。**默认接真实模型**；缺省/无 key 用 `mock`。
- **mock 必须确定性且输入敏感**：用 `hash(prompt + assetIds)` 做种 → 同输入同输出（可复现评分）、**异输入异输出**（防 3.4.4 固定假数据）。mock 仍流经全部节点、产真实可玩 bundle、写真实日志。
- 结构化输出：优先 schema-constrained / JSON mode；失败进节点内有限修复重试。

## 任务状态机

```
PENDING ──(worker 取)──▶ RUNNING ──(全节点 OK)──▶ SUCCEEDED
   ▲                        │
   │                        ├──(节点抛错/超时/校验失败)──▶ FAILED
   └──(retry 从失败节点)─────┘
```
- `currentStep` 随节点更新；每节点起止写 `AgentLog`。
- 超时：整任务 `GENERATION_TIMEOUT_MS` 看护，防卡 `RUNNING`。

## 失败恢复（见 `08-...` 矩阵）

- 模型坏输出 → 节点内有限重试 + 校验后再打包。
- 瞬时失败（模型限流/上传抖动）→ `MAX_AGENT_RETRIES` 指数退避（BullMQ）。
- 终态失败 → `FAILED` + `error` + 失败节点入 `AgentLog`；UI 提供 `retry`（从失败节点重排）。
- 兜底：`VALIDATOR` 反复失败时回退到确定性 mock 产物，保证至少可玩（demo 不硬失败）。

## 产物 = 可玩 bundle

不是代码片段/截图，而是 MinIO 上 `games/{gameId}/{version}/` 下的 `index.html + game.js + assets/* + manifest.json + cover.png`，由 Play 加载（见 `05` / `06`）。

## durable step / 可观测（借鉴 C）

每节点是可独立重试、结果可缓存的检查点；Create UI 渲染 run-timeline（Planner→Coder→Validator…）映射节点起止与 IO 摘要，使"多步非黑盒"可证。
