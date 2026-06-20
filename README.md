# Yahaha — AI Native 互动游戏平台 MVP

玩家从发现到游玩、创作者从创意到发布的**全闭环**：
**注册/登录 → Create（异步多 Agent 生成）→ 预览 → 发布 → Home（查库）→ Play（远端产物跨域隔离运行）**。

> 状态：**完整闭环已打通并通过逐轮验收**（D1 远端产物 + Play loader + 存储边界；D1-PM Auth + Home；
> D2-AM 异步多 Agent Create；D2-PM 发布闭环 + 可复现 seed）。契约见 [`docs/`](docs/)，规则见 [`CLAUDE.md`](CLAUDE.md)。

## 技术栈

前端/后端：Next.js（App Router, TS, RSC）+ Tailwind · 数据库：PostgreSQL + Prisma ·
队列：BullMQ + Redis（独立 worker 进程）· 对象存储：MinIO（S3 兼容）+ AWS SDK v3 ·
Agent：TS 自研类型状态机（6 节点 + 失败重试 + reaper）· 模型：可插拔 `ModelClient`（默认 Yahaha GPT-5.5 / 缺省确定性 mock）·
部署：Docker Compose。详见 [`docs/01-architecture.md`](docs/01-architecture.md)。

## 快速开始（一条命令）

```bash
docker compose up --build
```

一条命令起全部：`postgres` + `redis` + `minio` + 一次性 `minio-init`（自动建桶 / 公共读 / 上传预制 bundle）+
一次性 `seed`（迁移 + 插 2 个预制游戏 + **真跑一次 Create 流水线**产第 3 个游戏并发布）+ `web` + 独立 `worker`。

- 应用首页：<http://localhost:3000>
- MinIO 控制台：<http://localhost:9001>（`minioadmin` / `minioadmin`）
- **无需真实模型 key，无需先 `cp .env.example .env`**：compose 已注入所需 env，缺省 `mock` 模式离线跑通整条链路。
- 预置账号（可直接登录体验发布）：`studio@yahaha.dev` / `yahaha-demo`。
- 接真实模型：填 `.env` 的 `MODEL_PROVIDER` + `MODEL_BASE_URL` + `MODEL_API_KEY`（OpenAI 兼容），`docker compose up -d worker` 重启 worker 即生效（seed 恒用 mock 以保可复现）。

## 核心链路验证（<5 分钟演示脚本）

1. **Home 来自 DB（非写死数组）**：首页 ≥3 个游戏，其中 1 个由 Create 流水线真产出（seed 自动跑）。
2. **Play 远端加载 + 隔离**：点任一卡片 → Play 页。DevTools Network 看产物从 `localhost:9000`（MinIO，**异端口跨域**）加载；
   页面有 `Source: <远端 URL>` 徽章；iframe `sandbox="allow-scripts"` **无** `allow-same-origin`（opaque origin）。
3. **Auth 抗刷新**：登出态访问 `/create` 跳登录；登录后 F5 仍在线（httpOnly JWT cookie）。
4. **Create 异步多 Agent → 发布闭环**：`/create` 输入创意（可附图）→ `POST /api/tasks` **202 立返 taskId**（异步）→
   SSE 实时看 `INGEST→PLANNER→ASSET_CURATOR→CODER→VALIDATOR→PACKAGER` 步骤流（每节点独立 IO + 耗时）→
   跨域 sandbox 预览 → **发布到首页** → 回 Home 出现新卡片 → 点击进 Play 可玩。

> 失败有错误态（不白屏）；MinIO 抖动 → 任务 `FAILED` + 失败节点 ERROR 日志 + `retry`；worker 崩溃 → reaper 回收，不卡 RUNNING。

## 五条 Fatal 红线如何被结构性兜住

