import type { InputHTMLAttributes } from "react";

/** 输入框（docs/10 §Input）：surface-inset 底，r-lg，占位 text-faint，青色焦点环。 */
export function Field({
  label,
  className = "",
  ...props
}: { label?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-[13px] text-ink-muted">{label}</span> : null}
      <input
        className={`w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:shadow-focus ${className}`}
        {...props}
      />
    </label>
  );
}
