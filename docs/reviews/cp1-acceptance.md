# CP1 验收报告 — Play 远端加载+隔离 ＋ S3 存储边界

- **状态**：✅ **ACCEPT（通过，附修复项）** · 五条 Fatal 红线 **0 踩**
- **日期**：2026-06-19
- **被评对象**：分支 `claude/objective-liskov-529299`（构建 session 的 CP1 产出）
- **reviewer**：review session（`claude/practical-gates-fb3e98`）
- **验证方式**：HTTP 层硬证据（curl）＋ 真实浏览器现场（Chrome DevTools 级 Network/Elements/截图）＋ 26 个 agent 的对抗式静态审计，三路交叉一致
- **行号基准**：下文 `file:line` 均指 **build 分支** 的文件状态

> build session 用法：先读 §1 看是否通过 → §2 必须修（CP1 为空）→ §3 建议修（逐条勾选 `[ ]→[x]`）→ §5 **必须保留/不许回退**（改东西前先看，别碰坏）→ §6 结转。改完回复 reviewer 复验。

---

## 0. 复验结果（2026-06-19，fix 轮之后）

**✅ RE-VERIFY PASS** — build session 的修复轮（`8608c8d..3f34d90`，5 个 commit）全部落地，**无任何红线 / 必须保留项回退**。reviewer 已重建栈（`docker compose up -d --build`）并对新代码现场复验：

| 项 | 复验方式 | 结果 |
|----|---------|------|
| MED-1 | 移走远端 entry（留 manifest）→ 开 Play | ✅ 现在即时出「加载失败 / 入口产物缺失（ENTRY_NOT_FOUND）」卡、无 iframe、非白屏（旧版是绿 "Loaded" 盖 XML）；API 返 `502 {error:{code:INTERNAL,details:{reason:ENTRY_NOT_FOUND}}}`；`resolveActiveVersion` 经 `objectExists()` 走 storage.ts，未开新 fs 路径 |
| MED-6 | `curl /api/games/<不存在>/active-version` | ✅ `404 {"error":{"code":"NOT_FOUND","message":"未找到该游戏","details":{"reason":"GAME_NOT_FOUND"}}}` |
| MED-7 | `curl -I /` 和 `/play/*` | ✅ `Content-Security-Policy: frame-src 'self' http://localhost:9000; frame-ancestors 'none'` |
| MED-5 | diff + happy-path | ✅ `runtime.ts` 单一真源 + DB⇄wire 映射；seed manifest 在收紧后（`createdAt.datetime()` / 拒 `./`）仍验证通过（active-version 200） |
| MED-3 | grep image | ✅ postgres/redis/node 已 digest 钉死；minio/mc 原本已钉 |
| §5 必须保留 | grep + 现场 | ✅ `fs`/`@aws-sdk` 仍只在 storage.ts；`allow-same-origin` 仅出现在注释；无 srcdoc；Play happy-path iframe `src`=远端 + `sandbox="allow-scripts"` + Source 徽章均无回退 |

附带 LOW-7/8（createdAt ISO8601、拒 `./`）也一并修了。剩余 5 个未勾选项为 LOW 打磨/CP2 项，可结转。

---

## 1. 验收结论 + 红线状态

CP1 是一次高质量、没有取巧的实现。所有问题都是 MED/LOW，**没有一条阻断验收**。

| 红线 | 状态 | 依据 |
|------|------|------|
| #1 存储不套壳、S3/fs 只在 `storage.ts`、字节出自 MinIO | **PASS** | 唯一 `@aws-sdk` 引用点；eslint 守卫实测触发；`public/` 空；seed 经 minio-init 上传 |
| #2 Play 载远端 URL（非 srcdoc）、`allow-scripts` 无 `allow-same-origin`、宿主 0 游戏码 | **PASS** | 现场全验；通用 loader 按 id 解析，无游戏分支 |
| #3 生成走 ModelClient seam、mock 按哈希播种 | **PASS（seam 范围）** | `.env.example` `MODEL_PROVIDER=mock`、无 key 可跑；完整 seam 属 CP3 |
| #4 `POST /api/tasks` 202 立返 + 独立 worker + ≥3 Agent | **PASS（契约范围）** | 契约就位、无实现违背；实现属 CP3 |
| #5 一条 compose 起全部 + 自动建桶/CORS/seed、无密钥、mock 可跑 | **PASS** | 亲手 `docker compose up -d` 从零重建：自动建网络/卷、minio-init 建桶+public-read+上传 seed、web gated 其后 |

