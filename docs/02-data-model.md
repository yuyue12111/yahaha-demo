# 02 · 数据模型契约

> 本文件是数据模型的**权威源**，`prisma/schema.prisma` 由它派生。字段名/枚举值跨代码必须一致。
> 主键统一 `id String @id @default(cuid())`；时间戳 `createdAt @default(now())` / `updatedAt @updatedAt`。

## 枚举

| 枚举 | 值 |
|------|----|
| `GameStatus` | `DRAFT` · `PUBLISHED` · `ARCHIVED` |
| `VersionStatus` | `BUILDING` · `PREVIEW` · `PUBLISHED` · `FAILED` |
| `TaskStatus` | `PENDING` · `RUNNING` · `SUCCEEDED` · `FAILED` · `CANCELED` |
| `AgentName` | `INGEST` · `PLANNER` · `ASSET_CURATOR` · `CODER` · `VALIDATOR` · `PACKAGER` |
| `AssetKind` | `UPLOAD` · `GENERATED` · `COVER` |
| `RuntimeKind` | `HTML5_CANVAS` · `PHASER3` |
| `AuthProvider` | `CREDENTIALS` · `GOOGLE` · `GITHUB` |
| `PlayEventType` | `LOAD` · `START` · `END` · `ERROR` |
| `LogLevel` | `INFO` · `WARN` · `ERROR` |

## 实体

### User
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | String | PK |
| email | String | unique |
| passwordHash | String? | 邮箱注册时存（argon2/bcrypt）；纯 OAuth 用户可空 |
| displayName | String | 展示名 |
| avatarUrl | String? | |
| createdAt / updatedAt | DateTime | |
关系：`games Game[]`（作者）、`accounts Account[]`、`assets Asset[]`、`tasks GenerationTask[]`、`likes Like[]`、`favorites Favorite[]`。

### Account（OAuth 身份；满足"OAuth 数据模型"交付项）
| 字段 | 类型 | 约束 |
|------|------|------|
| id | String | PK |
| userId | String | FK→User |
| provider | AuthProvider | |
| providerAccountId | String | provider 侧用户 id |
| accessToken / refreshToken | String? | 加密存储；demo 可空 |
| expiresAt | Int? | |
| createdAt | DateTime | |
约束：`@@unique([provider, providerAccountId])`。说明：邮箱用户也可建一条 `CREDENTIALS` account，统一身份抽象，便于将来账号绑定。

### Game
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | String | PK |
| title | String | |
| slug | String? | unique，可选 SEO |
| summary | String | 简介（卡片用） |
| tags | String[] | 标签数组 |
| coverUrl | String? | 封面（MinIO URL；Validator 截图或缩略图） |
| authorId | String | FK→User |
| status | GameStatus | 默认 `DRAFT` |
| activeVersionId | String? | FK→Version（已发布/当前版本，发布即指它） |
| playCount | Int | 默认 0，反范式计数 |
| createdAt / updatedAt | DateTime | |
| publishedAt | DateTime? | 首次发布时间（卡片"发布时间"） |
关系：`versions Version[]`、`likes Like[]`、`favorites Favorite[]`、`playEvents PlayEvent[]`、`tasks GenerationTask[]`。

### Version（不可变版本，支撑版本管理/Remix/回滚）
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | String | PK |
| gameId | String | FK→Game |
| versionNumber | Int | 单调递增（同 game 内 `@@unique([gameId, versionNumber])`） |
| runtime | RuntimeKind | |
| manifestKey | String | S3 key：`games/{gameId}/{versionNumber}/manifest.json` |
| manifestUrl | String | 浏览器可达的 MinIO URL（Play 用） |
| status | VersionStatus | 默认 `BUILDING` |
| createdByTaskId | String? | FK→GenerationTask（产出它的任务） |
| createdAt | DateTime | |
关系：`playEvents PlayEvent[]`。

### Asset（上传素材 / 生成资源 / 封面）
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | String | PK |
| ownerId | String | FK→User |
| gameId | String? | FK→Game（产物相关时） |
| kind | AssetKind | |
| s3Key | String | 对象 key |
| url | String? | 可达 URL（私有则按需 presign） |
| contentType | String | MIME |
| bytes | Int | 大小 |
| originalFilename | String? | 上传原名 |
| createdAt | DateTime | |
说明：上传素材 key 形如 `uploads/{userId}/{assetId}.{ext}`，被 `GenerationTask.inputAssetIds` 引用。

### GenerationTask（异步生成任务）
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | String | PK（即 taskId） |
| userId | String | FK→User |
| gameId | String? | FK→Game（目标/产出游戏；首次生成可在 succeeded 时创建） |
| prompt | String | 创意文本 |
| inputAssetIds | String[] | 引用的上传素材 id |
| status | TaskStatus | 默认 `PENDING` |
| currentStep | AgentName? | 当前节点 |
| modelProvider | String? | 实际使用的 provider（codex/mock…，可观测） |
| attempt | Int | 默认 0 |
| error | String? | 失败原因 |
| resultVersionId | String? | FK→Version（成功产物） |
| createdAt | DateTime | |
| startedAt / finishedAt | DateTime? | |
关系：`logs AgentLog[]`。

### AgentLog（每节点 IO，证明多步非黑盒；可观测性核心）
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | String | PK |
| taskId | String | FK→GenerationTask |
| seq | Int | 任务内递增序号 |
| agentName | AgentName | |
| level | LogLevel | 默认 `INFO` |
| title | String | 步骤标题（如 "Planner 产出 GameSpec"） |
| inputSummary | String? | 输入摘要（可读，非完整 prompt） |
| outputSummary | String? | 输出摘要 |
| tokensIn / tokensOut | Int? | |
| latencyMs | Int? | |
| createdAt | DateTime | |
索引：`@@index([taskId, seq])`。

### Like / Favorite（加分）
均为：`id` PK、`userId` FK→User、`gameId` FK→Game、`createdAt`，约束 `@@unique([userId, gameId])`。

### PlayEvent（游玩埋点，加分）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | PK |
| gameId | String | FK→Game |
| versionId | String? | FK→Version |
| userId | String? | 匿名可空 |
| type | PlayEventType | LOAD/START/END/ERROR |
| score | Int? | 结束时分数 |
| durationMs | Int? | 本局时长 |
| createdAt | DateTime | |
索引：`@@index([gameId, type])`。`playCount` 在 `START` 事件时自增（反范式）。

## 关系图（简）

```
User 1─* Game 1─* Version            User 1─* Account
 │        │  ▲ activeVersionId(FK)    User 1─* Asset *─? Game
 │        │  └────────┘               Game 1─* PlayEvent *─? Version
 └─* GenerationTask 1─* AgentLog      User 1─* Like/Favorite *─1 Game
        │ resultVersionId(FK)→Version
        └ gameId(FK)→Game
```
