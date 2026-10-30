import { KIND_LABEL } from "./kinds";
import type { GoalId } from "@/lib/campaign/types";
import { fromSample, goalAngle } from "./sample";
import type { DemoOpportunity } from "./demo/opportunities";
import type { OpportunityKind } from "@/lib/discovery/types";
import type { BrandContext } from "./context";
import type { CulturalTerritory } from "./territories";

/**
 * One opportunity matched to one territory, with a transparent, auditable score.
 * This is the engine's currency: nothing is presented to the UI that hasn't been
 * scored against the brand's signals, location, goals and budget.
 */
export interface MatchedPick {
  opportunity: DemoOpportunity;
  territoryId: string;
  /** Overall 0–100 deterministic score. Higher is a better evidenced fit. */
  score: number;
  /** How the score was built, for debugging and honest caveats. */
  breakdown: {
    cultural: number;
    audience: number;
    geographic: number;
    objective: number;
    budget: number;
    evidence: number;
  };
  /** Territory signals this opportunity shares with the brand's signals. */
  shared: string[];
  fit: "strong" | "good" | "stretch";
  withinBudget: boolean;
  whyItFits: string;
}

const MAX_SCORE = 100;

/** Weights for each scoring dimension. Deliberately simple and auditable. */
const WEIGHTS = {
  cultural: 35,
  audience: 20,
  geographic: 15,
  objective: 15,
  budget: 10,
  evidence: 5,
} as const;

function clamp(n: number, max: number) {
  return Math.min(Math.max(n, 0), max);
}

/**
 * Hard filters (Step C): an opportunity only enters the pool when it shares at
 * least one cultural signal with a territory, its lowest illustrative fee fits
 * the budget, and its location claim is honest for the requested market.
 */
function passesHardFilters(
  o: DemoOpportunity,
  territory: CulturalTerritory,
  context: BrandContext,
): { shared: string[]; withinBudget: boolean; ok: boolean } {
  const wanted = new Set([...context.brand.signals, ...territory.signals].map((s) => s.toLowerCase()));
  const shared = o.scenes.filter((s) => wanted.has(s.toLowerCase()));
  if (shared.length === 0) return { shared, withinBudget: false, ok: false };

  const withinBudget = o.rate.min <= context.setup.budget;
  if (!withinBudget) return { shared, withinBudget, ok: false };

  if (o.homeCity && context.online) return { shared, withinBudget, ok: false };
  if (o.homeCity && o.homeCity.toLowerCase() !== context.setup.location.toLowerCase()) {
    return { shared, withinBudget, ok: false };
  }

  return { shared, withinBudget, ok: true };
}

function scorePick(
  o: DemoOpportunity,
  territory: CulturalTerritory,
  context: BrandContext,
  qlooSignals: string[],
): MatchedPick["breakdown"] & { score: number } {
  const wanted = new Set([...context.brand.signals, ...territory.signals].map((s) => s.toLowerCase()));
  const sharedWithBrand = o.scenes.filter((s) => context.brand.signals.map((x) => x.toLowerCase()).includes(s.toLowerCase()));
  const sharedWithTerritory = o.scenes.filter((s) => territory.signals.map((x) => x.toLowerCase()).includes(s.toLowerCase()));

  // Cultural fit: overlap with the territory's defining signals, boosted by
  // direct brand-signal overlap and by Qloo-backed signals.
  const cultural = clamp(
    sharedWithTerritory.length * 8 + sharedWithBrand.length * 6 + qlooSignals.filter((s) => wanted.has(s.toLowerCase())).length * 4,
    WEIGHTS.cultural,
  );

  // Audience relevance: the opportunity's scenes fit the category's audience.
  const audience = clamp(
    territory.signals.filter((s) => o.scenes.map((x) => x.toLowerCase()).includes(s.toLowerCase())).length * 6 +
      (o.reach ? (o.reach >= 50000 ? 4 : o.reach >= 10000 ? 2 : 1) : 1),
    WEIGHTS.audience,
  );

  // Geographic relevance: pinned home city that matches the request wins;
  // unpinned illustrative partners are neutral ("takes the city").
  let geographic = 8;
  if (o.homeCity) geographic = o.homeCity.toLowerCase() === context.setup.location.toLowerCase() ? 15 : 0;
  if (context.online && !o.homeCity) geographic = 10; // online-native partner for an online-only brief

  // Objective alignment: goals favour the kinds and formats they suit.
  const goals = new Set(context.setup.goals);
  let objective = 0;
  if (goals.has("community") && (o.kind === "event" || o.kind === "venue")) objective += 8;
  if (goals.has("content") && (o.kind === "creator" || o.kind === "artist")) objective += 8;
  if (goals.has("sales") && (o.kind === "podcast" || o.kind === "brand")) objective += 6;
  if (goals.has("awareness") && (o.reach ?? 0) >= 50000) objective += 6;
  if (goals.has("launch") && (o.kind === "brand" || o.kind === "event")) objective += 4;
  objective = clamp(objective, WEIGHTS.objective);

  // Budget feasibility: cheaper illustrative partners leave room for more tests.
  let budgetScore = 0;
  if (o.rate.min <= context.setup.budget * 0.25) budgetScore = 10;
  else if (o.rate.min <= context.setup.budget * 0.5) budgetScore = 7;
  else budgetScore = 4;

  // Evidence quality: Qloo-backed signals make the cultural link more grounded;
  // sample-only territories are still useful but clearly less evidenced.
  const qlooBacked = territory.evidence.some((e) => e.source === "qloo-tag" || e.source === "qloo-taste");
  const evidence = qlooBacked ? 5 : 2;

  const score = cultural + audience + geographic + objective + budgetScore + evidence;
  return { cultural, audience, geographic, objective, budget: budgetScore, evidence, score: clamp(score, MAX_SCORE) };
}

