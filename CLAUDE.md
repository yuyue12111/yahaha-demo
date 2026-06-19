# CLAUDE.md — Yahaha 平台 AI 协同操作手册

> 这是本项目的**主规则文件**。任何 AI 会话开始前先读它，再读 `docs/` 下被引用的契约。
> 代码必须服从 `docs/` 中的契约；契约变更必须先改 `docs/`，再改代码，二者保持同步。

## 0. 这是什么

2 天独立全栈测试：从零搭 **AI Native 互动游戏 Web 平台 MVP**（参考 Astrocade），打通
「登录/注册 → 创意生成(Create) → 发布 → 浏览游玩(Play)」完整闭环。

- 需求原文：`yahaha项目文档.md`
- 战略与栈分析：`~/.claude/plans/yahaha-md-2-foamy-rabin.md`
- GitHub：https://github.com/yuyue12111/yahaha-demo

## 1. 已锁定决策（不要再推翻）

- **技术栈 = Hybrid-A**：全 TypeScript 单体（Next.js 全栈 + Node worker，共享 `src/lib`），
  借鉴三处：① Validator 节点 headless 截图当封面（可选/可砍）② `ingest` 节点用 vision 让上传**真影响生成**
  ③ 每个 Agent 节点做成可重试 durable step + Create UI run-timeline 视图。
- **交付目标**：本地 `docker compose up` 可复现为**唯一**交付；公网 URL 不在范围（仅大幅领先时作可选 stretch）。
- 详见 `docs/01-architecture.md` 的技术栈表。
- **视觉基调**：方向 A 霓虹街机为底 + B 的克制（暗色 plum、双渐变 Play/Create、星形 logo）；token 见 `docs/10-design-system.md`。
- **环境**：开发机已装 Docker Desktop（PERSONAL/免费），Claude 的 Bash **可直接 `docker` / `docker compose`**。验证以 `docker compose up` 为准；brew 原生服务仅作可选的快速内循环。

## 2. 五条 Fatal 雷区与守卫（绝不能踩 = 3.4 倒读）

| # | 雷区 | 守卫（代码层强约束） |
|---|------|----------------------|
| 1 | 对象存储用本地 fs 套壳 | **所有** S3/fs 访问只允许出现在 `src/lib/storage.ts`；eslint `no-restricted-imports` 禁止他处 import `fs`/`fs/promises`。产物字节必须从 MinIO 源(`localhost:9000`)出。 |
| 2 | Play 跑本地写死/打包组件 | 宿主 app **零**游戏专属代码；Play 只有通用 loader；`iframe.src` 指向远端 MinIO URL（非 srcdoc/内联）。 |
| 3 | 生成是固定假数据 | LLM 走 `ModelClient` 接口，默认接 Yahaha GPT-5.5；mock 必须按 `(prompt+assets)` 哈希做种 → 异输入异输出。 |
| 4 | 同步 + 单次黑盒生成 | `POST /api/tasks` 必须 202 立返 taskId；独立 worker 进程消费；≥3 个有独立 IO 日志的 Agent 节点。 |
| 5 | 没 README / 起不来 / 复现不了 | 一条 `docker compose up` 起全部并自动建桶/CORS/迁移/seed；`.env.example` 无真密钥；**无 key 也能 mock 跑通**。 |

**绝不砍的底线（NEVER-CUT floor）**：真 MinIO + S3 SDK 且服务路径无 fs · 独立 worker 202 立返 ·
≥3 个有独立 IO 的 Agent 步骤 · 跨域 sandbox iframe（`allow-scripts` **不带** `allow-same-origin`）从 MinIO 加载 +
可见 "Source:&lt;URL&gt;" 徽章 + 非白屏失败态 · ≥3 seed 游戏（≥1 真 Create 产出）·
README + `.env.example`（无密钥）+ 一条 compose · session 抗 F5。

## 3. 高频隐性陷阱（看着完成其实踩雷）

- iframe 用 `srcdoc`/base64 内联远端 HTML → 网络面板看不到 MinIO 请求，无法证明远端。**必须 `iframe.src=远端 URL`**
  （导航请求，网络可见，且导航不受 CORS 限制；CORS 只在 fetch manifest/资源时才需要）。
- 存储"抽象"只接了 FsStorage，MinIO 在 compose 里没被用。
- "多 Agent" = 一次 LLM 调用外包几行假 `console.log` 步骤名。
- "异步"端点其实 await 跑完才返回 succeeded，没有可观测 pending/running 窗口。
- 全靠真 key 才能跑；`.env.example`（无密钥）下 Create 全报错。
- session 靠内存 React state，F5 掉登录。
- 封面/资源走 `/public` 而 `index.html` 走远端 → 部分本地产物仍踩 #1。

## 4. 契约索引（docs/ 为权威源，代码须符合）

