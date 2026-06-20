# 07 · 安全方案

> 附录"安全隔离"设计项：上传素材、Prompt Injection、任意生成代码执行、密钥保护、资源限制。
> MVP 给出真实可见的边界 + 设计叙事；标注哪些是设计/已实现/Mock。

## 1. 任意生成代码执行（最高风险，已用结构性手段兜住）

- **浏览器隔离**：生成的任意 JS **只**在跨域 sandbox iframe 运行（`allow-scripts`，无 `allow-same-origin` → opaque origin），无法触达宿主 cookie/token/DOM/localStorage。见 `06`。
- **产物 CSP**：manifest 自带 `connect-src 'none'`，阻断游戏外联/数据外泄；`default-src 'none'` 收紧默认。
- **服务端从不执行生成代码**：worker 只做静态校验/打包，可选 headless 渲染在受限无网容器内（截图用）。
- **postMessage 校验**：宿主按 **`event.source` 身份**（= 所挂 iframe 的 `contentWindow`）+ **先 Zod 校验外层信封**（`source:"yahaha-game"`、`v:1`）再 switch type；sandbox 帧 origin 为 `"null"`，**绝不**按 origin 断言。详见 `06`。
- **站点级 CSP（已实现）**：`next.config.ts` `headers()` 下发 `frame-src 'self' <S3_PUBLIC_ENDPOINT>; frame-ancestors 'none'`（源走 env），限制可嵌入 iframe 的源为 MinIO 产物源，并禁止本站被他人内嵌。

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
- 〔已实现〕**成本统计**：6 节点 token 计入 `AgentLog`（确定性节点恒 0），Create run-timeline 聚合并展示每节点 + 总量（mock 估算）。
- 〔设计/未实现〕内容审核（content moderation）为加分项，仅设计。

## 6. 鉴权与越权

- `/create` 等受保护路由经 middleware + 服务端 session 校验。
- 需登录的 Node API 路由统一经 `requireUser()`（`src/lib/require-user.ts`）：`auth()` 解码 JWT 后**再核对 `uid` 仍在 `User` 表**。签名仍合法但已失效的会话（库重置 / 删号 / 旧 cookie）一律 **401「请重新登录」**，避免后续写库撞外键（Prisma P2003）落成未捕获 500。Prisma 绝不上 Edge —— 该校验只在 Node 路由，middleware 仍用纯 JWT 解码。
- 资源操作校验归属：发布/重试/删除校验 `authorId`/`userId`，越权返回 403。

## OAuth 安全（设计）

- `Account` 表与 `User` 解耦；token 加密存储（demo 可空）。
- 回调校验 `state`/PKCE（由 Auth.js 提供）；按 `providerAccountId` 防账号劫持，绑定时校验邮箱归属。

## 实现状态标注（交付前更新）

| 项 | 状态 |
|----|------|
| iframe 跨域隔离 + 产物 CSP | 已实现（核心） |
| 上传白名单 + 限额 | 已实现 |
| 密钥仅服务端 + `.env.example` | 已实现 |
| 任务超时/重试 | 已实现 |
| 失效会话存在性再校验（`requireUser` → 401 非 500） | 已实现 |
| per-user 速率限额（任务 + play-events，Redis 固定窗口，fail-open） | 已实现 |
| 成本统计（6 节点 token 聚合 + run-timeline 展示） | 已实现 |
| Prompt Injection 深防御 / 内容审核 | 设计（已知问题） |