**NEVER-CUT 底线（CP1 适用项）全部满足**：真 MinIO+SDK 无 fs · 跨域 sandbox iframe（`allow-scripts` 无 `allow-same-origin`）从 MinIO 加载 + Source 徽章 + 非白屏失败态 · README + 无密钥 `.env.example` + 一条 compose。（worker 202 / ≥3 Agent IO / ≥3 seed / 抗 F5 属后续 checkpoint，未被造假也未谎称完成。）

### 现场验证证据（7 项，全过）

| 检查 | 结果 | 证据 |
|------|------|------|
| Network `index.html` 来自 `localhost:9000`（异端口） | ✅ | 浏览器实抓 `GET :9000/.../index.html → 200`，`Server: MinIO` |
| `game.js` 来自 `localhost:9000` | ✅ | curl `:9000/.../game.js → 200 text/javascript 7071B`；游戏真跑并发 `GAME_LOADED` |
| iframe `sandbox` 无 `allow-same-origin` | ✅ | DOM 实查 `sandbox="allow-scripts"`、`allow_same_origin=false`、`uses_srcdoc=false`；SSR HTML 里 iframe `src`=远端 URL |
| Source 徽章 | ✅ | 文本=`Source:http://localhost:9000/.../index.html`，绑定 `active.entryUrl` |
| MinIO 换对象 → 刷新游戏会变 | ✅ | 远端 index.html 换成带横幅版本 → 刷新后舞台出现 "SWAPPED LIVE FROM MINIO"；已还原 |
| 改坏 URL → 错误卡不白屏 | ✅ | `/play/<不存在>` → 「加载失败 / GAME_NOT_FOUND」卡片 + 重试 + `Failed` 灯，背景非白屏 |
| `fs` 只在 `storage.ts` | ✅ | `src/` 下 0 处 `fs` import；`@aws-sdk` 仅 `storage.ts`；eslint 守卫植入泄漏实测拦 4 error |

---

## 2. 🔴 必须修（RED / HIGH，阻断合并）

**无。** CP1 没有任何红线或高危项。

---

## 3. 🟡 建议修（MED）— 勾选清单

- [ ] **MED-1 — entry 对象 404 被误判为 "Loaded"（唯一触及"已实现代码正确性"的项，已现场复现）**
  - 现象：manifest 存在但入口对象缺失时，跨域 iframe 对 404 也触发 `onload`，15s watchdog 把状态降级为绿色 **"Loaded"**，画面是 MinIO 的 `NoSuchKey` XML。技术上非白屏（底线守住），但"Loaded"盖在坏帧上是错误 UX。
  - 证据：`src/components/play/PlayShell.tsx:61-70`（watchdog 降级分支 `setStatus("loaded")`）、`:161-163`（`onLoad` 置 `onloadRef`，无 `onError`）、`src/lib/active-version.ts:21,27`（只校验 manifest、不 HEAD 入口）。
  - 修法：watchdog 默认落 `failed`（除非真收到 `GAME_LOADED`）；和/或在 `resolveActiveVersion` 用现成的 `src/lib/storage.ts:68 objectExists()` HEAD 一下入口，缺失就返回 `MANIFEST_UNAVAILABLE`。**这是 CP3 packager 开始产 manifest 前最该补的一刀。**

- [ ] **MED-2 — README 过期，掩盖了能跑的事实**
  - 证据：`README.md:5`「状态：脚手架/契约阶段」；`:15`「快速开始（TODO）」；`:19` `# docker compose up --build`（被注释）。与能跑的栈矛盾。
  - 修法：删状态行、改成真 quick-start、解注释 compose 命令、补 `localhost:3000` / `localhost:9001`。（注：README 收尾本排在 D2 PM，属预期内，可顺手提前。）

- [ ] **MED-3 — 三个基础镜像用浮动 tag，损复现性**
  - 证据：`docker-compose.yml:13` `postgres:16-alpine`、`:29` `redis:7-alpine`、`Dockerfile:2,20` `node:22-alpine`（minio/mc 已钉版本/digest）。
  - 修法：统一钉 patch tag 或 sha256 digest。

