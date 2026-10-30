import { CATEGORY_SCENES, ONLINE_ONLY } from "./catalog";
import type { CampaignSetup } from "./types";
import { isInPerson } from "../discovery/kinds";
import type { DiscoveryRequest, Match } from "../discovery/types";

const norm = (s: string) => s.trim().toLowerCase();
export const PORTFOLIO_LIMIT = 6;

/** Reserve the upper estimate, never a fraction of an unaffordable minimum. */
export function opportunityCost(m: Match): number | null {
  const { rate, costEvidence } = m.opportunity;
  if (costEvidence?.status === "unknown" || !Number.isSafeInteger(rate.min) || !Number.isSafeInteger(rate.max) || rate.min < 0 || rate.max < rate.min || (rate.max === 0 && !["quoted", "published"].includes(costEvidence?.status ?? ""))) return null;
  return rate.max;
}

export function ineligibleReason(m: Match, setup: CampaignSetup): string | null {
  const o = m.opportunity;
  if (o.eligibility?.reason) return o.eligibility.reason;
  if (o.eligibility?.available === false) return "Marked unavailable.";
  if (o.eligibility?.goals && !setup.goals.some(g => o.eligibility!.goals!.includes(g))) return "Does not support the required campaign objectives.";
  if (o.eligibility?.markets && !o.eligibility.markets.map(norm).includes(norm(setup.location))) return "Outside the eligible campaign markets.";
  if (o.commercial ? o.commercial.offer.delivery === "in-person" : isInPerson(o.kind)) {
    if (setup.location === ONLINE_ONLY) return "In-person opportunity excluded from an online-only campaign.";
    if (!o.city) return "Physical location is unknown; confirm geography first.";
    if (norm(o.city) !== norm(setup.location)) return "Physical location does not match the campaign market.";
  }
  if (opportunityCost(m) === null) return "Cost is unknown or invalid; obtain a quote before committing budget.";
  return null;
}

/** Preserve the user's order while removing infeasible commitments. */
export function feasibleSelection(matches: Match[], setup: CampaignSetup): Match[] {
  let remaining = Number.isSafeInteger(setup.budget) && setup.budget >= 0 ? setup.budget : 0;
  const chosen: Match[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const cost = opportunityCost(m);
    if (chosen.length >= PORTFOLIO_LIMIT || seen.has(m.opportunity.id) || ineligibleReason(m, setup) || cost === null || cost > remaining) continue;
    seen.add(m.opportunity.id);
    remaining -= cost;
    chosen.push(m);
  }
  return chosen;
}

export interface PortfolioSummary {
  ids: string[];
  totalCost: number;
  remaining: number;
  score: number;
  segments: string[];
}
export interface PortfolioDecision {
  id: string;
  selected: boolean;
  reason: string;
  unknowns: string[];
  evidence?: string[];
}
export interface PortfolioResult {
  recommended: PortfolioSummary;
  baseline: PortfolioSummary;
  decisions: PortfolioDecision[];
  redundancies: { ids: string[]; segments: string[] }[];
  method: string;
  assumptions: string[];
}

