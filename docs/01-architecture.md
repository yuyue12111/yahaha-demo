# 01 · 系统架构与技术栈

## 技术栈表（交付物 3.3 要求）

| 层 | 选型 | 说明 |
|----|------|------|
| 前端 | Next.js（App Router, React, TS）+ Tailwind + shadcn/ui + TanStack Query + Zustand | SSR/RSC 做 Home/详情；客户端组件做 Create/Play 交互 |
| 后端 | 同一 Next.js 应用的 Route Handlers（`app/api/*`）+ 独立 Node worker | 共享 `src/lib`，零语言边界 |
| 鉴权 | NextAuth (Auth.js v5) | Credentials(邮箱) + OAuth(Google/GitHub) 设计；JWT session cookie |
| 数据库 | PostgreSQL + Prisma | 单一真源；见 `02-data-model.md` |
| 队列/异步 | BullMQ + Redis | 独立 worker 进程消费；自带重试/退避/事件 |
| 对象存储 | MinIO（S3 兼容）+ `@aws-sdk/client-s3` v3 | 仅经 `src/lib/storage.ts`；presigned PUT/GET |
| Agent 框架 | TS 自研类型状态机（多节点 + 失败重试 + durable step） | 见 `04-agent-workflow.md`；文档点名 LangGraph.js 为升级路径 |
| 模型服务 | 可插拔 `ModelClient`（codex/openai/anthropic/mock） | 默认 Yahaha GPT-5.5；缺省 mock 可离线复现 |
| 运行时隔离 | 跨域 sandbox iframe（`allow-scripts`，无 `allow-same-origin`） | 产物从 MinIO 源加载；见 `06-play-runtime-contract.md` |
| 部署 | Docker Compose（单 Dockerfile 多阶段，web/worker 共享镜像） | 一条 `docker compose up`，自动建桶/CORS/迁移/seed |

## 组件与协作

```
                         ┌─────────────────────────────────────────────┐
  浏览器                 │                Next.js (app :3000)            │
  ┌──────────┐  HTTP/SSE │  RSC 页面: Home / 详情 / Create / Play         │
  │ Home/Play│◀─────────▶│  Route Handlers: /api/auth /api/games          │
  │ Create   │           │   /api/uploads/presign /api/tasks /api/...     │
  └────┬─────┘           │  共享 src/lib: contracts(zod) / db / storage / │
       │ presigned PUT   │   queue / model / agents                       │
       │ (直传)          └───┬───────────┬───────────────┬────────────────┘
       │                     │ enqueue    │ Prisma         │ S3 SDK
       ▼                     ▼            ▼                ▼
  ┌──────────┐         ┌──────────┐  ┌──────────┐    ┌──────────────┐
  │  MinIO   │◀────────│  Redis   │  │ Postgres │    │   MinIO      │
  │ :9000    │ 产物直读 │ BullMQ   │  │ :5432    │    │  (同一实例)  │
  │ (跨域源) │         └────┬─────┘  └────┬─────┘    └──────────────┘
  └──────────┘              │ consume     │ 写 meta/log
       ▲                    ▼             ▲
       │ 上传产物      ┌─────────────────────────────┐
       └───────────────│   Node worker (同镜像)       │
                       │  BullMQ 消费 → Agent 状态机   │
                       │  INGEST→PLANNER→...→PACKAGER  │
                       │  ModelClient → GPT-5.5/mock   │
                       └─────────────────────────────┘
```

## 关键数据流

1. **上传**：浏览器向 `/api/uploads/presign` 要 presigned PUT，**直传 MinIO**（不经 app 落盘）；仅 S3 key 入 `Asset` 表。
2. **生成（异步）**：`POST /api/tasks` 写 `GenerationTask(PENDING)` + enqueue BullMQ → **立即 202 返回 taskId**。
3. **worker**：消费任务 → 跑状态机，每节点写 `AgentLog` + 发 Redis pub/sub；Packager 组 bundle 上传 MinIO 版本化路径 → 写 `Version` → 任务 `SUCCEEDED`。
4. **进度**：Create 页经 SSE(`/api/tasks/:id/stream`) 实时显示步骤；TanStack Query 轮询兜底。
5. **发布**：`POST /api/games/:id/publish` 置 `Game.status=PUBLISHED` 并指 `activeVersionId`。
6. **Home**：`GET /api/games?status=published` 查库渲染。
7. **Play**：`GET /api/games/:id/active-version` 取 `manifestUrl`（MinIO 源）→ 跨域 sandbox iframe 加载并隔离运行。

## 部署拓扑（docker compose 服务）

| 服务 | 镜像/构建 | 端口 | 职责 |
|------|-----------|:----:|------|
| `web` | 本仓 Dockerfile | 3000 | Next.js（UI + API），启动时跑 `prisma migrate deploy` |
| `worker` | 同镜像，不同 command | — | BullMQ 消费 + Agent 状态机 |
| `db` | postgres:16 | 5432 | 数据库 |
| `redis` | redis:7 | 6379 | 队列 + pub/sub |
| `minio` | minio/minio | 9000 / 9001 | S3 兼容对象存储 + 控制台 |
| `minio-init` | minio/mc（一次性） | — | 建桶 `yahaha`、设公共读前缀（`games/*`）、预置 seed bundle（CORS 由 `minio` 服务 env `MINIO_API_CORS_ALLOW_ORIGIN` 提供，非此处） |
| `seed` | 同 web 镜像（一次性，依赖健康检查） | — | 迁移后插入 ≥3 游戏并**真跑一次 Create pipeline** 产出 ≥1 个 |

**迁移到真实 OSS**：仅改 `S3_ENDPOINT/S3_PUBLIC_ENDPOINT/凭证/S3_FORCE_PATH_STYLE=false`，代码零改动（MinIO 说 S3 协议）。

## 进程边界与共享

- `web` 与 `worker` 是**不同进程/容器**（满足"异步、非阻塞、独立消费者"）。
- 二者共享 `src/lib`：`contracts/`（Zod，单一真源）、`db.ts`（Prisma）、`storage.ts`（S3，唯一 fs/S3 出入口）、`queue.ts`（BullMQ）、`model/`（ModelClient）、`agents/`（状态机）。
