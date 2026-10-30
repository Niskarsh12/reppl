export function Logo({ tone = "ink", compact = false }: { tone?: "ink" | "ivory"; compact?: boolean }) {
  const ink = tone === "ink" ? "var(--color-ink)" : "var(--color-ivory)";
  return (
    <span className="inline-flex items-center gap-2.5" style={{ color: ink }}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <path d="M5 16.5 11 5.5l6 11M5 16.5h12" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
        <circle cx="11" cy="5.5" r="3" fill={tone === "ivory" ? "var(--color-lavender)" : "var(--color-forest)"} />
        <circle cx="5" cy="16.5" r="3" fill="var(--color-lavender)" />
        <circle cx="17" cy="16.5" r="3" fill="currentColor" />
      </svg>
      <span className={`text-[1.0625rem] font-semibold tracking-[-0.035em] ${compact ? "max-sm:sr-only" : ""}`}>
        Reppl
      </span>
    </span>
  );
}
