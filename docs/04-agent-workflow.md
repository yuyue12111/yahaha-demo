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
| `INGEST` | `{ prompt, assetRefs[] }` | `{ brief, assetDescriptions[] }` | 归一多模态：图片经 `VISION_MODEL` 转场景/资产描述影响生成；无 vision 模型则退化纯文本。**诚实口径（2026-06-21 已闭合）**：`ingest.ts` 对图片素材从 MinIO 读真字节（`storage.getObjectBytes`，守红线①）→ 内联 base64 data URL 传 `vision({imageUrl})` → 接真 GPT-5.5 **真读上传像素**；用 data URL 而非 presigned localhost URL（远端模型不可达）。mock 仍按 `hint`+`seedKey` 确定性（忽略 imageUrl），离线异上传异产物，红线③成立。非图片/超 4MB/读失败 → 退化 hint-only。 |
| `PLANNER` | `{ brief }` | `GameSpec` | 创意 → 结构化设计规格（见下 Schema）。 |
| `ASSET_CURATOR` | `{ spec, assets[] }` | `AssetPlan` | 把上传素材映射到精灵/背景，缺口用占位/生成；输出含 S3 key 映射。 |
| `CODER` | `{ spec, assetPlan }` | `{ files: {path,content}[] }` | 产出自包含 HTML5 游戏（满足运行时契约：挂载 `#game-root` + postMessage 生命周期）。内部可带有限自修复。 |
| `VALIDATOR` | `{ files }` | `{ ok, errors[], coverPng? }` | **静态**校验：运行时契约存在性 + 体积/CSP 扫描（**绝不执行生成码**）。AST 解析(acorn/esbuild) **DEFERRED 2026-06-19** —— 当前用结构/字符串校验（语法坏的 game.js 理论可漏过，但模板化 CODER 恒产合法码，happy path 不触）。**可选** headless 截图当封面。 |
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
  "requiredAssets": [{ "id": "string", "role": "sprite|background|sfx", "description": "string" }],
  "engine": {                         // 可选·实现调参：CODER 内联进 game.js，使产物随输入变化
    "mode": "dodge|catch|reaction",   // 通用 canvas 引擎的玩法分支
    "bg": "#rrggbb", "grid": "#rrggbb",
    "speed": 0, "accel": 0, "spawnMs": 0, "misses": 1
  }
}
```
> `engine` 是 PLANNER 产出的**实现层调参**（mock/真实模型均可填）；CODER 据它内联 `SPEC` 进 `game.js`，
> 让玩法/配色/速度随输入变（异输入异产物，规避 3.4.4 固定假数据）。缺省时 CODER 用确定性兜底。

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
   └──(retry 幂等整跑)───────┘   // 续跑见下「失败恢复」实现注
```
- `currentStep` 随节点更新；每节点起止写 `AgentLog`。
- 超时：整任务 `GENERATION_TIMEOUT_MS` 看护，防卡 `RUNNING`。

## 失败恢复（见 `08-...` 矩阵）

- 模型坏输出 → 节点内有限重试（PLANNER 已实现）+ 校验后再打包。
- 瞬时失败（模型限流/上传抖动）→ `MAX_AGENT_RETRIES` 指数退避（BullMQ）。
- 终态失败 → `FAILED` + `error` + 失败节点入 `AgentLog`；UI 提供 `retry`。worker 崩溃遗留的 `RUNNING` 由启动 reaper + BullMQ stalled 回收为 `FAILED`（MED-5）。
  - **retry 语义（实现注，2026-06-19）**：当前 = 从 `INGEST` **幂等整跑**（新 `attempt`、复用 `task.gameId`、产 `versionNumber+1`）；**「从失败节点续跑（durable-step 复用前序产物）」DEFERRED 至 post-MVP**（mock 幂等、整链 ~3s，续跑收益小）。
- 兜底（**DEFERRED 2026-06-19**）：`VALIDATOR` 反复失败 → 回退确定性 mock 产物。**当前架构下不需要**：CODER 为确定性模板（模型只影响 PLANNER 的 GameSpec、**不直接产码**），其输出恒是「确定性 mock 产物」且恒过存在性校验；该 fallback 仅当 CODER 改为「模型直接产码」时才需要。

## 产物 = 可玩 bundle

不是代码片段/截图，而是 MinIO 上 `games/{gameId}/{version}/` 下的 `index.html + game.js + assets/* + manifest.json + cover.png|cover.svg`，由 Play 加载（见 `05` / `06`）。

## durable step / 可观测（借鉴 C）

每节点是可独立重试的检查点（**结果缓存 / 从失败节点续跑 DEFERRED 2026-06-19**，当前 retry 为幂等整跑）；Create UI 渲染 run-timeline（Planner→Coder→Validator…）映射节点起止与 IO 摘要，使"多步非黑盒"可证。
