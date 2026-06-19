# Yahaha — AI Native 互动游戏平台 MVP

玩家从发现到游玩、创作者从创意到发布的全闭环：**登录 → Create（异步多 Agent 生成）→ 发布 → Home → Play（远端产物隔离运行）**。

> 状态：**CP1 完成并通过验收** — 远端产物 + 跨域 sandbox Play loader + S3 存储边界。
> 后续 checkpoint：登录/注册（D1-PM）、异步多 Agent Create（D2）。契约见 [`docs/`](docs/)；规则见 [`CLAUDE.md`](CLAUDE.md)。

## 技术栈

前端/后端：Next.js（App Router, TS）· 数据库：PostgreSQL + Prisma · 队列：BullMQ + Redis ·
对象存储：MinIO（S3 兼容）+ AWS SDK v3 · Agent：TS 自研状态机（多节点 + 失败重试）·
模型：可插拔 `ModelClient`（默认 Yahaha GPT-5.5 / 缺省 mock）· 部署：Docker Compose。
详见 [`docs/01-architecture.md`](docs/01-architecture.md)。

## 快速开始

```bash
docker compose up --build     # 起 web + postgres + redis + minio + 一次性 minio-init（自动建桶/公共读/上传 seed bundle）
```

- 应用（CP1 Demo）：<http://localhost:3000/play/neon-dodger>
- MinIO 控制台：<http://localhost:9001>（minioadmin / minioadmin）
- 无需真实模型 key，也无需先 `cp .env.example .env`（compose 已注入所需 env）；缺省 mock 模式可离线跑通。

## 核心链路验证（<5 分钟演示脚本，见 plan 第四节 / docs/00-overview.md）

> 注：以下为**完整闭环**验收脚本。**CP1 当前可验证第 2 项（Play 远端加载 / 隔离）**；第 1/3/4 项随后续 checkpoint 落地。

1. Home 列表来自 DB（非写死数组），≥3 个游戏，≥1 来自 Create 流程。
2. 进 Play：DevTools Network 看产物从 `localhost:9000`（MinIO，异端口）加载；页面 "Source:&lt;URL&gt;" 徽章；iframe `sandbox="allow-scripts"` 无 `allow-same-origin`。
3. 登出态访问 `/create` 跳登录；登录后 F5 仍在线。
4. Create 输入创意+上传图 → POST 立返 taskId（异步）→ 实时看 Planner→Coder→Validator 步骤流 → 预览 → 发布 → 回 Home 出现并可游玩。

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
- [`docs/10-design-system.md`](docs/10-design-system.md) — 设计系统 / 视觉基调（颜色/渐变/字体/组件 token）

## 完成度说明（TODO：交付前填实）

已完成 / 未完成 / Mock 的部分，以及"再给一周"的迭代计划。