| # | 红线 | 守卫 |
|---|------|------|
| 1 | 对象存储用本地 fs 套壳 | 所有 S3/fs 访问只在 `src/lib/storage.ts`；eslint `no-restricted-imports` 全局禁 `fs`/`@aws-sdk`；产物字节从 MinIO `:9000` 出 |
| 2 | Play 跑本地写死组件 | 宿主零游戏专属码；`iframe.src` = 远端 MinIO URL（非 srcdoc）；跨域 sandbox `allow-scripts` 无 `allow-same-origin` |
| 3 | 生成是固定假数据 | `ModelClient` seam；mock 按 `hash(prompt+assets)` 播种 → 异输入异产物、同输入同产物（确定性可复现） |
| 4 | 同步 + 单次黑盒生成 | `POST /api/tasks` 写库+enqueue 后 **202 立返**；**独立 worker 进程**消费；6 个有独立 IO 日志的 Agent 节点 |
| 5 | 没 README / 起不来 / 复现不了 | 一条 `docker compose up` 起全部 + 自动建桶/迁移/seed；`.env.example` 无真密钥；无 key 也 mock 跑通 |

## 文档地图

- [`docs/00-overview.md`](docs/00-overview.md) — 产品总览、角色旅程、范围、评分映射
- [`docs/01-architecture.md`](docs/01-architecture.md) — 架构、技术栈、部署拓扑
- [`docs/02-data-model.md`](docs/02-data-model.md) — 数据模型
- [`docs/03-api-contract.md`](docs/03-api-contract.md) — API 契约（REST + SSE）
- [`docs/04-agent-workflow.md`](docs/04-agent-workflow.md) — Agent 工作流
- [`docs/05-remote-artifact-protocol.md`](docs/05-remote-artifact-protocol.md) — 远端产物协议
- [`docs/06-play-runtime-contract.md`](docs/06-play-runtime-contract.md) — Play 运行时契约
- [`docs/07-security.md`](docs/07-security.md) — 安全方案
- [`docs/08-observability-and-failure-recovery.md`](docs/08-observability-and-failure-recovery.md) — 可观测性与失败恢复
- [`docs/09-conventions.md`](docs/09-conventions.md) — 工程约定
- [`docs/10-design-system.md`](docs/10-design-system.md) — 设计系统 / 视觉基调

## 完成度说明

**已实现（核心）**
- 全闭环：Auth（邮箱注册/登录/登出、JWT httpOnly 抗刷新、`/create` 中间件+服务端双守卫、失效会话干净 401）→ Create（多模态输入、presigned 直传、异步 6 节点流水线、SSE run-timeline、跨域预览）→ 发布 → Home（查库）→ Play（远端 manifest/bundle 隔离运行，四态 loading/loaded/failed/ended）。
- 红线①②④ 结构性成立；Fatal #1 存储边界 eslint 守卫；红线③ 输入敏感确定性 mock。
- 失败恢复：节点内修复重试、任务超时看护、MinIO 抖动失败态 + retry、worker 崩溃 reaper 回收、PACKAGER 原子写无孤儿、assetIds 越权 403。
- 浏览/检索：Home 搜索（标题/简介）+ 可点标签筛选 + 最新/最热排序 + 游标分页；`GET /api/games/:id` 详情（meta + 作者 + 活跃版本 + 统计）。
- 运行时埋点：Play 回写 `PlayEvent`（LOAD/END/ERROR）→ `playCount` 自增（LOAD）；Create run-timeline 聚合并展示生成成本（6 节点 token）。
- 版本管理：作者在自己游戏的 Play 页「＋ 新版本」→ `/create?gameId=` 生成 `versionNumber+1`，发布即切换 active 版本。
- 安全增强：per-user 任务频率限额 + 公开埋点 `/api/play-events` 节流（Redis 固定窗口，429，fail-open）；失效会话存在性再校验（401 而非 500）；详情页非作者不可见草稿（404）。
- 可复现：一条 `docker compose up` 冷启动出 ≥3 已发布游戏（含 1 个 Create 真产出）。

