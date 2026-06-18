# 08 · 可观测性与失败恢复

> 附录设计项：可观测性（生成过程、Agent IO、用户操作、错误日志、演示证据）+ 失败恢复
> （模型输出不稳定、构建失败、上传失败、发布失败、加载失败）。

## 可观测性

| 维度 | 手段 |
|------|------|
| 生成过程 | `GenerationTask.status/currentStep` 状态流转；`AgentLog` 每节点起止 |
| Agent IO | `AgentLog.inputSummary/outputSummary` + `tokensIn/Out` + `latencyMs` + `modelProvider`（证多步非黑盒） |
| 实时进度 | worker → Redis pub/sub → SSE(`/api/tasks/:id/stream`) → Create UI run-timeline；轮询兜底 |
| 用户操作 | `PlayEvent`（LOAD/START/END/ERROR）+ `playCount`；like/favorite |
| 错误日志 | `GenerationTask.error` + 失败节点 `AgentLog(level=ERROR)`；服务端结构化日志（含 taskId 关联） |
| 演示证据 | Play 的 "Source:&lt;URL&gt;" 徽章、Network 截图、MinIO 控制台对象、SSE 步骤流 |
| 成本 | token 计入 `AgentLog`，可按任务/用户聚合（设计：成本统计面板） |

约定：所有服务端日志带 `taskId`/`gameId`/`userId` 关联键，便于一次演示后回溯。

## 失败恢复矩阵

| 失败点 | 检测 | 恢复 |
|--------|------|------|
| 模型输出不稳定（非法 JSON/不合契约） | 节点输出 Zod 校验失败 | 节点内有限修复重试；仍失败→`FAILED` 记录；兜底回退确定性 mock 产物 |
| 模型瞬时失败（限流/超时/网络） | 调用异常 | BullMQ `MAX_AGENT_RETRIES` 指数退避；记录 `attempt` |
| 构建/校验失败（产物不可跑/超体积） | VALIDATOR 静态/冒烟检查 | 反馈 CODER 自修复一轮；超 `MAX_BUNDLE_BYTES` 直接拦截；终态 `FAILED` |
| 上传失败（MinIO 抖动） | PutObject 异常 | 重试；持续失败→`FAILED`，产物未半写（先全量再写 `Version`） |
| 发布失败（并发/状态冲突） | 事务校验 | 事务回滚；幂等：重复发布同 version 无副作用 |
| 加载失败（Play：404/CORS/超时） | manifest 校验 / iframe onerror / 看护超时 | `failed` 态显示失败 URL+原因+重试，绝不白屏 |
| 任务卡死 | `GENERATION_TIMEOUT_MS` 看护 | 置 `FAILED(timeout)`，释放 worker |

## 任务态对外可见

- `pending`：已入队未开始。
- `running`：worker 处理中，`currentStep` 指示节点。
- `succeeded`：产物就绪，含 `resultVersionId` + `manifestUrl`。
- `failed`：含 `error` + 失败节点日志；UI 提供 `retry`。
- `canceled`：用户/系统取消（可选）。

## 重试语义

`POST /api/tasks/:id/retry` 从失败节点重排（已成功的前序节点结果可复用 → durable step）；新 `attempt`，复用同 `gameId`，产 `versionNumber+1`（或覆盖 PREVIEW，按实现注明）。

## 演示用最小观测面（确保 grader 看得见）

Create 页：步骤时间线（节点名 + 状态 + IO 摘要 + 耗时）；任务态徽章；失败时错误+重试。
Play 页：四态 + Source 徽章。MinIO 控制台：版本化对象。
