"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { money } from "@/lib/campaign/catalog";
import { KIND_LABEL } from "@/lib/discovery/kinds";
import type { CampaignIdea, Match } from "@/lib/discovery/types";
import { EASE_OUT } from "@/lib/motion";
import { PartnerAvatar } from "../ui/PartnerAvatar";

export function IdeaCard({
  idea,
  index,
  anchors,
  budget,
  active,
  animate,
  onUse,
}: {
  idea: CampaignIdea;
  index: number;
  anchors: Match[];
  budget: number;
  active: boolean;
  animate: boolean;
  onUse: () => void;
}) {
  const estimated = anchors.some((m) => m.opportunity.rate.basis === "estimate");
  const over = idea.cost.max > budget;
  return (
    <motion.article
      aria-labelledby={`idea-${idea.id}`}
      initial={animate ? { opacity: 0, transform: "translateY(10px)" } : false}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay: animate ? index * 0.06 : 0 }}
      className={`card p-6 transition-[box-shadow,background-color] duration-200 sm:p-7 ${
        active ? "bg-lavender-soft/45 shadow-[inset_0_0_0_1.5px_var(--color-forest)]" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-lavender-deep">
          <span className="num">{String(index + 1).padStart(2, "0")}</span>
          <span className="mx-2 text-line-strong" aria-hidden>
            /
          </span>
          {idea.format}
        </p>
        <p className={`num text-sm ${over ? "text-rust" : "text-ink-soft"}`}>
          {money(idea.cost.min)}–{money(idea.cost.max)}
          <span className="text-ink-faint"> {estimated ? "est." : "typical"}</span>
          {over && " · over budget"}
        </p>
      </div>

      <h3 id={`idea-${idea.id}`} className="mt-3 font-serif text-[1.875rem] leading-[1.05] tracking-[-0.015em] sm:text-[2.125rem]">
        {idea.title}
      </h3>
      <p className="mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-soft">{idea.pitch}</p>

      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Partners in this idea">
        {anchors.map((m) => (
          <li key={m.opportunity.id} className="flex items-center gap-2.5 rounded-full bg-ivory py-1 pl-1 pr-3.5">
            <PartnerAvatar opportunity={m.opportunity} size={28} />
            <span className="text-sm">
              <span className="font-medium text-ink">{m.opportunity.name}</span>
              <span className="text-ink-faint"> · {KIND_LABEL[m.opportunity.kind].one}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <p className="max-w-[52ch] text-sm leading-relaxed text-ink-faint">{idea.why}</p>
        <button
          type="button"
          onClick={onUse}
          aria-pressed={active}
          disabled={over}
          className={`btn shrink-0 self-start sm:self-auto ${active ? "btn-primary" : "btn-secondary"}`}
        >
          {active ? (
            <>
              <Check className="size-4" strokeWidth={2.5} aria-hidden />
              Using this idea
            </>
          ) : (
            "Use this idea"
          )}
        </button>
      </div>
    </motion.article>
  );
}

export function IdeaSkeleton() {
  return (
    <div className="card p-6 sm:p-7" aria-hidden>
      <span className="skeleton block h-4 w-32" />
      <span className="skeleton mt-4 block h-8 w-3/4" />
      <span className="skeleton mt-4 block h-4 w-full" />
      <span className="skeleton mt-2 block h-4 w-2/3" />
      <span className="mt-5 flex gap-2">
        <span className="skeleton block h-9 w-40 rounded-full" />
        <span className="skeleton block h-9 w-36 rounded-full" />
      </span>
    </div>
  );
}
