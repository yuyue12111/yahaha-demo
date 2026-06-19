/** 星形品牌符号（docs/10 §星形 logo）：grad-play squircle + 白星。home/play/login 复用。 */
export function StarLogo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center bg-grad-play text-white"
      style={{ width: size, height: size, borderRadius: "30%" }}
      aria-hidden
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.9 6.26L21.8 9l-5 4.6L18.2 21 12 17.3 5.8 21l1.4-7.4-5-4.6 6.9-.74L12 2z" />
      </svg>
    </span>
  );
}

/** logo + "Yahaha" 字重 800。 */
export function Brand({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <StarLogo size={size} />
      <span className="font-extrabold tracking-tight" style={{ fontSize: Math.round(size * 0.6) }}>
        Yahaha
      </span>
    </span>
  );
}
