# 03 · API 契约（REST + SSE）

> 所有请求/响应体在边界用 Zod 校验（`src/lib/contracts/`）。错误用统一信封；鉴权用 NextAuth JWT cookie。
> 约定：成功 2xx；校验失败 422；未登录 401；越权 403；找不到 404；冲突 409。base = `/api`。

## 统一错误信封

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "human readable", "details": {} } }
```
`code` 取值：`VALIDATION_ERROR` `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `CONFLICT` `RATE_LIMITED` `INTERNAL`。

## 鉴权 Auth

| 方法 | 路径 | 鉴权 | 请求 | 响应 |
|------|------|:----:|------|------|
| POST | `/api/auth/register` | 否 | `{ email, password, displayName }` | 201 `{ user:{id,email,displayName} }` · 409 邮箱已注册 · 422 |
| POST | `/api/auth/callback/credentials` | 否 | NextAuth 凭证登录 | 设置 session cookie · 401 |
| POST | `/api/auth/signout` | 是 | — | 清 session |
| GET | `/api/me` | 是 | — | 200 `{ user }` · 401 |

- 密码：argon2id（或 bcrypt）哈希存 `User.passwordHash`。
- session：JWT 存 httpOnly cookie，**刷新后仍可识别**（F5 必测）。
- OAuth（Google/GitHub）：路由结构与回调由 Auth.js 提供；缺省 env 时关闭，仅保留数据模型（`Account`）与设计（见 `07-security.md` 与下文"OAuth 扩展"）。

## 游戏 Games

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|:----:|------|
| GET | `/api/games` | 否 | 查询：`?status=published&search=&tag=&sort=newest\|popular&cursor=` → `{ items: GameCard[], nextCursor? }` |
| GET | `/api/games/:id` | 否 | `{ game, author, activeVersion, stats:{likes,favorites,playCount}, liked?, favorited? }` |
| GET | `/api/games/:id/active-version` | 否 | **Play 用**：`{ versionId, versionNumber, runtime, manifestUrl }`（manifestUrl 为 MinIO 源 URL）· 404 |
| POST | `/api/games/:id/publish` | 是(作者) | body `{ versionId }` → 置 `status=PUBLISHED`、`activeVersionId`、`publishedAt`；version 置 `PUBLISHED` |
| POST | `/api/games/:id/like` / DELETE 同路径 | 是 | 点赞/取消（加分） |
| POST | `/api/games/:id/favorite` / DELETE 同路径 | 是 | 收藏/取消（加分） |

`GameCard` = `{ id, title, summary, coverUrl, tags, author:{id,displayName}, publishedAt, playCount }`。

## 上传 Uploads（presigned 直传，绝不经 app 落盘）

| 方法 | 路径 | 鉴权 | 请求 | 响应 |
|------|------|:----:|------|------|
| POST | `/api/uploads/presign` | 是 | `{ filename, contentType, bytes }` | 200 `{ assetId, key, putUrl, getUrl, expiresIn }` · 413 超 `MAX_UPLOAD_BYTES` · 415 类型不允许 |

流程：① 调本接口拿 `putUrl`（presigned PUT，写 `uploads/{userId}/{assetId}.{ext}`，先建 `Asset(UPLOAD)` 占位）→ ② 浏览器 `PUT putUrl` 直传 MinIO → ③ 提交任务时把 `assetId` 放进 `inputAssetIds`。
允许的 contentType：`image/*`、`video/mp4`、`text/plain`、`application/json`（见 `07-security.md`）。

## 生成任务 Tasks（异步多 Agent 核心）

| 方法 | 路径 | 鉴权 | 请求 | 响应 |
|------|------|:----:|------|------|
| POST | `/api/tasks` | 是 | `{ prompt, assetIds?: string[], gameId?, remixOfVersionId? }` | **202** `{ taskId, status:"PENDING" }`（写 task + enqueue 后**立即返回**，绝不阻塞跑模型） |
| GET | `/api/tasks/:id` | 是(本人) | — | `{ task, logs: AgentLog[] }`（轮询兜底） |
| GET | `/api/tasks/:id/stream` | 是(本人) | — | **SSE**，见下 |
| POST | `/api/tasks/:id/retry` | 是(本人) | — | 202 `{ taskId }`（从失败节点重排，加分/失败恢复） |

### SSE 事件契约（`text/event-stream`）

worker 经 Redis pub/sub 发布，本端点中继。事件名 + JSON data：

| event | data | 含义 |
|-------|------|------|
| `status` | `{ status: TaskStatus, currentStep?: AgentName }` | 任务状态流转 |
| `step` | `{ agentName, seq, title, state:"start"\|"end", level }` | 节点开始/结束 |
| `log` | `{ seq, agentName, title, inputSummary?, outputSummary? }` | 可读步骤日志 |
| `done` | `{ status:"SUCCEEDED"\|"FAILED", versionId?, manifestUrl?, error? }` | 终态，前端关闭流 |

> 任一时刻前端都能用 `GET /api/tasks/:id` 重建当前状态（SSE 仅为体验增强，可降级为轮询）。

## 游玩埋点 Play events（加分）

| 方法 | 路径 | 鉴权 | 请求 | 响应 |
|------|------|:----:|------|------|
| POST | `/api/play-events` | 否（匿名可） | `{ gameId, versionId?, type, score?, durationMs? }` | 204；`START` 时 `Game.playCount++` |

## 受保护路由（页面级）

`/create`（及其子路由）需登录：middleware + 服务端 session 校验，未登录跳 `/login?next=/create`。

## OAuth 扩展（设计，demo 可不真接）

- 数据模型：`Account(provider, providerAccountId, userId, tokens)` 与 `User` 解耦，支持一个 user 绑多 provider。
- 流程：`/api/auth/signin/{google|github}` → provider 授权 → `/api/auth/callback/{provider}` → 按 `providerAccountId` 查 `Account`：命中则登录；未命中且同邮箱已存在则**绑定**（建新 `Account` 关联现有 `User`），否则建新 `User`+`Account`。
- 开关：填 `GOOGLE_*`/`GITHUB_*` env 即启用；缺省关闭。
