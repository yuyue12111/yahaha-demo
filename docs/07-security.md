# 07 · 安全方案

> 附录"安全隔离"设计项：上传素材、Prompt Injection、任意生成代码执行、密钥保护、资源限制。
> MVP 给出真实可见的边界 + 设计叙事；标注哪些是设计/已实现/Mock。

## 1. 任意生成代码执行（最高风险，已用结构性手段兜住）

- **浏览器隔离**：生成的任意 JS **只**在跨域 sandbox iframe 运行（`allow-scripts`，无 `allow-same-origin` → opaque origin），无法触达宿主 cookie/token/DOM/localStorage。见 `06`。
- **产物 CSP**：manifest 自带 `connect-src 'none'`，阻断游戏外联/数据外泄；`default-src 'none'` 收紧默认。
- **服务端从不执行生成代码**：worker 只做静态校验/打包，可选 headless 渲染在受限无网容器内（截图用）。
- **postMessage 校验**：宿主按 **`event.source` 身份**（= 所挂 iframe 的 `contentWindow`）+ **先 Zod 校验外层信封**（`source:"yahaha-game"`、`v:1`）再 switch type；sandbox 帧 origin 为 `"null"`，**绝不**按 origin 断言。详见 `06`。
- **站点级 CSP + 安全 headers（已实现）**：`next.config.ts` `headers()` 下发 `frame-src 'self' <S3_PUBLIC_ENDPOINT>; frame-ancestors 'none'`（源走 env，限制可嵌入 iframe 的源为 MinIO 产物源、禁本站被内嵌），并附 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`（禁用 camera/mic/geo/payment）。均不影响游戏 iframe（frame-src 已显式允 MinIO）。

## 2. 上传素材

- 直传 MinIO presigned PUT（不经 app 落盘）；key 按 `uploads/{userId}/...` 隔离。
- 校验：`contentType` 白名单（`image/*`、`video/mp4`、`text/plain`、`application/json`）、`bytes ≤ MAX_UPLOAD_BYTES`。
- 上传对象**不被当作代码执行**；vision 仅做描述提取。
- 私有前缀，按需 presigned GET（短期）。

## 3. Prompt Injection

- 上传/文本视为**不可信数据**，在 prompt 中以清晰分隔/角色边界包裹，系统指令与用户内容分离。
- Agent 输出在打包前结构化校验（Zod / 解析 / 运行时契约存在性），不让模型输出直接决定特权操作。
- worker 无外发网络能力依赖（除模型端点白名单）；生成产物的 CSP 阻断其联网。
- 已知局限：完整的注入防御非 MVP 目标，列入"已知问题"。

## 4. 密钥保护

- 所有密钥走 env（`.env`，git 忽略）；仓库只提交 `.env.example`（无真值）。
- 模型 key 只在服务端/worker 使用，**绝不**下发浏览器。
- presigned URL 短期有效；公共读仅限 `games/*` 产物前缀。
- session 用 httpOnly cookie；`AUTH_SECRET` 由 env 注入。

## 5. 资源限制

- `MAX_UPLOAD_BYTES`（上传）、`MAX_BUNDLE_BYTES`（产物体积上限，VALIDATOR 拦截）、`GENERATION_TIMEOUT_MS`（任务看护）、`MAX_AGENT_RETRIES`（节点重试）。
- BullMQ 并发上限防止 worker 过载；任务超时置 `FAILED` 防卡 `RUNNING`。
- 〔已实现〕**per-user 速率限额**（`src/lib/rate-limit.ts`，Redis 固定窗口）：新建生成任务 `POST /api/tasks` 限 `RATE_LIMIT_TASKS`/`RATE_LIMIT_WINDOW_SEC`，超额 **429 `RATE_LIMITED` + `Retry-After`**；公开埋点 `POST /api/play-events` 按 (session uid | client IP) 限 `RATE_LIMIT_PLAY_EVENTS` 防刷 `playCount`。Redis 不可用时 **fail-open**（限额是防滥用增强，绝不拖垮正常用户）。
- 〔已实现〕**成本统计**：6 节点 token 计入 `AgentLog`（确定性节点恒 0）。Create run-timeline 展示每节点 + 总量；`/me?tab=tasks` 生成记录展示每任务 token + **估算美元成本**（`COST_USD_PER_1K_TOKENS`，默认 0.01/1k）及本页累计（mock token 为估算值）。
- 〔已实现，B4〕**内容审核**（content moderation）：`src/lib/moderation.ts` 本地启发式禁词（性暴露/极端暴力/武器毒品制造/仇恨，中英），生成前在 `POST /api/tasks` 拦截命中创意 → **422 不建任务不入队**。是可插拔 seam：内部换真实审核 API（OpenAI moderation/自建分类器）即升级，调用点与契约不变。无 key 离线可跑（红线⑤）。

## 6. 鉴权与越权

- `/create` 等受保护路由经 middleware + 服务端 session 校验。
- 需登录的 Node API 路由统一经 `requireUser()`（`src/lib/require-user.ts`）：`auth()` 解码 JWT 后**再核对 `uid` 仍在 `User` 表**。签名仍合法但已失效的会话（库重置 / 删号 / 旧 cookie）一律 **401「请重新登录」**，避免后续写库撞外键（Prisma P2003）落成未捕获 500。Prisma 绝不上 Edge —— 该校验只在 Node 路由，middleware 仍用纯 JWT 解码。
- 资源操作校验归属：发布/重试/删除/改 meta/下架校验 `authorId`/`userId`，越权返回 403。
- **owner-scoped 管理（已实现，T2-1）**：作者经 `requireGameOwner()` 管理自己的游戏 —— `PATCH /api/games/:id`(改 meta)、`POST /api/games/:id/archive`(下架/恢复 `GameStatus.ARCHIVED`，Home 天然排除)、`DELETE /api/games/:id`(级联删 + 清 MinIO `games/{id}/`，删除封装只在 `storage.ts` 守红线①)。
- **平台 admin（DEFERRED 2026-06-20）**：跨用户管理 / 全平台可观测聚合面 + `User.role` 权限门未建；当前维护只到 owner-scoped + 基础设施级（MinIO 控制台 :9001 / SQL）。内容审核同 §5 deferred。

## OAuth 安全（已实现，env-gated，2026-06-21）

- **接入**：Google / GitHub provider 在 `src/lib/auth.ts` 注册，**env-gated**——配齐 `{PROVIDER}_CLIENT_ID/SECRET` 才注册（仿模型 seam），缺则不启用、登录页只显示邮箱登录（红线⑤：无密钥也能跑）。`oauthEnabled` 由服务端登录/注册页读出，决定是否渲染按钮。
- **数据模型**：`Account` 表与 `User` 解耦（`@@unique([provider, providerAccountId])`）；access/refresh token + expiresAt 落 `Account` 行（demo 明文，生产应加密）。
- **账号绑定**（JWT 策略 + 无 DB adapter → `auth.ts` `linkOAuthAccount` 手动落库）：① 按 `(provider, providerAccountId)` 命中已绑 `Account` → 复用其 `User`（重复登录稳定同一身份）；② 否则按 email upsert `User`（同邮箱的 Credentials 账号可被绑定），再建 `Account`。GitHub 邮箱私密时合成稳定占位邮箱。
- **回调**：`/api/auth/callback/{google,github}`；`state`/PKCE 由 Auth.js 提供。读 Prisma 的 jwt 回调只在 Node `/api/auth` 路由跑，middleware 走 `auth.config`（无 Prisma）→ Prisma 绝不上 Edge。
- **后续扩展**：再加 provider = 在 `auth.ts` 依葫芦加一段 env-gated push + `AuthProvider` 枚举值即可；账号合并（同邮箱跨 provider）已天然支持。

## 实现状态标注（交付前更新）

| 项 | 状态 |
|----|------|
| iframe 跨域隔离 + 产物 CSP | 已实现（核心） |
| 上传白名单 + 限额 | 已实现 |
| 密钥仅服务端 + `.env.example` | 已实现 |
| 任务超时/重试 | 已实现 |
| 失效会话存在性再校验（`requireUser` → 401 非 500） | 已实现 |
| per-user 速率限额（任务 + play-events，Redis 固定窗口，fail-open） | 已实现 |
| 成本统计（6 节点 token 聚合 + run-timeline + /me 任务记录估算成本） | 已实现 |
| 内容审核（本地启发式禁词 seam，生成前 422 拦截，可插真审核 API） | 已实现（B4） |
| 站点安全 headers（CSP frame-src + nosniff/x-frame-options/referrer/permissions） | 已实现（B4） |
| Prompt Injection 深防御（提示注入语义级防护） | 设计（已知问题） |
