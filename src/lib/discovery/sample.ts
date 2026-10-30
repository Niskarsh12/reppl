import { CATEGORY_SCENES, ONLINE_ONLY } from "@/lib/campaign/catalog";
import type { GoalId } from "@/lib/campaign/types";
import type { DemoOpportunity } from "./demo/opportunities";
import { isInPerson } from "./kinds";
import type { DiscoveryRequest, FitLevel, Match, Opportunity } from "./types";

const OFFER = /affiliate|seeding|sampling|offer|bundle|giveaway/i;

/** One sentence on how a partner serves the brand's main goal. */
export function goalAngle(goal: GoalId | undefined, o: Opportunity, brand: string): string {
  switch (goal) {
    case "awareness":
      return `Potential awareness activation for ${brand}; audience familiarity and incremental reach remain unknown.`;
    case "sales": {
      const offer = o.formats.find((f) => OFFER.test(f));
      return offer
        ? `${offer} suits a sales goal: people can try or buy straight away.`
        : "A tracked link with an offer shows exactly who clicks through to buy.";
    }
    case "launch":
      return `${o.formats[0]} gives a new product a proper moment instead of a passing mention.`;
    case "community":
      if (isInPerson(o.kind)) return "You'd meet the same people in person, again and again.";
      if (o.kind === "artist") return "Fans who turn up to every show are a ready-made community.";
      return "Their audience behaves like a group of regulars, not passers-by.";
    case "content":
      if (isInPerson(o.kind)) return "You'd come away with real photos of real customers to reuse.";
      if (o.kind === "podcast") return "Clips and quotes from the episode work well on your own channels.";
      if (o.kind === "brand") return "Everything you make together gets shared on two brands' channels.";
      return "Ask for usage rights: their footage would sit naturally on your own channels.";
    default:
      return "";
  }
}

function fitFor(shared: number, related: number): FitLevel {
  if (shared >= 2) return "strong";
  return shared === 1 && related >= 2 ? "good" : "stretch";
}

export function fromSample(o: DemoOpportunity, location: string): Opportunity {
  const local = isInPerson(o.kind) && location !== ONLINE_ONLY;
  // A pinned physical partner only reads as local in its own city; otherwise
  // it takes the city the brand asked for (illustrative, never verified).
  const city = o.homeCity ? o.homeCity : local ? location : null;
  return {
    id: o.id,
    kind: o.kind,
    name: o.name,
    detail: o.detail,
    city,
    audience: o.reach && o.reachUnit ? { size: o.reach, unit: o.reachUnit } : undefined,
    tags: o.scenes,
    rate: { ...o.rate, basis: o.evidence === "verified" ? ("typical" as const) : ("estimate" as const) },
    formats: o.formats,
    about: o.about,
    source: "sample",
    costEvidence: { status: "illustrative", source: "Fictional demo catalogue; not a quote" },
  };
}

/**
 * Scores catalogue entries by the audience interests they share with the brand.
 * `extra` adds interests found elsewhere, such as Qloo taste tags.
 */
export function matchSample(pool: DemoOpportunity[], { brand, setup }: DiscoveryRequest, limit: number, extra: string[] = []): Match[] {
  const wanted = new Set([...brand.signals, ...extra].map((s) => s.toLowerCase()));
  const nearby = new Set(CATEGORY_SCENES[brand.category].map((s) => s.toLowerCase()));

  const scored = pool.map((o) => {
    const shared = o.scenes.filter((s) => wanted.has(s.toLowerCase()));
    const adjacent = o.scenes.filter((s) => nearby.has(s.toLowerCase()) && !wanted.has(s.toLowerCase()));
    const near = o.scenes.filter((s) => nearby.has(s.toLowerCase())).length;
    const withinBudget = o.rate.min <= setup.budget;
    const goalBonus =
      (setup.goals.includes("community") && isInPerson(o.kind) ? 2 : 0) +
      (setup.goals.includes("content") && (o.kind === "creator" || o.kind === "artist") ? 1 : 0) +
      (setup.goals.includes("sales") && (o.kind === "podcast" || o.kind === "brand") ? 1 : 0) +
      (setup.goals.includes("awareness") && (o.reach ?? 0) >= 50000 ? 1 : 0);
    const score = shared.length * 10 + near * 2 + goalBonus + (withinBudget ? 3 : -8);
    return { o, shared, adjacent, withinBudget, score };
  });

  return scored
    .filter((s) => s.shared.length > 0 || s.adjacent.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ o, shared, adjacent, withinBudget }) => {
      const opportunity = fromSample(o, setup.location);
      const fit = fitFor(shared.length, shared.length + adjacent.length);
      const reach =
        shared.length === 0
          ? `None of your audience interests, but ${adjacent.join(" and ").toLowerCase()} ${adjacent.length === 1 ? "is" : "are"} common ground for brands like yours.`
          : fit === "stretch"
            ? `Only ${shared[0].toLowerCase()} overlaps with your audience, so treat this as an experiment.`
            : "";
      return {
        opportunity,
        shared,
        fit,
        withinBudget,
        whyItFits: [o.about, reach, goalAngle(setup.goals[0], opportunity, brand.name)].filter(Boolean).join(" "),
      };
    });
}
