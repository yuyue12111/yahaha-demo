# Yahaha — AI Native 互动游戏平台 MVP

玩家从发现到游玩、创作者从创意到发布的**全闭环**：
**注册/登录 → Create（异步多 Agent 生成）→ 预览 → 发布 → Home（查库）→ Play（远端产物跨域隔离运行）**。

参考 Astrocade / moonshot.ai。契约见 [`docs/`](docs/)，规则见 [`CLAUDE.md`](CLAUDE.md)。

> **本 README 同时是交付说明**：下方「交付提交项一览」逐条对应提交清单；「五条红线 + 冷启动验收」给出可复现证据。

---

## 交付提交项一览

| 提交项 | 内容 |
|---|---|
| **源码仓库** | https://github.com/yuyue12111/yahaha-demo · Conventional Commits，**127 次提交**（远超 ≥3），分阶段清晰可追 |
| **Demo 地址** | 仅本地运行（公网 URL 不在范围）→ 见「快速开始」一条命令 |
| **启动命令** | `docker compose up --build`（起前端/后端/数据库/Redis/MinIO 全依赖，自动建桶/CORS/迁移/seed） |
| **测试数据** | seed 自动插 **3 个已发布游戏，含 1 个由 Create 流程真跑生成并发布** |
| **环境变量** | [`.env.example`](.env.example) 列出全部必需变量 + 用途，**无真实密钥**；无 key 默认 mock 跑通 |
| **系统设计文档** | [`docs/`](docs/) 11 份契约（架构图/核心接口/数据模型/Agent工作流/远端产物协议/安全方案+已知问题…）→ 见「系统设计文档」 |
| **技术栈** | 见「技术栈」 |
| **完成度说明** | 已完成 / Mock / 未完成 + 1 周迭代 → 见「完成度说明」 |
| **测试与验证证据**（可选） | 冷启动五红线验收（无密钥 mock）→ 见「五条红线 + 冷启动验收」 |
| **AI 协作记录**（可选） | 见「AI 协作记录」 |
| 演示视频（可选） | 未提供 |

---

## 快速开始（一条命令）

```bash
cp .env.example .env      # 可选；无需任何真实密钥
docker compose up --build
```

一条命令起全部：`postgres` + `redis` + `minio` + 一次性 `minio-init`（自动建桶 / 公共读 / 设 CORS）+
一次性 `seed`（`prisma migrate deploy` 迁移 + 插 2 个预制游戏 + **真跑一次 Create 流水线**产第 3 个并发布）+ `web` + 独立 `worker`。

- 应用首页：<http://localhost:3000>
- MinIO 控制台：<http://localhost:9001>（`minioadmin` / `minioadmin`）
- **无需真实模型 key**：compose 已注入所需 env，缺省 `mock` 模式离线复现整条链路（确定性、异输入异产物）。
- 预置账号（可直接登录体验）：`studio@yahaha.dev` / `yahaha-demo`；或点登录页「Demo OAuth」无密钥演示第三方登录。
- **接真实模型**：`.env` 设 `MODEL_PROVIDER=openai`（或 `codex`）+ `MODEL_BASE_URL`（OpenAI 兼容 `/chat/completions`）+ `MODEL_API_KEY` + `MODEL_NAME`，`docker compose up -d worker` 重启即生效，**零改代码**。seed 与缺省恒 `mock` → 无 key 冷启动仍可复现（红线⑤不破）。

## 核心链路验证（<5 分钟演示脚本）

