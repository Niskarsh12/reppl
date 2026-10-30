"use client";

import { opportunityCost } from "@/lib/campaign/optimizer";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import { count, money } from "@/lib/campaign/catalog";
import type { Match } from "@/lib/discovery/types";
import { EASE_OUT } from "@/lib/motion";
import { PartnerAvatar } from "../ui/PartnerAvatar";

const FIT_LABEL = { strong: "Strong fit", good: "Good fit", stretch: "Stretch" } as const;

export function MatchRow({
  match,
  checked,
  locked,
  onToggle,
  animate,
  markSamples,
}: {
  match: Match;
  checked: boolean;
  locked: boolean;
  onToggle: () => void;
  animate: boolean;
  /** Flag sample rows when they sit among real Qloo results. */
  markSamples: boolean;
}) {
  const o = match.opportunity;
  const meta = [o.detail, o.audience && `${count(o.audience.size)} ${o.audience.unit}`, o.city ?? (o.kind === "creator" ? "Online" : null)].filter(Boolean);
  return (
    <motion.li
      initial={animate ? { opacity: 0, transform: "translateY(8px)" } : false}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
      <label
        className={`card group flex gap-4 p-5 transition-[box-shadow,background-color] duration-200 sm:p-6 ${
          checked
            ? "bg-lavender-soft/45 shadow-[inset_0_0_0_1.5px_var(--color-forest)]"
            : locked
              ? "cursor-not-allowed"
              : "cursor-pointer hover:shadow-[inset_0_0_0_1px_var(--color-ink-faint)]"
        }`}
      >
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={locked} onChange={onToggle} />
        <span
          className={`mt-3 grid size-5 shrink-0 place-items-center rounded-md transition-[background-color,box-shadow] duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lavender-deep ${
            checked ? "bg-forest text-ivory" : "bg-paper shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]"
          }`}
          aria-hidden
        >
          <Check className={`size-3.5 transition-[opacity,transform] duration-150 ${checked ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} strokeWidth={3} />
        </span>
        <PartnerAvatar opportunity={o} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-base font-semibold tracking-[-0.01em]">{o.name}</span>
              {markSamples && o.source === "sample" && <span className="pill pill-lavender">Sample</span>}
            </span>
            <span className="num text-sm text-ink">
              {opportunityCost(match) === null ? "Cost unknown · quote needed" : <>{money(o.rate.min)}–{money(o.rate.max)} <span className="text-ink-faint">{o.source === "sample" ? "illustrative" : "est."}</span></>}
            </span>
          </span>
          <span className="mt-1 block text-sm text-ink-faint">{meta.join(" · ")}</span>
          <span className="mt-3 block text-[0.9375rem] leading-relaxed text-ink-soft">{match.whyItFits}</span>
          <span className="mt-3 flex flex-wrap gap-1.5">
            <span className={`pill ${match.fit === "strong" ? "pill-moss" : "pill-neutral"}`}>
              {FIT_LABEL[match.fit]}
              {o.affinity !== undefined && <span className="num opacity-75">Raw affinity {o.affinity}</span>}
            </span>
            {!match.withinBudget && opportunityCost(match) !== null && <span className="pill pill-rust">Above your budget</span>}
            {match.conversation === "mutual" && <span className="pill pill-moss">Points back</span>}
            {match.shared.map((s) => (
              <span key={s} className="pill pill-lavender">
                {s}
              </span>
            ))}
          </span>
        </span>
      </label>
    </motion.li>
  );
}

export function SkeletonRow() {
  return (
    <li className="card flex gap-4 p-5 sm:p-6" aria-hidden>
      <span className="skeleton mt-3 size-5 shrink-0" />
      <span className="skeleton size-11 shrink-0 rounded-full" />
      <span className="flex-1">
        <span className="flex justify-between gap-4">
          <span className="skeleton block h-5 w-40" />
          <span className="skeleton block h-4 w-28" />
        </span>
        <span className="skeleton mt-2 block h-4 w-64 max-w-full" />
        <span className="skeleton mt-4 block h-4 w-full" />
        <span className="skeleton mt-2 block h-4 w-3/4" />
      </span>
    </li>
  );
}