function pickFit(shared: string[]): "strong" | "good" | "stretch" {
  if (shared.length >= 2) return "strong";
  return shared.length === 1 ? "good" : "stretch";
}

/**
 * Matches curated demo opportunities to cultural territories for this request.
 * Deterministic, no randomness, no popularity contest: fit is evidence, not
 * follower count. Returns picks already sorted by score.
 */
export function matchOpportunities(
  territories: CulturalTerritory[],
  pools: Partial<Record<OpportunityKind, DemoOpportunity[]>>,
  context: BrandContext,
  qlooSignals: string[] = [],
  options: { limitPerTerritory?: number; totalLimit?: number } = {},
): MatchedPick[] {
  const limitPerTerritory = options.limitPerTerritory ?? 3;
  const totalLimit = options.totalLimit ?? 10;

  const picks: MatchedPick[] = [];
  const used = new Set<string>();

  for (const territory of territories) {
    const candidates: DemoOpportunity[] = [];
    for (const kind of Object.keys(pools) as OpportunityKind[]) {
      const pool = pools[kind];
      if (!pool) continue;
      for (const o of pool) {
        if (used.has(o.id)) continue;
        if (!o.scenes.some((s) => territory.signals.map((x) => x.toLowerCase()).includes(s.toLowerCase()))) continue;
        candidates.push(o);
      }
    }

    const scored = candidates.map((o) => {
      const hard = passesHardFilters(o, territory, context);
      if (!hard.ok) return null;
      const base = scorePick(o, territory, context, qlooSignals);
      const pick: MatchedPick = {
        opportunity: o,
        territoryId: territory.id,
        score: base.score,
        breakdown: base,
        shared: hard.shared,
        fit: pickFit(hard.shared),
        withinBudget: hard.withinBudget,
        whyItFits: "",
      };
      return pick;
    });
    const ordered = scored
      .filter((p): p is MatchedPick => p !== null)
      .sort((a, b) => b.score - a.score || a.opportunity.id.localeCompare(b.opportunity.id));
    for (const pick of ordered.slice(0, limitPerTerritory)) {
      used.add(pick.opportunity.id);
      picks.push(pick);
    }
  }

  picks.sort((a, b) => b.score - a.score || a.opportunity.id.localeCompare(b.opportunity.id));
  return picks.slice(0, totalLimit);
}

/**
 * Writes the plain-language fit explanation for a pick, grounded in the
 * territory's evidence and the brand's goal. No fabricated claims.
 */
export function writeWhyItFits(
  pick: MatchedPick,
  territory: CulturalTerritory,
  context: BrandContext,
  goals: GoalId[],
): string {
  const qlooSignals = territory.evidence
    .filter((e) => e.source === "qloo-tag" || e.source === "qloo-taste")
    .map((e) => e.signal)
    .slice(0, 2);
  const opportunity = fromSample(pick.opportunity, context.setup.location);

  const parts: string[] = [];
  parts.push(
    `${territory.summary} A ${KIND_LABEL[pick.opportunity.kind].one.toLowerCase()} like ${pick.opportunity.name} could help ${context.brand.name} show up here.`,
  );
  if (qlooSignals.length) {
    parts.push(
      `Qloo ties this audience to ${qlooSignals.join(" and ")}, which is why ${pick.opportunity.name}'s scenes (${pick.shared.join(
        ", ",
      )}) are relevant.`,
    );
  } else {
    parts.push(`${pick.opportunity.name}'s scenes (${pick.shared.join(", ")}) overlap with your audience interests.`);
  }
  if (goals.length) parts.push(goalAngle(goals[0], opportunity, context.brand.name));
  if (!pick.withinBudget) parts.push("Its illustrative fee sits above the brief's budget, so it is listed as a stretch only.");
  return parts.join(" ");
}

/**
 * Converts a scored pick into the UI-facing `Match` shape. Nothing in this
 * conversion invents data: the opportunity record is the source of truth.
 */
export function toMatch(
  pick: MatchedPick,
  territory: CulturalTerritory,
  context: BrandContext,
  goals: GoalId[],
): import("./types").Match {
  const opportunity = fromSample(pick.opportunity, context.setup.location);
  return {
    opportunity,
    shared: pick.shared,
    fit: pick.fit,
    withinBudget: pick.withinBudget,
    whyItFits: writeWhyItFits(pick, territory, context, goals),
  };
}