1. **Home 来自 DB（非写死数组）**：首页 ≥3 个游戏，其中 1 个由 Create 流水线真产出（seed 自动跑）。
2. **Play 远端加载 + 隔离**：点任一卡片 → 详情 →「立即游玩」。Network 看产物从 `localhost:9000`（MinIO，**异端口跨域**）加载；页面有 `Source: <远端 URL>` 徽章；iframe `sandbox="allow-scripts"` **无** `allow-same-origin`（opaque origin）。
3. **Auth 抗刷新**：登出态访问 `/create` 跳登录；登录后 F5 仍在线（httpOnly JWT cookie）。
4. **Create 异步多 Agent → 发布闭环**：`/create` 输入创意（可附图）→ `POST /api/tasks` **202 立返 taskId** → SSE 实时看 `INGEST→PLANNER→ASSET_CURATOR→CODER→VALIDATOR→PACKAGER` 步骤流（每节点独立 IO + 耗时）→ 跨域 sandbox 预览 → **发布** → 回 Home 出现新卡片 → 进 Play 可玩。
5. **加分体验**：详情页 点赞/收藏/✦ Remix/**✨ 自然语言微调**（一句话改现有游戏出新版本）；`/me?tab=tasks` 生成记录（状态/token 成本/失败重试/查看产物）。

> 失败有错误态（不白屏）；MinIO 抖动 → 任务 `FAILED` + 失败节点 ERROR 日志 + `retry`；worker 崩溃 → reaper 回收，不卡 RUNNING。

## 五条 Fatal 红线 + 冷启动验收

每条红线都有**代码层强约束**；并经一次**全量冷启动验收**（`docker compose down -v && up --build`，`MODEL_PROVIDER=mock` 模拟评审无密钥场景）逐条取证，**全部 0 破**：

| # | 红线（失败条件） | 守卫 + 冷启动验收证据 |
|---|------|------|
| 1 | 对象存储用本地 fs 套壳 | 所有 S3/fs 访问只在 [`src/lib/storage.ts`](src/lib/storage.ts)；eslint `no-restricted-imports` 全局禁 `fs`/`@aws-sdk`。**验**：全仓 grep 仅命中 `storage.ts`；产物 entryUrl 直连 MinIO `:9000` → HTTP 200。切真 AWS S3/OSS 仅改 env（endpoint/creds/path-style），代码零改 |
| 2 | Play 跑本地写死组件 | 宿主零游戏专属码；`iframe.src` = 远端 MinIO URL（非 srcdoc）；跨域 sandbox。**验**：`src=http://localhost:9000/yahaha/games/<id>/1/index.html`、`sandbox="allow-scripts"`（**无** `allow-same-origin`）、Source 徽章显示 MinIO URL、非白屏 |
| 3 | 生成是固定假数据 | `ModelClient` seam；mock 按 `hash(prompt+assets)` 播种。**验**：异输入异产物（太空=dodge/187 ≠ 海洋=catch/139）、同输入同产物（确定性可复现）、真 GPT-5.5 seam（`openai.ts`）已接通 |
| 4 | 同步 + 单次黑盒生成 | `POST /api/tasks` 写库+enqueue 后 **202 立返**；**独立 worker 进程**消费。**验**：Create 任务有 **6 个 Agent 节点**各带独立 IO 摘要 + 延迟（AgentLog） |
| 5 | 没 README / 起不来 / 复现不了 | 一条 `docker compose up` 起全部。**验**：**迁移自动应用**（含最新 DEMO/mode 迁移）、seed「2 手作 + 1 Create = 3 已发布」、`.env.example` 无密钥、**无 key 也 mock 跑通** |

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js 15（App Router, TS, RSC）+ React 19 + Tailwind v3.4（shadcn 风格）+ 自研像素霓虹品牌 |
| 后端 | Next.js Route Handlers（Node runtime）+ **独立 Node worker**（tsx，BullMQ 消费） |
| 数据库 | PostgreSQL 16 + Prisma 6（schema 由 `docs/02` 派生，迁移可复现） |
| 对象存储 | **MinIO**（S3 兼容）+ `@aws-sdk/client-s3` v3；fs/S3 访问只在 `storage.ts`，切真 OSS 仅改 env |
| Agent 框架 | 自研 **6 节点 durable pipeline**（可重试 + per-step IO 日志 + SSE 进度 + reaper）+ 可插拔 `ModelClient` seam + BullMQ + Zod 契约 |
| 模型服务 | `ModelClient`：默认 `mock`（确定性、输入敏感、离线）/ `OpenAICompatibleClient`（真 GPT-5.5，`/chat/completions` + vision `image_url`） |
| 鉴权 | NextAuth v5（JWT）：邮箱登录 + env-gated Google/GitHub OAuth + 本地 Demo OAuth IdP（无密钥端到端演示） |
| 部署 | Docker Compose（一条命令，digest-pin 镜像可复现） |

详见 [`docs/01-architecture.md`](docs/01-architecture.md)。

## 系统设计文档

- [`docs/00-overview.md`](docs/00-overview.md) — 产品总览、角色旅程、范围、评分映射
- [`docs/01-architecture.md`](docs/01-architecture.md) — **架构图**、技术栈、部署拓扑、端口
- [`docs/02-data-model.md`](docs/02-data-model.md) — **数据模型**（→ `prisma/schema.prisma`）
- [`docs/03-api-contract.md`](docs/03-api-contract.md) — **核心接口**（REST + SSE）
- [`docs/04-agent-workflow.md`](docs/04-agent-workflow.md) — **Agent 工作流**（6 节点状态机、模型 seam、CODER 两种实现）
- [`docs/05-remote-artifact-protocol.md`](docs/05-remote-artifact-protocol.md) — **远端产物协议**（manifest、布局、版本、完整性）
- [`docs/06-play-runtime-contract.md`](docs/06-play-runtime-contract.md) — Play 运行时（iframe sandbox、postMessage、证明远端）
- [`docs/07-security.md`](docs/07-security.md) — **安全方案 + 已知问题**
- [`docs/08-observability-and-failure-recovery.md`](docs/08-observability-and-failure-recovery.md) — 可观测性与失败恢复
- [`docs/09-conventions.md`](docs/09-conventions.md) — 工程约定
- [`docs/10-design-system.md`](docs/10-design-system.md) — 设计系统 / 视觉基调

## 完成度说明

**已实现（真实，非 Mock）**
- **全闭环**：Auth（邮箱注册/登录/登出、JWT httpOnly 抗刷新、`/create`+`/me` 中间件+服务端双守卫、失效会话干净 401）→ Create（多模态输入、presigned 直传、异步 6 节点流水线、SSE run-timeline、跨域预览）→ 发布 → Home（查库）→ Play（远端 manifest/bundle 隔离运行，四态 loading/loaded/failed/ended）。
- **登录加分**：Google/GitHub OAuth（env-gated，配齐凭据即真跑通账号绑定）+ **本地 Demo OAuth IdP**（无密钥端到端演示「授权回调 + 账号绑定」，走与 Google/GitHub 完全相同的 NextAuth 回调 + `linkOAuthAccount` 代码路径）。
- **Home 加分**：详情页 `/games/:id` + 搜索 + 可点标签筛选 + 最新/最热排序 + 游标分页 + **点赞/收藏**（幂等切换 + 真计数）+ 游玩次数统计。
- **Play 加分**：`controls` 玩法提示透传；`PlayEvent`（LOAD/END/ERROR）→ `playCount`；加载优化（preconnect MinIO 源）。
- **Create 加分**：**生成任务历史**（`/me?tab=tasks`，含 token **成本统计** + 估算美元 + 失败重试）、**Remix 派生**、**版本管理**（作者一键发布草稿 / 生成新版本）、owner-scoped 作者管理（改 meta / 下架 / 删除含清 MinIO 产物）、**自然语言微调（refine）**（一句话定向编辑现有 game.js → 新版本自动发布）。
- **真像素 vision（已闭合）**：`ingest.ts` 对图片素材从 MinIO 读真字节（`storage.getObjectBytes`，守红线①）→ 内联 base64 data URL 传 `vision({imageUrl})` → 接真 GPT-5.5 **真读上传像素**；mock 仍按 hint/seedKey 确定性。
- **安全加分**：跨域沙箱隔离 + 产物 CSP（`connect-src 'none'`）+ 颜色白名单 + 上传限额/签名绑长度 + per-user 速率限额（Redis）+ **内容审核**（生成前禁词拦截 422）+ 站点安全 headers + 失效会话存在性再校验。
- **失败恢复**：节点内修复重试、任务超时看护、MinIO 抖动失败态 + retry、worker 崩溃 reaper 回收、PACKAGER 原子写无孤儿、assetIds 越权 403。
- **可复现**：一条 `docker compose up` 冷启动出 ≥3 已发布游戏（含 1 个 Create 真产出），迁移自动应用，`.env.example` 无密钥。

**Mock / 可选开关（诚实口径）**
- **模型默认 `mock`**（确定性、输入敏感）：无密钥时全链路可复现，**非固定假数据**（异输入异产物，真模型 seam 已接通）。填 `MODEL_*` 即切真 GPT-5.5。
- **CODER 默认 `template`**（`CODER_MODE`，秒级确定性引擎，验收快稳；模型仍参与 PLANNER 出 spec → 配色/标题/玩法随输入变）。`CODER_MODE=auto` 开启后真 GPT-5.5 **真写整个 game.js**（已实测生成「地铁跑酷 Neon Subway Runner」复杂游戏），但慢 ~1–2min，仅 demo 用。
- OAuth Google/GitHub 需真实 OAuth App 凭据才能真跑（红线⑤禁提交密钥）；**Demo OAuth IdP** 已可无密钥演示同一套回调+绑定。
- 封面走调色板 SVG 缩略图（降级阶梯）；Validator headless 截图为可选未启。

**未实现 / deferred**
- 公网部署 URL、演示视频。
- 社交（关注/粉丝）、平台级 admin（仅 owner-scoped；`User.role` 未建）、深层 Remix 血缘（`remixOfVersionId` accepted-but-ignored）、durable-step 续跑、VALIDATOR AST 解析、`PlayEvent.START`。

**再给一周**
1. **真模型默认化 + 提速**：把 code-gen CODER（流式 + 更小目标 + 并行校验）做成默认，让"每个游戏都不一样"成为默认体验。
2. **自然语言微调产品化**：Create 内连续对话式迭代（多轮 + 版本 diff/回滚 + 即时预览切换）。
3. **公网部署**：一键 Vercel(web) + 托管 Postgres/Redis/S3，给出真实 Demo URL。
4. **Play/社交**：移动端手势、排行榜、玩后"再来一个"、关注体系、作者公开页。
5. **可观测性**：生成成本/时延 dashboard、Agent 节点失败热力图。

## 已知问题与限制

- Prompt Injection 仅基本边界 + 禁词审核，未做语义级深度防御（设计见 `docs/07`）。
- 沙箱为浏览器 iframe 隔离，非服务端 VM/容器级；headless 渲染（如启用）需受限无网环境。
- 默认 `template` CODER 产出复杂度低于真实 code-gen；演示复杂游戏需 `CODER_MODE=auto` + 真 `MODEL_*`（较慢）。
- 交付目标为本地 `docker compose`，无公网 URL（符合「本地完整启动方式」交付选项）。

## AI 协作记录（`CLAUDE.md` §9）

- **AI 工具**：Claude Code（Opus 4.x）为主要实现者，**双 session 接力**：build session 实现，独立 review session 对抗式验收（红线核验 + 现场注入失败：停 MinIO、kill worker、A/B prompt 比对、多 agent 只读审计）。
- **关键 prompt / 方法**：以 `CLAUDE.md` 为主操作手册（5 条 Fatal 红线 + NEVER-CUT floor + 降级阶梯）；每 checkpoint「先 plan、人确认、再写、逐条对验收自证」；贯穿「**docs 是最高标准**，代码达到 docs，欠交付能力带日期 deferred 注明」。契约先行：`docs/` 为权威源，Zod 契约（`src/lib/contracts/`）由其派生。多轮 ultracode 多 Agent 并行审计（18–41 agent + 对抗验证，把"高危发现"诚实降级）。
- **AI 贡献比例**：架构/代码/文档/测试与验收脚本 **~95%** 由 AI 在人类方向下产出；人类负责需求拍板、方向纠偏与 PR/合并门禁。
- **review / test 方法**：每轮 `tsc` + 本地 `docker compose` 冷启动逐条自证 + Chrome 驱动 live 验收（截图/DOM 取证）+ worker 内探针直跑产线函数（`runIngest`/`runGeneration`）+ 多 agent 对抗式只读核验。
- **人工修过的典型问题**：① "所有游戏长一样" → 定位 CODER 是模板（非模型），引入 code-gen 后又因太慢改回模板默认 + 留可选开关；② 草稿"查看产物"GAME_NOT_FOUND → 修链接 + 加发布入口；③ 入场动画搜索时重播 → 路径门控 + 存储语义修正；④ 真模型 code-gen 超时 → 单次调用 AbortController + 预算回退；⑤ PACKAGER 孤儿 DRAFT → 先上传后原子 `$transaction`；⑥ `assetIds` IDOR → owner 作用域 + 403；⑦ watchdog 随 worker 死卡 RUNNING → 启动 reaper + BullMQ stalled 收口。

## 提交规范

Conventional Commits；逐 checkpoint 有意义提交（**127 次**，远超 ≥3）。本地验证以 `docker compose up` 为准。协作打法见 [`协作打法.md`](协作打法.md)。
