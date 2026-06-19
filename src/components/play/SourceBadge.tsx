/**
 * Source badge (docs/10 §Source 徽章, rubric anchor): proves the artifact loaded from a
 * remote object-store URL. `url` MUST be the exact value the iframe `src` got — bind it to
 * the active-version response, never re-derive it.
 */
export function SourceBadge({ url }: { url: string }) {
  return (
    <div
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-hairline bg-surface-inset px-2.5 py-1 font-mono text-[11px] text-ink-muted"
      title={url}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--running)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden
      >
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
      <span className="shrink-0">Source:</span>
      <span className="truncate text-ink">{url}</span>
    </div>
  );
}
