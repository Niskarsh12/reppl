import { AlertCircle, Check } from "lucide-react";
import type { ReactNode } from "react";

export type StatusTone = "pending" | "working" | "done" | "error";

/** A single line of agent status: what it is doing, has done, or couldn't do. */
export function StatusMark({ tone }: { tone: StatusTone }) {
  if (tone === "done")
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-forest text-ivory" aria-hidden>
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (tone === "error") return <AlertCircle className="size-5 shrink-0 text-rust" strokeWidth={1.75} aria-hidden />;
  return (
    <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
      <span
        className={`size-2.5 rounded-full ${tone === "working" ? "anim-breathe bg-forest" : "shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]"}`}
      />
    </span>
  );
}

export function StatusLine({ tone, children, detail }: { tone: StatusTone; children: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="pt-px">
        <StatusMark tone={tone} />
      </span>
      <div className="min-w-0">
        <p className={`text-[0.9375rem] leading-snug ${tone === "pending" ? "text-ink-faint" : "text-ink"}`}>{children}</p>
        {detail && <div className="mt-1 text-sm leading-relaxed text-ink-soft">{detail}</div>}
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "error"; children: ReactNode }) {
  const styles = {
    info: "bg-lavender-soft/60 text-ink",
    warning: "bg-rust-soft/70 text-ink",
    error: "bg-rust-soft text-ink",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}