/** Same evaluator powers recommendations, manual selections, and the baseline. */
export function optimizePortfolio(matches: Match[], request: DiscoveryRequest): PortfolioResult {
  const budget = Number.isSafeInteger(request.setup.budget) && request.setup.budget >= 0 ? request.setup.budget : 0;
  const wanted = new Set(request.brand.signals.map(norm));
  const contextText = norm(`${request.brand.audience ?? ""} ${request.brand.summary ?? ""}`);
  const adjacent = new Set(CATEGORY_SCENES[request.brand.category].map(norm));
  const unique = [...new Map(matches.map(m => [m.opportunity.id, m])).values()].sort((a, b) => a.opportunity.id.localeCompare(b.opportunity.id));
  const segments = (m: Match) => [...new Set(m.opportunity.tags.map(norm))].filter(t => wanted.has(t) || adjacent.has(t) || (t.length >= 3 && contextText.includes(t)));
  const cultural = (m: Match) => m.opportunity.source === "offer" && !m.opportunity.culturalEvidence?.identityConfirmed ? undefined : m.opportunity.culturalEvidence;
  const strength = (m: Match) => {
    const raw = cultural(m)?.affinity ?? m.opportunity.affinity;
    // Unrecognised affinity scales are preserved as evidence, never guessed into percentages.
    return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.35;
  };
  const goalScore = (m: Match) => request.setup.goals.reduce((sum, goal) => {
    const { kind, formats } = m.opportunity;
    if (m.opportunity.commercial?.offer.goals.includes(goal)) return sum + 5;
    const aligned = goal === "community" ? isInPerson(kind) || kind === "artist"
      : goal === "content" ? ["creator", "artist", "podcast"].includes(kind)
      : goal === "sales" ? formats.some(f => /affiliate|sampling|offer|bundle|giveaway/i.test(f))
      : goal === "launch" ? formats.some(f => /launch|event|sampling|pop-up/i.test(f))
      : true;
    return sum + (aligned ? 5 : 1);
  }, 0) / Math.max(1, request.setup.goals.length);
  const summarize = (items: Match[]): PortfolioSummary => {
    const coverage = new Map<string, number>();
    for (const m of items) for (const tag of segments(m)) coverage.set(tag, Math.max(coverage.get(tag) ?? 0, (wanted.has(tag) ? 12 : contextText.includes(tag) ? 8 : 4) * (0.5 + strength(m))));
    // Repeated tags contribute only their strongest signal; no additive audience reach.
    let score = [...coverage.values()].reduce((s, v) => s + v, 0);
    for (const m of items) score += goalScore(m) - (!segments(m).length && !cultural(m) ? (m.opportunity.source === "offer" ? 2 : 6) : 0) - (m.opportunity.source === "sample" ? 2 : 0) - (!m.opportunity.audience ? 1 : 0) - (m.opportunity.rate.basis === "estimate" ? 1 : 0) - (m.opportunity.commercial?.provisional ? 4 : 0);
    const entityStrengths = new Map<string, number>();
    for (const m of items) { const e = cultural(m); if (e) entityStrengths.set(e.entityId, Math.max(entityStrengths.get(e.entityId) ?? 0, strength(m))); }
    score += [...entityStrengths.values()].reduce((sum, value) => sum + 8 * value, 0);
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = segments(items[i]), b = segments(items[j]);
      const union = new Set([...a, ...b]).size;
      if (union) score -= 8 * a.filter(t => b.includes(t)).length / union;
    }
    const totalCost = items.reduce((s, m) => s + (opportunityCost(m) ?? 0), 0);
    return { ids: items.map(m => m.opportunity.id), totalCost, remaining: budget - totalCost, score: Math.round(score * 1000) / 1000, segments: [...coverage.keys()].sort() };
  };
  const eligible = unique.filter(m => !ineligibleReason(m, request.setup) && opportunityCost(m)! <= budget);
  const better = (a: PortfolioSummary, b: PortfolioSummary) => a.score > b.score || (a.score === b.score && (a.totalCost < b.totalCost || (a.totalCost === b.totalCost && a.ids.join() < b.ids.join())));
  const ranked = [...eligible].sort((a, b) => summarize([b]).score - summarize([a]).score || a.opportunity.id.localeCompare(b.opportunity.id));
  const base: Match[] = [];
  let spent = 0;
  for (const m of ranked) if (base.length < PORTFOLIO_LIMIT && opportunityCost(m)! <= budget - spent) { base.push(m); spent += opportunityCost(m)!; }
  const baseline = summarize(base);
  let best = summarize([]);
  if (eligible.length <= 20) {
    const search = (start: number, chosen: Match[], cost: number) => {
      const current = summarize(chosen);
      if (better(current, best)) best = current;
      if (chosen.length === PORTFOLIO_LIMIT) return;
      for (let i = start; i < eligible.length; i++) {
        const next = opportunityCost(eligible[i])!;
        if (next <= budget - cost) search(i + 1, [...chosen, eligible[i]], cost + next);
      }
    };
    search(0, [], 0);
  } else {
    const chosen: Match[] = [];
    while (chosen.length < PORTFOLIO_LIMIT) {
      let next: Match | undefined;
      let candidate = best;
      for (const m of eligible) if (!chosen.includes(m) && opportunityCost(m)! <= budget - best.totalCost) {
        const trial = summarize([...chosen, m]);
        if (better(trial, candidate)) { candidate = trial; next = m; }
      }
      if (!next) break;
      chosen.push(next); best = candidate;
    }
  }
  if (better(baseline, best)) best = baseline;
  const selected = unique.filter(m => best.ids.includes(m.opportunity.id));
  const redundancies: PortfolioResult["redundancies"] = [];
  for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) {
    const shared = segments(selected[i]).filter(t => segments(selected[j]).includes(t));
    if (shared.length) redundancies.push({ ids: [selected[i].opportunity.id, selected[j].opportunity.id], segments: shared });
  }
  return {
    recommended: best, baseline, redundancies,
    method: eligible.length <= 20 ? "Exhaustive feasible subset search (up to six partners)." : "Deterministic marginal-value greedy search, compared with the individual-ranking baseline.",
    assumptions: ["Costs reserve the recorded upper price plus declared extras. User-recorded quotes and availability are not independently verified. Conditional scenarios may contain estimates or pending evidence.", "Shared cultural tags are a qualitative redundancy proxy, not measured audience overlap or independent reach.", "Scores are decision heuristics, not predicted ROI. Format-based objective alignment is a hypothesis.", "Missing-cost opportunities stay in the alternatives for quote follow-up; no budget is committed to them."],
    decisions: unique.map(m => {
      const chosen = best.ids.includes(m.opportunity.id);
      const reason = ineligibleReason(m, request.setup);
      const tags = segments(m);
      return { id: m.opportunity.id, selected: chosen,
        evidence: m.opportunity.commercial ? [
          `Price: ${m.opportunity.commercial.offer.price.basis}; package USD ${m.opportunity.commercial.offer.price.amount ?? "unknown"}, extras USD ${m.opportunity.commercial.offer.price.extras}. Source: ${m.opportunity.commercial.offer.price.source || "missing"}. Checked ${m.opportunity.commercial.offer.price.checkedAt || "date missing"}; valid until ${m.opportunity.commercial.offer.price.validUntil || "not specified"}.`,
          `Availability: ${m.opportunity.commercial.offer.availability.status}. Source: ${m.opportunity.commercial.offer.availability.source || "missing"}. Checked ${m.opportunity.commercial.offer.availability.checkedAt || "date missing"}; valid until ${m.opportunity.commercial.offer.availability.validUntil || "not specified"}.`,
          `Audience: ${m.opportunity.commercial.offer.audience.size ?? "unknown"} ${m.opportunity.commercial.offer.audience.unit}; ${m.opportunity.commercial.offer.audience.basis}. Source: ${m.opportunity.commercial.offer.audience.source || "missing"}. Checked ${m.opportunity.commercial.offer.audience.checkedAt || "date missing"}.`,
          `Evidence assessed as of ${m.opportunity.commercial.asOf}. ${m.opportunity.commercial.provisional ? "Provisional scenario." : "Current user-recorded commercial evidence."}`,
        ] : [],
        reason: chosen ? `Selected for ${tags.length ? tags.join(", ") : "objective-compatible formats"}; marginal portfolio value ${Math.round((best.score - summarize(selected.filter(x => x !== m)).score) * 1000) / 1000}. ${m.whyItFits}`
          : reason ?? (opportunityCost(m)! > budget ? "Upper cost estimate exceeds the total budget." : opportunityCost(m)! > best.remaining ? "Does not fit the remaining budget; alternative combinations were evaluated." : "Lower complementary value after cultural redundancy and uncertainty penalties, or the six-partner limit."),
        unknowns: [...(m.opportunity.commercial?.warnings ?? []), m.opportunity.source === "sample" ? "Illustrative partner, costs and audience; not verified inventory." : "Availability and commercial outcomes are unverified.", ...(!m.opportunity.audience ? ["Audience size and overlap are unknown."] : ["Audience overlap is unknown."]), ...(m.opportunity.rate.basis === "estimate" ? ["Fee is an estimate, not a quote."] : []), ...(!cultural(m) ? ["No entity-level Qloo affinity for this opportunity."] : [])] };
    }),
  };
}
