# 10 · 设计系统契约（视觉基调）

> **设计权威（2026-06-20 起）**：以 **Claude Design handoff 参考**（`Yahaha Design Reference.dc.html` + `Yahaha Logo Concepts.dc.html` + `Yahaha Intro.dc.html`）为视觉/版式的**最高来源**；本 doc 与之**冲突时以参考为准**，并据其更新（如 logo、Create 聊天式、侧栏、入场动画）。
> **但**：设计**永不**改动 `CLAUDE.md §2` 的五条 Fatal 红线与 NEVER-CUT floor（存储边界只在 `storage.ts` · Play 跨域 sandbox `allow-scripts` 无 `allow-same-origin` + 远端 iframe.src + Source 徽章 · 202+独立 worker+≥3 节点 · ModelClient seam · 一条 `docker compose up` 可复现）。视觉优先级永远低于红线。
>
> 平台艺术风格的基调 = **方向 A 霓虹街机为底 + 方向 B 的克制**（更大圆角、细描边、更多留白）。
> 参考 Astrocade：暗色 plum 底、内容为王、双招牌渐变（Play=洋红紫 / Create=青蓝）、**Y-fork 品牌符号**、胶囊主操作。
> （品牌符号 2026-06-20 由「通用五角星」更新为 **Y-fork**：两臂双渐变=两条旅程，汇成白色主干=首字母 Y / 双路合一。见 Claude Design handoff。）
> 设计**不计分**，定位是让 demo 专业且有「参考 Astrocade」那味儿；落地走 Tailwind theme + shadcn/ui，**单暗色主题**。

## 设计原则
- 暗底 + 彩色封面跳出，chrome 极简克制（借 B）。
- **双渐变映射双旅程**：洋红→紫 = 玩/消费（Play、品牌标 Y 左臂）；青→蓝 = 创作/AI（Create、Inspire、发送、品牌标 Y 右臂）。
- 胶囊用于主操作（A 的能量）；卡片/次级控件用大圆角 + 细描边（B 的克制）。
- 把 **Play 的「Source: 远端 URL」徽章**当作一等公民设计进运行时外壳（rubric 锚点）。

## 颜色 token（语义名 → 值）

### 表面 / 文本 / 描边
| token | 值 | 用途 |
|------|----|------|
| `--bg` | `#0C0A14` | 应用底 |
| `--surface` | `#16121F` | 面板/卡片 chrome |
| `--surface-2` | `#1E1830` | 抬升/hover/选中 |
| `--surface-inset` | `#100C18` | 内嵌（Play 外壳、输入框容器） |
| `--text` | `#F4F1FA` | 主文本 |
| `--text-muted` | `#9D95B0` | 次文本（作者名、标签） |
| `--text-faint` | `#7A7290` | 占位/提示 |
| `--border` | `rgba(255,255,255,.07)` | 默认细描边（B 克制） |
| `--border-strong` | `rgba(255,255,255,.12)` | 强调描边 |
| `--border-brand` | `rgba(124,92,255,.18)` | 卡片紫调细描边（借 B） |

### 品牌渐变（招牌）
| token | 值 | 用途 / 文本色 |
|------|----|--------------|
| `--grad-play` | `linear-gradient(135deg,#FF3BA7,#C03BFF)` | Play 按钮、品牌星；文本 `#fff` |
| `--grad-create` | `linear-gradient(135deg,#27E0FF,#3B82F6)` | Create/Inspire/发送；文本 `#04223A`（青底用深字） |
| 端点 | play `#FF3BA7`/`#C03BFF`，create `#27E0FF`/`#3B82F6` | 需纯色时取端点 |

### 状态色（映射 `docs/02` 枚举 & `docs/06` Play 状态）
| 语义 | 值 | 映射 |
|------|----|------|
| `--ok` | `#5DE2B0` | TaskStatus.SUCCEEDED / Play `loaded` / VersionStatus.PUBLISHED |
| `--running` | `#27E0FF` | TaskStatus.RUNNING / Play `loading` |
| `--pending` | `#9D95B0` | TaskStatus.PENDING |
| `--warn` | `#F6B73C` | 提示/限额 |
| `--danger` | `#FF5C7A` | TaskStatus.FAILED / Play `failed` / 错误态 |
| `--canceled` | `#7A7290` | TaskStatus.CANCELED |
> 状态胶囊：`background: <color>/14% alpha`，`color: <color>`，前置同色圆点。

## 圆角 / 间距 / 字体
- 圆角：`--r-sm 8` · `--r-md 12` · `--r-lg 18`（卡片，借 B 增大）· `--r-xl 22`（模态/大面板）· `--r-pill 999`。
  主 CTA（Play/Create）= pill；次按钮/输入/卡片 = `r-lg`。
