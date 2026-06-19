import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** 按钮（docs/10 §组件）：play=grad-play 白字 pill；create=grad-create 深字 pill；primary=白底深字 pill；ghost=描边。 */
type Variant = "play" | "create" | "primary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  play: "bg-grad-play text-white font-bold rounded-pill hover:brightness-110",
  create: "bg-grad-create text-[#04223A] font-bold rounded-pill hover:brightness-110",
  primary: "bg-ink text-bg font-bold rounded-pill hover:brightness-95",
  ghost: "border border-hairline-strong text-ink-muted hover:text-ink rounded-lg",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "ghost",
  size = "md",
  href,
  className = "",
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `inline-flex items-center justify-center gap-2 whitespace-nowrap transition disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
