import Link from "next/link";

/**
 * Minimal Home placeholder (CP1). The real DB-backed gallery lands in D1-PM.
 * Here it just routes into the Play loader so the checkpoint demo is one click away.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 place-items-center bg-grad-play text-white"
          style={{ borderRadius: "30%" }}
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.9 6.26L21.8 9l-5 4.6L18.2 21 12 17.3 5.8 21l1.4-7.4-5-4.6 6.9-.74L12 2z" />
          </svg>
        </span>
        <span className="text-[28px] font-extrabold leading-none tracking-tight">Yahaha</span>
      </div>

      <div className="space-y-3">
        <h1 className="text-[22px] font-bold">AI Native 互动游戏平台</h1>
        <p className="max-w-md text-sm text-ink-muted">
          登录 → Create（异步多 Agent 生成）→ 发布 → Play。游戏产物存于远端对象存储，
          经跨域 sandbox iframe 隔离运行。
        </p>
      </div>

      <Link
        href="/play/neon-dodger"
        className="inline-flex h-11 items-center gap-2 rounded-pill bg-grad-play px-6 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
      >
        ▶ 试玩 Neon Dodger
      </Link>

      <p className="font-mono text-[11px] text-ink-faint">
        Checkpoint 1 · 远端产物 + 跨域 Play loader
      </p>
    </main>
  );
}
