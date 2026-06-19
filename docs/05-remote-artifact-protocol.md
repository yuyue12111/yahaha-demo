# 05 · 远端产物协议

> 生成游戏以何种文件结构/manifest 交付给 Play。这是规避 3.4.2/3.4.3 的契约层。
> 原则：产物**全部**在 MinIO；路径**不可变**版本化；Play 只认 `manifest.json`，与具体游戏解耦。

## 对象存储布局（桶 `yahaha`）

```
uploads/{userId}/{assetId}.{ext}              # 原始多模态上传（私有），被任务引用
games/{gameId}/{version}/manifest.json        # Play 首先读取的契约
games/{gameId}/{version}/index.html           # iframe 入口（cross-origin 导航目标）
games/{gameId}/{version}/game.js              # 游戏逻辑
games/{gameId}/{version}/assets/*             # 精灵/音频/样式等
games/{gameId}/{version}/cover.png|cover.svg  # 封面：Validator 截图=.png；程序/SVG 缩略图占位=.svg（见降级阶梯）
```
- `{version}` = `Version.versionNumber`（同 game 内单调递增整数）。
- **公共读前缀**：`games/*` 设为公共读（或用短期 presigned GET），使 Play 可跨域加载；`uploads/*` 私有（按需 presign）。
- 每次生成/Remix **写新 `{version}/` 前缀**，旧版本不变 → URL 不可变、可强缓存、支持回滚/版本管理。

## manifest.json（Zod 校验，写入与读取双向）

```jsonc
{
  "schemaVersion": 1,
  "gameId": "cuid",
  "version": 3,                              // = versionNumber
  "title": "string",
  "summary": "string",
  "runtime": "html5-canvas",                 // 枚举: html5-canvas | phaser3 (对应 RuntimeKind)
  "entry": "index.html",                     // iframe.src 指向的相对入口
  "controls": "方向键移动，空格跳",
  "files": [
    { "path": "index.html", "contentType": "text/html",        "bytes": 1234, "sha256": "..." },
    { "path": "game.js",    "contentType": "application/javascript", "bytes": 5678, "sha256": "..." }
  ],
  "assets": [
    { "id": "player", "path": "assets/player.png", "contentType": "image/png", "sourceUpload": "uploads/u1/a1.png" }
  ],
  "postMessageContract": {                   // 与 06-play-runtime-contract.md 一致
    "version": 1,
    "ready": "GAME_LOADED",
    "score": "GAME_SCORE",
    "ended": "GAME_ENDED",
    "error": "GAME_ERROR"
  },
  "csp": "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'",
  "createdBy": "userId",
  "createdAt": "ISO8601",
  "integrity": { "bundleSha256": "..." }     // 全 bundle 摘要，可选校验/防篡改
}
```

字段语义要点：
- `entry`：Play 用 `manifestUrl` 同前缀拼出 `index.html` 的绝对 MinIO URL 作 `iframe.src`。
- `files[].sha256` / `integrity.bundleSha256`：Play 可选校验完整性；也为将来签名留口。
- `csp`：产物自带的内容安全策略（`connect-src 'none'` 阻断外联，防数据外泄）；见 `07-security.md`。
  **强制点**：MinIO 不会为静态对象下发 CSP 响应头，故该策略**必须**以
  `<meta http-equiv="Content-Security-Policy">` 写进 `index.html` 才真正生效；manifest 里的 `csp` 字段是**记录/备查**。
- `sourceUpload`：把生成资源回链到用户上传，证明"上传被引用"。

## 版本与发布

- `Version` 行：`{ gameId, versionNumber, runtime, manifestKey, manifestUrl, status }`。
- 生成成功 → version `PREVIEW`；`POST /api/games/:id/publish` → version `PUBLISHED` 且 `Game.activeVersionId` 指它、`Game.status=PUBLISHED`。
- 回滚 = 改 `activeVersionId` 指向旧 version（产物路径不可变，无需重传）。
- Remix（加分）= 以某 version 的 GameSpec 为输入新建任务，产出 `versionNumber+1`。

## Play 解析顺序

1. `GET /api/games/:id/active-version` → `{ gameId, versionNumber, runtime, manifestUrl, entryUrl }`（`entryUrl` = 前缀+`manifest.entry`，服务端预拼绝对 URL）。
2. （可选）fetch `manifestUrl` 校验 schema/完整性（需 MinIO CORS）。
3. 用 manifest 前缀 + `entry` 拼绝对 URL → 设 `iframe.src`（**导航，不受 CORS 限制**）。
4. 资源由 `index.html` 以相对路径从同前缀（MinIO 源）加载。

## 迁移到真实 OSS

manifest 与 loader 与存储无关；仅 `S3_ENDPOINT/S3_PUBLIC_ENDPOINT/凭证` 变化，key 与协议不变。