- 间距尺度（rem/px）：`4 8 12 16 20 24 32 48`；卡片网格 gap `14–16`；区块内边距 `22–24`（B 留白）。
- 字体：display/UI = **Plus Jakarta Sans**（`next/font` 引入，权重 400/500/700/800）；
  等宽 = `ui-monospace, "JetBrains Mono", SFMono-Regular`（Source 徽章 / manifest / 代码）。
- 字号：display 28/700 · h1 22 · h2 18 · h3 15 · body 14 · small 12 · micro 11；display line-height 1.1，正文 1.5。
- **焦点环**：`box-shadow: 0 0 0 2px rgba(39,224,255,.6)`（青，可访问）。

## 组件规格
| 组件 | 规格 |
|------|------|
| Button · Play | `--grad-play`，pill，白字 700，高 sm32/md38/lg44 |
| Button · Create | `--grad-create`，pill，深字 700 |
| Button · 主 CTA | 白底 `#F4F1FA` + 字 `#0C0A14`，pill（模态如「创建账号」） |
| Button · 次/ghost | 透明 + `--border` 1px，字 `--text-muted`→hover `--text`，`r-lg`（借 B 也可紫描边） |
| Game card | 竖版 3:4，`r-lg`，封面满铺 + `--border-brand`；左下 play-count 徽章（`rgba(0,0,0,.55)` pill 白字 ▶，数字 k/M 缩写）；卡下**标题 15/700 + 作者行（头像 + 名 `--text-muted`）**。**（2026-06-20 起按 Claude Design 参考精简：首页卡只留封面/播放数/标题/作者；简介/标签/发布时间移到详情页 `/games/[id]`。完整六项数据仍在 `GameCard` 契约与 API，详情页展示。）** |
| Home 发现（三排） | 参考稿 Astrocade/Poki 式：**玩家之选**（playCount 降序）· **Trending**（近 7 天 LOAD 事件数降序，真实增长信号）· **为你推荐**（确定性 hash 打散占位）。每排横向**可拖动**卡片轨（鼠标拖动 + 左右箭头 + 触屏滚动）。搜索/排行 → 单网格视图 |
| Sidebar nav | item 14/500 + 图标 20；选中 = `--surface-2` 底 + `r-md`；顶部 Play 大 pill |
| Input（Create 聊天） | `--surface-inset` 底，`r-lg`，占位 `--text-faint`，发送按钮 = `--grad-create` 圆形 |
| State pill | 见状态色；圆点 + 文案（loaded/pending/running/failed/ended） |
| **Source 徽章（Play）** | `--surface-inset` + `--border` 1px，mono 11，字 `--text-muted`，云图标 `#27E0FF`；内容 `Source: <远端 URL>` |
| Y-fork logo | squircle（圆角≈30%）plum 底（`linear-gradient(160deg,#241C3A,#15111E)` + `--border-brand`）+ Y 字标：左臂 `--grad-play`、右臂 `--grad-create`、主干白 `#F4F1FA`；"Yahaha" 字重 800。组件 `components/brand/Logo.tsx`，渐变 def 由 `<BrandDefs/>` 全站提供 |
| Modal | `--surface` 底，`r-xl`，scrim `rgba(0,0,0,.55)`，可选轻阴影 `0 12px 40px rgba(0,0,0,.5)` |

## 落地映射（实现期照此接）
1. **CSS 变量**：上述 token 写进全局 `:root`（app 暗色默认，无需浅色主题；如需浅色后置）。
2. **Tailwind**：`theme.extend.colors` 用语义名引用变量；`borderRadius`（sm/md/lg/xl）；`fontFamily.sans=Plus Jakarta Sans`；`backgroundImage`（`grad-play`/`grad-create` → `bg-grad-play`）。
3. **shadcn/ui 变量映射**（让其组件继承本主题）：
   `--background=--bg` · `--foreground=--text` · `--card=--surface` · `--popover=--surface` ·
   `--primary` 用 `--grad-play` 端点 `#C03BFF`、`--primary-foreground=#fff` · `--muted=--surface-2`、`--muted-foreground=--text-muted` ·
   `--border=--border` · `--input=--border` · `--ring=#27E0FF` · `--destructive=--danger` · `--radius=12px`。
4. **字体**：`next/font/local` 引 vendored `Plus Jakarta Sans`（weights 400/500/700/800，woff2 入仓 `src/app/fonts/`，无构建期网络）挂到 `<body>`。

## 已知取舍
- 渐变/暗色为品牌必需，未采用 claude 扁平浅色范式；mockup 见会话中的 A/B 风格板。
- 封面由生成流程产出（AI art）；缺图时用 GameSpec `palette` 程序生成渐变缩略图占位（与降级阶梯「SVG 缩略图」一致）。