- [ ] **MED-4 — `docs/07-security.md:11` 仍写"宿主只接受来自 MinIO 源的消息"，与已更正的 `docs/06` 冲突**
  - 证据：`docs/07:11` vs `docs/06:27-30`（帧 origin 为 `"null"`、绝不断言 origin）。代码是对的（`PlayShell.tsx:74` 用 `event.source` 身份）。
  - 修法：把 `docs/07:11` 改为「源身份 + Zod 信封」规则，注明 null-origin，交叉引用 docs/06。

- [ ] **MED-5 — `RuntimeKind` 拼写分叉：`docs/02` DB 枚举 `HTML5_CANVAS` vs 代码/manifest 的 `html5-canvas`（最承重）**
  - 证据：`docs/02-data-model.md:15,68` vs `src/lib/contracts/manifest.ts:6-7`、`games.ts:8`、`seed-games.ts:20`、`seed/.../manifest.json`。
  - 修法：在 docs/02 定一个规范映射（如 Prisma `HTML5_CANVAS @map("html5-canvas")`）或在 `src/lib/contracts/` 放 DB枚举⇄wire 映射器。**D1-PM 接 Prisma 前必须统一，否则反序列化会撞。**

- [ ] **MED-6 — active-version 错误体是扁平 `{error:string,detail}`，与 `docs/03` 约定的 `{error:{code,message,details}}` 信封不一致**
  - 证据：`src/app/api/games/[id]/active-version/route.ts:14-17`、`active-version.ts:17,31` vs `docs/03:8-9`（目前 HTTP 错误体未被调用）。
  - 修法：立 `src/lib/contracts/error.ts` 的 `ErrorEnvelope` + `errorEnvelope()` helper，`GAME_NOT_FOUND→NOT_FOUND` 等映射。**趁 API 面还小先立，别让 CP3 每个新端点各自发明形状。**

- [ ] **MED-7 — `docs/07 §1` 承诺的站点级 `frame-src` CSP 未实现（纵深防御缺口，非红线）**
  - 证据：`docs/07:12` vs `next.config.ts:3-8`（无 `headers()`）、无 `src/middleware.ts`、`layout.tsx` 无 CSP。主隔离 sandbox 在。
  - 修法：加 `headers()` CSP `frame-src http://localhost:9000; frame-ancestors 'none'`（源走 env），或把 docs/07 §1 标〔设计/未实现〕。

- [ ] **MED-8 — minio-init 并未设 CORS，但 `docs/01:64` & `docs/06:68` 说它设了**
  - 证据：`docker/minio-init.sh:25,28,32` 只做 mb/anonymous/cp；CORS 实际由 `docker-compose.yml:46` `MINIO_API_CORS_ALLOW_ORIGIN` 设。
  - 修法：把 `docs/01:64`、`docs/06:68` 改为「CORS 由 compose 的 `MINIO_API_CORS_ALLOW_ORIGIN`（限 app 源）提供」。

---

## 4. ⚪ 可选打磨（LOW，不急，CP2 顺手即可）

- [ ] LOW-1 `HOST_INIT` 声明但宿主从不发/游戏自启 — `docs/06:37`、`play-messages.ts:30`、`PlayShell.tsx:121`、`game.js:247`。修：onload 后发 HOST_INIT，或把它在 docs/06 降为 OPTIONAL/CP2。
- [ ] LOW-2 `.env.example:21-22` `S3_ENDPOINT` 注释与值小冲突（compose 覆盖为 `minio:9000`）。修：改注释说明该值用于裸跑、compose 注入 `minio:9000`。
- [ ] LOW-3 错误体未走 Zod（`active-version.ts:17,31`）— 与 MED-6 一起做。
- [ ] LOW-4 `docs/10:78` 写 `next/font/google`，实际 `next/font/local`（`layout.tsx:2`，代码更对）。修：改文档。
- [ ] LOW-5 `--input` token 文档有（`docs/10:77`）但 `globals.css` 未定义。修：加 `--input: var(--border);`。
- [ ] LOW-6 `StatePill` 的 `ended` 态未进 `docs/10:66` 规格（`StatePill.tsx:3-8`）。修：补一行。
- [ ] LOW-7 `createdAt: z.string()` 未强制 ISO8601（`manifest.ts:60` vs `docs/05:48`）。修：可选 `z.string().datetime()`。
- [ ] LOW-8 relPath 守卫允许 `./` 前缀（`manifest.ts:18-21`）— CP2 生成 manifest 时的隐患，seed 路径干净。修：也拒 `./`。
- [ ] LOW-9 watchdog 15s 会把慢但合法的冷启动游戏判 `failed`（`PlayShell.tsx:14`）— 显示重试卡非白屏，仅调参提示。
- [ ] LOW-10 `.dockerignore` 把 `*.md`/`docs/` 排除出镜像（`:13-14`）— 故意/正确，仅记录。
- [ ] LOW-11 提交时间戳成对相同（cosmetic）；scaffold+eslint 守卫标 `chore` 虽承载 Fatal #1 守卫 — cosmetic，≥3 commit 已满足（8 个、全 Conventional、全带 Co-Authored-By）。
- [ ] LOW-12 产物 CSP 允许 `script-src 'unsafe-inline'`（`seed/.../index.html:9`）— 隔离的 opaque-origin 帧 + `connect-src 'none'` 下可接受，CP2 PACKAGER 收紧。