**Mock / 设计占位**
- 默认 `mock` 模型（确定性、输入敏感）；真实 GPT-5.5 走同一 `ModelClient` seam，填 `MODEL_*` 即切。
- **多模态上传**：当前上传**仅经文件名 / MIME 类型**影响生成（mock 据其做种 → 异上传异产物，红线③成立）；`vision({imageUrl})` 真读像素的接线已在（`model/types.ts` + `openai.ts`），但 `ingest.ts` 喂像素 URL **deferred**（接真模型时补，见 `docs/04` INGEST 行）。
- OAuth：保留 `Account` 数据模型 + 流程设计（`docs/07`），缺省关闭，未真接 Google/GitHub。
- 封面走调色板 SVG 缩略图（降级阶梯）；Validator headless 截图为可选未启。

**未实现 / 带日期 deferred（见 docs 注明）**
- retry 当前为从 INGEST 幂等整跑；durable-step 续跑 deferred。
- VALIDATOR→fallback 替换路径 deferred（CODER 为确定性模板，结构上已是确定性产物）。
- VALIDATOR 的 AST 解析（acorn/esbuild）deferred，当前为结构/契约存在性 + 体积静态校验。
- `remixOfVersionId` accepted-but-ignored（Remix deferred 至加分轮）。
- 点赞 / 收藏：`Like`/`Favorite` 数据模型 + 统计读出已在（详情页 `stats` 真计数），但写入端点 + UI deferred（故详情页 `liked/favorited` 暂不返回）。
- 内容审核 deferred；`PlayEvent.START` 未发（仅 LOAD/END/ERROR）。

**再给一周**：真接 GPT-5.5 跑真实质量产出 + ingest 喂 imageUrl；Remix；点赞/收藏写入 + UI；durable-step 续跑；OAuth 真跑通其一。

## 已知问题与限制

- Prompt Injection 仅基本边界，未做深度防御/内容审核（设计见 `docs/07`）。
- 沙箱为浏览器 iframe 隔离，非服务端 VM/容器级；headless 渲染（如启用）需受限无网环境。
- 确定性 mock 产出的游戏复杂度低于真实模型；演示真实质量需配 `MODEL_*`。
- 交付目标为本地 `docker compose`，无公网 URL（符合「本地完整启动方式」交付选项）。

## AI 协作记录（`CLAUDE.md` §9）

- **AI 工具**：Claude Code（Opus 4.8）为主要实现者，采用**双 session 接力**：build session 负责实现，独立 review session 做对抗式验收（红线核验 + 现场注入失败：停 MinIO、kill worker、A/B prompt 比对、多 agent 只读审计）。
- **关键 prompt / 方法**：以 `CLAUDE.md` 为主操作手册（5 条 Fatal 红线 + NEVER-CUT floor + 降级阶梯）；每个 checkpoint「先 plan，人确认，再写，逐条对验收 §7 自证」；贯穿原则「**docs 是最高标准**，代码达到 docs，欠交付的能力带日期 deferred 注明，绝不让代码静默低于 docs」。契约先行：`docs/` 为权威源，代码与 Zod 契约（`src/lib/contracts/`）由其派生。
- **AI 贡献比例**：实现代码 + 文档基本由 AI 在人类方向下产出；人类负责战略/范围/契约拍板与每轮验收门禁。
- **review / test 方法**：每轮 build → 本地 `docker compose up --build` 逐条 §7 自证 → review session 对抗式验收（ACCEPT / ACCEPT-WITH-FIXES）→ 修复轮（实现或带日期 deferred）→ 再验收 → 一次性 PR 合并。修复轮另跑一轮多 agent 对抗式只读核验（试图证伪每个修复）。
- **人工修过的典型问题**（review 真实发现，已修）：PACKAGER 先建库后上传 → 失败留孤儿 DRAFT Game（改为先上传后原子 `$transaction`）；`assetIds` 未校验归属（IDOR 存在性预言机 → owner 作用域 + 403）；进程内 watchdog 随 worker 死 → 任务卡 RUNNING（加启动 reaper + BullMQ stalled 收口）；BullMQ 自带嵌套 ioredis 致类型冲突（改传连接选项对象）；Next standalone 漏 BullMQ 的 `.lua` 命令脚本（`outputFileTracingIncludes` 补回）。

## 提交与协作

Conventional Commits；逐 checkpoint 有意义提交（≥3）。协作打法见 [`协作打法.md`](协作打法.md)。本地验证以 `docker compose up` 为准。
