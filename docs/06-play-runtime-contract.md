# 06 · Play 运行时契约

> Play 如何动态加载远端产物并**隔离**运行，以及如何**证明**产物来自远端。规避 3.4.2 与"隔离运行"约束。
> 一句话：`iframe.src = MinIO 远端 URL` + `sandbox="allow-scripts"`（**不带** `allow-same-origin`）+ postMessage 通信。

## 隔离机制（必须严格遵守）

- 入口：`<iframe sandbox="allow-scripts" src="{manifestPrefix}/index.html">`，`src` 指向 **MinIO 源**（`:9000`，与 app `:3000` **天然跨域**）。
- **绝不**同时给 `allow-scripts` + `allow-same-origin`：二者并存可让被嵌文档自解沙箱（MDN 明确警告）。只给 `allow-scripts` → iframe 处于 **null/opaque origin**，碰不到父页 cookie / localStorage / DOM。
- **绝不**用 `srcdoc`/base64 内联远端 HTML：那样网络面板看不到 MinIO 请求，无法证明远端，且丧失跨域隔离。
- 产物自带 CSP（manifest.csp，`connect-src 'none'`）进一步阻断外联。
- 宿主 app **零**游戏专属代码，只有通用 loader 组件。

## 状态机（四态，禁止白屏）

| 状态 | 触发 | UI |
|------|------|----|
| `loading` | 取 manifest / iframe 未就绪 | 骨架 + 进度 + "正在加载远端游戏文件" |
| `loaded` | 收到 `GAME_LOADED` postMessage（或 onload + 看护超时内） | 游戏可交互；显示 "Source:&lt;远端 URL&gt;" 徽章 |
| `failed` | manifest 404/校验失败 / iframe onerror / 看护超时(默认 15s) | **明确错误卡**（含失败 URL + 原因 + 重试按钮），绝不白屏 |
| `ended` | 收到 `GAME_ENDED` | 结算覆盖层 + 重新开始 / 返回首页 |

## postMessage 协议（version 1；与 manifest.postMessageContract 一致）

宿主与游戏**只**经 postMessage 通信，双向都校验 `origin`（宿主侧允许 MinIO 源）与消息 schema。

| 方向 | type | payload | 含义 |
|------|------|---------|------|
| 宿主→游戏 | `HOST_INIT` | `{ config? }` | 初始化（可传难度/玩家名等） |
| 宿主→游戏 | `HOST_RESTART` | — | 重新开始 |
| 游戏→宿主 | `GAME_LOADED` | — | 就绪 → `loaded` |
| 游戏→宿主 | `GAME_SCORE` | `{ score }` | 计分更新（埋点） |
| 游戏→宿主 | `GAME_ENDED` | `{ score? }` | 结束 → `ended`，发 `END` PlayEvent |
| 游戏→宿主 | `GAME_ERROR` | `{ message }` | 运行期错误 → `failed` |

消息统一外层 `{ source: "yahaha-game", v: 1, type, payload }`，便于过滤与版本协商。

## 生成游戏的运行时义务（CODER 必须满足）

- 挂载到 `#game-root`；自适应 iframe 尺寸。
- 加载完成 `postMessage(GAME_LOADED)`；结束 `postMessage(GAME_ENDED,{score})`；致命错 `postMessage(GAME_ERROR,{message})`。
- 不发起外部网络请求（受 CSP `connect-src 'none'` 约束）；资源用相对路径（同 MinIO 前缀）。

## 证明产物来自远端（演示关键，rubric 直接看）

1. **DevTools Network**：`index.html`/`game.js`/`assets` 请求命中 `localhost:9000/games/...`（MinIO，异端口；presigned 时带 `X-Amz-Signature`），**而非** app 源或 `/public`。
2. **页面徽章**：Play 页显示 "Source: &lt;实际加载的远端 URL&gt;"，绑定真实解析到的 URL。
3. **即时换游戏**：在 MinIO 控制台替换该对象 → 刷新 Play 即变，无需重部署。
4. **代码佐证**：宿主仓库无任何游戏专属组件。

## 加载体验优化（加分）

- `games/*` 不可变路径设强缓存头；`<link rel="preconnect">` 到 MinIO 源。
- 骨架屏 + 进度；manifest 很小先到先渲染框架。
- 失败重试按钮重走加载流程。

## CORS 注意

- iframe `src` 作为**导航**不受 CORS 限制 → 入口 doc 必通。
- 若 fetch `manifest.json` 或游戏内 fetch 同级资源 → 需 MinIO CORS（`minio-init` 用 `mc` 设 bucket CORS，allow-origin = `NEXT_PUBLIC_APP_URL`）。
- 任何加载失败都进 `failed` 态打印失败 URL，绝不静默白屏。
