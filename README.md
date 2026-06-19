# Yahaha — AI Native 互动游戏平台 MVP

玩家从发现到游玩、创作者从创意到发布的全闭环：**登录 → Create（异步多 Agent 生成）→ 发布 → Home → Play（远端产物隔离运行）**。

> 状态：**脚手架 / 契约阶段**。下方启动命令在实现完成后填实（占位见 TODO）。
> 设计与契约见 [`docs/`](docs/)；AI 协同规则见 [`CLAUDE.md`](CLAUDE.md)。

## 技术栈

前端/后端：Next.js（App Router, TS）· 数据库：PostgreSQL + Prisma · 队列：BullMQ + Redis ·
对象存储：MinIO（S3 兼容）+ AWS SDK v3 · Agent：TS 自研状态机（多节点 + 失败重试）·
模型：可插拔 `ModelClient`（默认 Yahaha GPT-5.5 / 缺省 mock）· 部署：Docker Compose。
详见 [`docs/01-architecture.md`](docs/01-architecture.md)。

## 快速开始（TODO：实现后填实）

```bash
cp .env.example .env          # 无需真实模型 key，缺省 mock 模式可完整跑通
# docker compose up --build   # 起 web/worker/postgres/redis/minio，并自动建桶/CORS/迁移/seed
# 访问 http://localhost:3000        应用
# 访问 http://localhost:9001        MinIO 控制台 (minioadmin/minioadmin)
```

## 核心链路验证（<5 分钟演示脚本，见 plan 第四节 / docs/00-overview.md）

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