---

## 5. ✅ 必须保留 / 不许回退（改任何东西前先读这节）

这些是 CP1 做对的核心机制，是后续所有 checkpoint 的地基。**改别的功能时不许碰坏它们**：

1. **Fatal #1 存储边界**：`src/lib/storage.ts` 是唯一碰 `@aws-sdk`/`fs` 的文件；eslint `no-restricted-imports` 守卫（含 `@aws-sdk/*` 子路径 + storage.ts override）；`publicUrl()` 启动守卫（端点指向内网 `minio:` 直接抛错）；全仓 0 fs 泄漏。**新代码要存储,一律 import `storage.ts`,不许自己开 S3/fs。**
2. **Play 隔离全维度**：`iframe.src`=真远端 URL（非 srcdoc/base64）；`sandbox="allow-scripts"` **永不加** `allow-same-origin`；宿主校验 `event.source` 身份（null-origin 帧的正确做法）并**先 Zod 校验信封再 switch type**；Source 徽章绑定解析值；游戏 CSP `connect-src 'none'`。
3. **双端点设计**：`S3_ENDPOINT`（服务端 `minio:9000`）vs `S3_PUBLIC_ENDPOINT`（浏览器 `localhost:9000`）**故意不同**——这是"证明远端/异端口"的根。别合并。
4. **seed 真活在 MinIO 上**：`public/` 空（仅 `.gitkeep`）、`.dockerignore` 排除 `seed/` 出 web 镜像、字节经 minio-init 上传。别把产物挪进 `public/` 或 COPY 进镜像。
5. **契约即运行时单一真源**：跨进程/网络边界全走 `src/lib/contracts/` 的 Zod（`manifest` / `play-messages` / `games`），由 docs 派生。新边界照此办。
6. **过程卫生**：Conventional commits + `Co-Authored-By` trailer、无真密钥、`uploads/*` 私有（presign seam 备 CP2）。

---

## 6. ⏭ 结转下一 checkpoint（Top 3）

1. **修 MED-1**：让 entry 缺失走干净 `failed`（HEAD 校验 + watchdog 默认 failed）。CP3 packager 产 manifest 前必做。
2. **立 `ErrorEnvelope` Zod 契约**（MED-6 + LOW-3）：趁 API 面小，统一错误形状。
3. **一轮文档回填**（MED-2/4/5/7/8 + LOW-4/5/6）：docs 是权威源，眼下多处自相矛盾；**MED-5（RuntimeKind）最承重**，D1-PM 接 Prisma 前必须先统一。

---

## 7. 复验方式（build 改完后 reviewer 怎么回验）

- MED-1：删 MinIO 里 `games/neon-dodger/1/index.html`（留 manifest）→ 开 Play → 应见**失败卡**而非"Loaded"盖 XML。
- MED-6：`curl -i :3000/api/games/<不存在>/active-version` → body 应是 `{error:{code:"NOT_FOUND",...}}`。
- MED-3：`grep -nE "alpine$" docker-compose.yml Dockerfile` 应无浮动 tag。
- MED-4/5/8：对应 docs 行应已改，且与代码一致。
- 必须保留项：重跑 §1 的 7 项现场检查，全部仍 PASS。
