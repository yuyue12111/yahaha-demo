# 09 · 工程约定

## 目录结构（目标）

```
/
├── docker-compose.yml          # web/worker/db/redis/minio/minio-init/seed
├── Dockerfile                  # 多阶段，web 与 worker 共用
├── .env.example                # 环境变量契约（无密钥）
├── .gitignore                  # 忽略 .env / node_modules / .next 等
├── README.md  CLAUDE.md
├── docs/                       # 本设计文档 + 契约（权威源）
├── prisma/
│   └── schema.prisma           # 由 docs/02 派生
├── scripts/
│   └── seed.ts                 # 插入 ≥3 游戏，含真跑一次 Create pipeline
├── public/                     # 仅站点静态资源；★ 绝不放游戏产物（产物必须在 MinIO）
└── src/
    ├── app/                    # Next.js App Router：页面 + app/api/* Route Handlers
    │   ├── (marketing)/        # Home / 详情
    │   ├── play/[id]/          # Play（通用 loader，零游戏专属代码）
    │   ├── create/             # Create（受保护）
    │   ├── login/ register/
    │   └── api/                # auth / games / uploads / tasks / play-events
    ├── components/             # UI（shadcn/ui）
    ├── lib/
    │   ├── contracts/          # ★ Zod schemas（运行时单一真源；app 与 worker 共享）
    │   ├── storage.ts          # ★ 唯一碰 S3/fs 的文件
    │   ├── db.ts               # Prisma client 单例
    │   ├── queue.ts            # BullMQ 队列/连接
    │   ├── auth.ts             # NextAuth 配置
    │   ├── model/              # ModelClient 适配器（codex/openai/anthropic/mock）
    │   └── agents/             # 状态机 + 节点（INGEST…PACKAGER）
    └── worker/
        └── index.ts            # worker 进程入口（消费 BullMQ）
```

## 代码规则（硬约束，对应雷区守卫）

1. **存储边界**：`fs` / `@aws-sdk/client-s3` 只允许出现在 `src/lib/storage.ts`。
   eslint：`no-restricted-imports` 禁止他处 import `fs`、`fs/promises`、`node:fs`。`public/` 绝不存游戏产物。
2. **契约边界**：所有 HTTP / SSE / Agent IO / postMessage / manifest 在边界用 `src/lib/contracts/` 的 Zod 校验。
3. **进程边界**：生成走队列；`POST /api/tasks` 写库+enqueue 后**立即 202**，绝不在请求内跑模型。
4. **Play 边界**：宿主无游戏专属组件；`iframe.src` = 远端 URL；`sandbox="allow-scripts"` 无 `allow-same-origin`；无 `srcdoc` 内联。
5. **模型边界**：经 `ModelClient`；mock 必须输入敏感；key 仅服务端。
6. TypeScript strict；公共边界显式类型；优先复用 `src/lib`，避免重复实现。

## 命名

- 文件：组件 `PascalCase.tsx`，其余 `kebab-case.ts`。
- 枚举值全大写下划线（`GameStatus.PUBLISHED`）。
- S3 key / postMessage / manifest 字段名见 `CLAUDE.md §5`（权威命名），不得各处发明别名。

## Git / 提交

- `.env` 等密钥**不入库**；`.gitignore` 覆盖 `.env`、`node_modules`、`.next`、`dist`。
- Conventional commits：`feat:` `fix:` `docs:` `chore:` `refactor:` `test:`。
- **≥3 次有意义提交**（rubric 硬要求）。建议节点见 `CLAUDE.md §8`。

## 运行（实现后在 README 填实）

- 一键：`cp .env.example .env && docker compose up --build`。
- 本地裸跑（开发，本机无 Docker 时）：brew 起 postgres@16/redis/minio + `mc` 建桶设 CORS → `pnpm prisma migrate dev` → `pnpm dev`（web）+ `pnpm worker`（worker）→ `pnpm seed`。

## 文档同步

契约改动**先改 `docs/`** 再改代码；`CLAUDE.md §4` 契约索引与 `§5` 权威命名是单一真源，新增字段/端点/枚举须同步更新。
