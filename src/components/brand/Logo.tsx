/**
 * 品牌标志 = Y-Fork（docs/10 §logo）。两臂双渐变（洋红=玩 / 青=创作）汇成一根白色主干，
 * 既是首字母 Y、又是「双路合一」。装在 plum squircle chip 里。替换原五角星。
 * 渐变 def 由 <BrandDefs/>（根布局渲染一次）提供，全站引用 url(#yh-gPlay/#yh-gCreate)。
 */
export function BrandDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="yh-gPlay" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF3BA7" />
          <stop offset="1" stopColor="#C03BFF" />
        </linearGradient>
        <linearGradient id="yh-gCreate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#27E0FF" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function YForkLogo({ size = 28, float = false }: { size?: number; float?: boolean }) {
  const inner = Math.round(size * 0.64);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center ${float ? "yh-floaty" : ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(7, Math.round(size * 0.3)),
        background: "linear-gradient(160deg,#241C3A,#15111E)",
        border: "1px solid rgba(124,92,255,.32)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 10px 26px -10px rgba(124,92,255,.45)",
      }}
      aria-hidden="true"
    >
      <svg width={inner} height={inner} viewBox="0 0 32 32" fill="none">
        <path d="M9.5 8.5 L16 16.5" stroke="url(#yh-gPlay)" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M22.5 8.5 L16 16.5" stroke="url(#yh-gCreate)" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M16 16.5 L16 24" stroke="#F4F1FA" strokeWidth="4.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** logo + "Yahaha" 字重 800（docs/10）。 */
export function Brand({ size = 28, float = false }: { size?: number; float?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <YForkLogo size={size} float={float} />
      <span className="font-extrabold tracking-tight" style={{ fontSize: Math.round(size * 0.6) }}>
        Yahaha
      </span>
    </span>
  );
}