| 契约 | 文件 | 一句话 |
|------|------|--------|
| 总览 / 范围 / rubric 映射 | `docs/00-overview.md` | 角色、旅程、MVP vs 加分、评分权重 |
| 系统架构 / 技术栈 | `docs/01-architecture.md` | 组件、数据流、部署拓扑、栈表、端口 |
| 数据模型 | `docs/02-data-model.md` | 实体/枚举/关系（→ 派生 `prisma/schema.prisma`） |
| API 契约 | `docs/03-api-contract.md` | REST + SSE 端点、请求/响应、状态码、鉴权 |
| Agent 工作流 | `docs/04-agent-workflow.md` | 状态机节点、IO 契约、模型 seam、日志、失败/重试 |
| 远端产物协议 | `docs/05-remote-artifact-protocol.md` | `manifest.json`、对象存储布局、版本、完整性 |
| Play 运行时契约 | `docs/06-play-runtime-contract.md` | iframe sandbox、postMessage 协议、状态、证明远端、CORS |
| 安全方案 | `docs/07-security.md` | 隔离、注入、任意代码执行、密钥、限额、上传 |
| 可观测性 / 失败恢复 | `docs/08-observability-and-failure-recovery.md` | 日志、Agent IO、任务态、恢复矩阵 |
| 工程约定 | `docs/09-conventions.md` | 目录结构、命名、代码规则、提交规范 |
| 设计系统 / 视觉基调 | `docs/10-design-system.md` | 颜色/渐变/圆角/字体/组件 token（→ Tailwind theme + shadcn） |

## 5. 权威命名（跨所有文件与代码必须一致）

- 端口：app `:3000`，MinIO S3 API `:9000`（**产物/沙箱源，与 app 跨域**），MinIO 控制台 `:9001`，Postgres `:5432`，Redis `:6379`。
- 对象存储桶：`yahaha`。
- 实体：`User` `Account` `Game` `Version` `Asset` `GenerationTask` `AgentLog` `Like` `Favorite` `PlayEvent`。
- Agent 节点链：`INGEST → PLANNER → ASSET_CURATOR → CODER → VALIDATOR → PACKAGER`（最小 3 节点回退：`PLANNER → CODER → VALIDATOR`）。
- postMessage：游戏→宿主 `GAME_LOADED` `GAME_SCORE` `GAME_ENDED` `GAME_ERROR`；宿主→游戏 `HOST_INIT` `HOST_RESTART`；协议 version `1`。
- manifest `schemaVersion`：`1`。API base：`/api`。
- 枚举值见 `docs/02-data-model.md`（全大写下划线，如 `GameStatus.PUBLISHED`）。

## 6. 代码约定（详见 `docs/09-conventions.md`）

- 语言：TypeScript strict；所有跨进程/网络边界用 **Zod** 校验（契约放 `src/lib/contracts/`，是运行时的单一真源，由 docs 派生）。
- `src/lib/storage.ts` 是**唯一**碰对象存储/`fs` 的地方。`src/lib/contracts/` 被 app 与 worker 共享 import。
- 不在 PR/提交里放真密钥；env 走 `.env.example` 契约。

## 7. 构建顺序（每半天一个可跑 checkpoint，详见 plan 文件第三节）

1. **D1 AM**：compose(pg+redis+minio+web+minio-init 自动建桶/CORS) + `storage.ts` 验通 + 手放静态 bundle + Play 跨域 sandbox 远端加载（含 loading/loaded/failed）。**先打通最难点**。
2. **D1 PM**：Prisma + NextAuth 邮箱注册/登录/登出(抗刷新, /create 受保护) + Home 查库列表 + seed 2 个预制游戏。
3. **D2 AM**：BullMQ + 独立 worker + 4~6 节点状态机 + ModelClient(GPT-5.5/mock) + per-step AgentLog + Create 多模态输入/SSE/预览。
4. **D2 PM**：发布→Home + seed 真跑一次 pipeline(≥1 Create 产出) + plus 功能 + README/.env.example/docs 收尾 + 冷启动验证。

## 8. 提交规范

- Conventional commits（`feat:` `fix:` `docs:` `chore:` …），**≥3 次有意义提交**（rubric 硬要求；少于 3 次不接受）。
- 建议提交节点：①docs/契约 ②scaffold+auth+storage+Play 远端加载 ③异步多 Agent 链路 ④Home/发布闭环+seed+收尾。
- **自动提交（用户已授权，durable）**：Claude 在每个有意义 checkpoint **自动提交，无需逐次确认**；
  消息用 Conventional Commits，并以 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 结尾。
  约束：仅在 checkpoint 完成且**不破坏构建**时提交；推送到远端仍需用户确认。协作细节见 `协作打法.md`。

## 9. AI 协作记录（rubric 可选加分）

在 `docs/` 或提交信息中记录：用的 AI 工具、关键 prompt、AI 贡献比例、review/test 方法、人工修过的典型问题。

## 10. 降级阶梯（落后时按序砍，不踩雷）

Chromium 截图→SVG 缩略图 · 真模型默认→mock 默认(留变化逻辑+真实 seam) · plus 功能(搜索/标签/点赞/收藏/统计/详情/Remix) ·
SSE→轮询 · Agent 节点收到 3 个 · OAuth 实现→只留 design+`Account` 表。**砍之前对照第 2 节底线。**
