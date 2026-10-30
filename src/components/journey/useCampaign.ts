"use client";

import { calendarDate } from "@/lib/offers/date";

import { refreshOfferMatches } from "@/lib/offers/evaluate";
import { optimizePortfolio, feasibleSelection } from "@/lib/campaign/optimizer";
import { useMemo } from "react";
import { buildPlan, draftPitch } from "@/lib/campaign/plan";
import type { PitchDraft } from "@/lib/campaign/types";
import type { Match } from "@/lib/discovery/types";
import { useJourney } from "./JourneyProvider";

/** The plan and pitches derived from the journey. Edited pitches override the drafts. */
export function useCampaign() {
  const { state } = useJourney();
  const { profile, setup, discovery, selected, idea: ideaId, pitches: edits, startedAt } = state;

  const asOf = calendarDate();
  return useMemo(() => {
    if (!profile || !setup || !discovery) return null;
    const allMatches = refreshOfferMatches(discovery.result, { brand: profile, setup }, asOf);
    const byId = new Map(allMatches.map((m) => [m.opportunity.id, m]));
    const requested = selected.map((id) => byId.get(id)).filter((m): m is Match => !!m);
    const portfolio = optimizePortfolio(allMatches, { brand: profile, setup });
    const matches = feasibleSelection(requested, setup);
    const feasible = matches.map(m => m.opportunity.id);
    const idea = discovery.result.ideas.find((i) => i.id === ideaId && i.anchors.every(id => feasible.includes(id))) ?? null;
    const plan = { ...buildPlan(profile, setup, matches, startedAt || new Date().toISOString(), idea),
      decisionBrief: { mode: discovery.result.source.id === "offers-conditional" ? "conditional" as const : "standard" as const, selectedIds: matches.map(m => m.opportunity.id), portfolio, names: Object.fromEntries(allMatches.map(m => [m.opportunity.id, m.opportunity.name])) } };
    const drafts: Record<string, PitchDraft> = {};
    const pitches: Record<string, PitchDraft> = {};
    matches.forEach((m, i) => {
      drafts[m.opportunity.id] = draftPitch(profile, setup, m, plan.lines[i].amount, idea);
      pitches[m.opportunity.id] = edits[m.opportunity.id] ?? drafts[m.opportunity.id];
    });
    return {
      allMatches,
      asOf,
      portfolio,
      profile,
      setup,
      matches,
      plan,
      idea,
      drafts,
      pitches,
      isDemo: discovery.result.source.isDemo || matches.some(m => m.opportunity.source === "sample"),
      estimated: matches.some((m) => m.opportunity.rate.basis === "estimate"),
    };
  }, [profile, setup, discovery, selected, ideaId, edits, startedAt, asOf]);
}

export type Campaign = NonNullable<ReturnType<typeof useCampaign>>;
