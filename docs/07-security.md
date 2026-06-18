# 07 · 安全方案

> 附录"安全隔离"设计项：上传素材、Prompt Injection、任意生成代码执行、密钥保护、资源限制。
> MVP 给出真实可见的边界 + 设计叙事；标注哪些是设计/已实现/Mock。

## 1. 任意生成代码执行（最高风险，已用结构性手段兜住）

- **浏览器隔离**：生成的任意 JS **只**在跨域 sandbox iframe 运行（`allow-scripts`，无 `allow-same-origin` → opaque origin），无法触达宿主 cookie/token/DOM/localStorage。见 `06`。
- **产物 CSP**：manifest 自带 `connect-src 'none'`，阻断游戏外联/数据外泄；`default-src 'none'` 收紧默认。
- **服务端从不执行生成代码**：worker 只做静态校验/打包，可选 headless 渲染在受限无网容器内（截图用）。
- **postMessage 校验**：宿主只接受来自 MinIO 源、`source:"yahaha-game"` 且 schema 合法的消息。
- 宿主 app 设站点级 CSP，限制 `frame-src` 为 MinIO 源。

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
- 〔设计/未实现〕按用户的生成速率限额、成本统计（token 计入 `AgentLog`，可聚合）。

## 6. 鉴权与越权

- `/create` 等受保护路由经 middleware + 服务端 session 校验。
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
| Prompt Injection 深防御 / 内容审核 / 成本限额 | 设计（已知问题） |
