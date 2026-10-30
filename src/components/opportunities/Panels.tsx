"use client";

import { opportunityCost } from "@/lib/campaign/optimizer";
import { motion } from "motion/react";
import { ONLINE_ONLY, money, possessive } from "@/lib/campaign/catalog";
import { KINDS, kindCount } from "@/lib/discovery/kinds";
import type { AudienceProfile, CategoryContrast, DiscoveryStep, TasteTag } from "@/lib/discovery/types";
import { EASE_OUT } from "@/lib/motion";
import { StatusLine, type StatusTone } from "../ui/Status";
import type { DiscoveryView } from "./useDiscoveryStream";

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function found(view: DiscoveryView) {
  return joinList(
    KINDS.map((k) => [k, view.matches.filter((m) => m.opportunity.kind === k).length] as const)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => kindCount(k, n)),
  );
}

export function AgentPanel({ view, brand, budget, location }: { view: DiscoveryView; brand: string; budget: number; location: string }) {
  const failed = view.status === "error";
  const qloo = view.source?.isDemo === false;
  const within = view.matches.filter(m => opportunityCost(m) !== null && opportunityCost(m)! <= budget).length;
  const tone = (step: DiscoveryStep): StatusTone => {
    const state = view.steps[step];
    if (state === "done") return "done";
    if (state === "active") return failed ? "error" : "working";
    return "pending";
  };
  const notes = view.result?.notes ?? [];

  if (view.status === "complete") {
    return (
      <div className="card p-6">
        <h2 className="sr-only">What the agent did</h2>
        <StatusLine
          tone="done"
          detail={`${within} of ${view.matches.length} partners have upper estimates within ${money(budget)}.`}
        >
          {view.ideas.length} campaign {view.ideas.length === 1 ? "idea" : "ideas"} from {view.matches.length} partners
        </StatusLine>
        {notes.length > 0 && (
          <ul className="mt-5 grid gap-2 text-sm leading-relaxed text-ink-faint">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const near = location === ONLINE_ONLY ? "" : `, places near ${location}`;
  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold">What the agent is doing</h2>
      <ol className="mt-5 grid gap-5">
        <li>
          <StatusLine tone={tone("brand")} detail={view.details.brand}>
            {qloo ? <>Looking up {brand} in Qloo</> : <>Reading {possessive(brand)} audience interests</>}
          </StatusLine>
        </li>
        <li>
          <StatusLine
            tone={tone("taste")}
            detail={view.steps.taste === "done" && view.audience && `${view.audience.tags.length} taste signals.`}
          >
            Mapping what that audience is into
          </StatusLine>
        </li>
        <li>
          <StatusLine
            tone={tone("search")}
            detail={view.steps.search === "active" ? `${view.matches.length} found so far.` : view.steps.search === "done" && `${found(view)}.`}
          >
            Finding artists, creators, podcasts{near} and brands
          </StatusLine>
        </li>
        {view.searchesEvents && (
          <li>
            <StatusLine tone={tone("events")} detail={view.details.events}>
              {qloo ? "Searching a sample calendar for that culture" : `Checking sample events near ${location}`}
            </StatusLine>
          </li>
        )}
        <li>
          <StatusLine tone={tone("ideas")} detail={view.steps.ideas === "done" && `${view.ideas.length} ideas.`}>
            Drafting campaign ideas for <span className="num">{money(budget)}</span>
          </StatusLine>
        </li>
      </ol>
    </div>
  );
}

const GROUPS: { id: TasteTag["group"]; label: string }[] = [
  { id: "music", label: "Music" },
  { id: "lifestyle", label: "Lifestyle and brands" },
  { id: "places", label: "Places" },
  { id: "interests", label: "Interests" },
];

function skewLine(skew: NonNullable<AudienceProfile["skew"]>) {
  const ages = skew.age.length ? `people aged ${joinList(skew.age)}` : "";
  const gender = skew.gender === "female" ? "more women than men" : skew.gender === "male" ? "more men than women" : "";
  return `Skews toward ${[ages, gender].filter(Boolean).join(", and ")}.`;
}

export function AudiencePanel({ audience, brand, animate }: { audience: AudienceProfile; brand: string; animate: boolean }) {
  const qloo = audience.source === "qloo";
  const groups = GROUPS.map((g) => ({ ...g, tags: audience.tags.filter((t) => t.group === g.id) })).filter((g) => g.tags.length);
  return (
    <motion.section
      className="card p-6"
      aria-labelledby="audience-title"
      initial={animate ? { opacity: 0, transform: "translateY(8px)" } : false}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      <p className="text-sm text-ink-faint">{qloo ? "Taste profile from Qloo" : "Audience interests"}</p>
      <h2 id="audience-title" className="mt-1 text-base font-semibold">
        What {possessive(audience.entity?.name ?? brand)} audience is into
      </h2>
      {audience.skew && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{skewLine(audience.skew)}</p>}
      <div className="mt-5 grid gap-4">
        {groups.map((g) => (
          <div key={g.id}>
            {groups.length > 1 && <h3 className="text-sm text-ink-faint">{g.label}</h3>}
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {g.tags.map((t) => (
                <li key={t.name} className="pill pill-lavender">
                  {t.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {!qloo && (
        <p className="mt-5 text-sm leading-relaxed text-ink-faint">
          Illustrative interests from your editable profile and category; these are not verified audience research.
        </p>
      )}
    </motion.section>
  );
}

export function ContrastPanel({ contrast, brand }: { contrast: CategoryContrast; brand: string }) {
  const found = contrast.found.slice(0, 3);
  const culture = contrast.culture.slice(0, 4);
  const names = found.length <= 1 ? found[0] ?? "" : `${found.slice(0, -1).join(", ")} and ${found.at(-1)}`;
  return (
    <section className="card p-6 sm:p-7" aria-labelledby="contrast-title">
      <p className="text-sm text-ink-faint">Where a category search would start</p>
      <h2 id="contrast-title" className="mt-1 font-serif text-[1.6rem] leading-tight tracking-[-0.02em]">
        The obvious buy, then the culture around {brand}
      </h2>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
        {found.length
          ? `A directory looking for ${contrast.lookedFor} would start with ${names}.`
          : `A directory would look for ${contrast.lookedFor}.`}
        {contrast.sample && " Those names are illustrative."}
      </p>
      {culture.length > 0 && (
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          {contrast.sample ? "The illustrative interest model connects this brief" : "Qloo associates this cultural seed"} with {culture.join(", ")}. The ideas below start from that, so the pitch has a culture to talk about.
        </p>
      )}
      {culture.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {culture.map((tag) => (
            <li key={tag} className="pill pill-lavender">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
