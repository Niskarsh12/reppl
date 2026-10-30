import type { FitLevel } from "./types";
import type { BrandContext, CulturalSignal } from "./context";

/**
 * A cultural territory is a relevant cultural space in which the brand could
 * build recognition and affinity. It is not a creator category or a trending
 * topic, and it is not a list of people to book.
 *
 * Territories are built deterministically from cultural signals. The archetypes
 * and formats below are hypotheses for where the brand could show up — they are
 * matched against the curated demo catalogue, never presented as verified
 * creators who can be booked today.
 */
export interface CulturalTerritory {
  id: string;
  /** Human-readable name of the territory. */
  name: string;
  /** One-sentence plain-language description. */
  summary: string;
  /** Defining cultural signals of this territory. */
  signals: string[];
  /** Which signals matched, and where each came from (provenance). */
  evidence: { signal: string; source: CulturalSignal["source"] }[];
  /** Why this territory could suit this brand and audience. */
  brandConnection: string;
  /** Creator archetypes this territory could support (hypotheses only). */
  archetypes: string[];
  /** Activation formats that could work here, not tied to any specific person. */
  formats: string[];
  /** What we don't know yet — honest uncertainties. */
  uncertainties: string[];
  /** 0–100 deterministic relevance score for this request. */
  score: number;
}

type TerritoryRule = Omit<CulturalTerritory, "evidence" | "score" | "signals"> & {
  /** Signals that activate this territory. */
  matchSignals: string[];
  /** Weight applied to each matched signal, by provenance. */
  weights: Record<CulturalSignal["source"], number>;
};
/**
 * Curated territory rules. Keep this list small and category-agnostic; the
 * weights make the ranking deterministic and easy to audit.
 */
const TERRITORIES: TerritoryRule[] = [
  {
    id: "daily-rituals",
    name: "Daily rituals",
    summary:
      "Morning and midday moments — coffee, cooking, craft — where the brand can become a regular part of someone's day instead of a one-off mention.",
    matchSignals: ["Specialty coffee", "Home cooking", "Ceramics & craft", "Natural wine"],
    weights: { "user": 2, "qloo-tag": 1.5, "qloo-taste": 1, category: 1 },
    archetypes: ["Local food storytellers", "Home-cooking creators", "Craft and heritage educators"],
    formats: ["Recipe reel", "Studio reel", "Sampling", "Shared workshop"],
    brandConnection: "The brand shows up in the small rituals people already repeat.",
    uncertainties: ["Whether the brand's product fits a daily-ritual moment naturally."],
  },
  {
    id: "active-weekends",
    name: "Active weekends",
    summary:
      "Training, trails and ride culture — the brand meets people while they are active, outdoors and together.",
    matchSignals: ["Run clubs", "Cycling", "Outdoors & camping", "Yoga & breathwork"],
    weights: { "user": 2, "qloo-tag": 1.5, "qloo-taste": 1, category: 1 },
    archetypes: ["Run-club leaders", "Outdoor filmmakers", "Gear reviewers"],
    formats: ["Route video", "Ride sponsor", "Sampling", "Kit giveaway"],
    brandConnection: "The brand belongs where the audience trains and meets at weekends.",
    uncertainties: ["Seasonal relevance; an outdoor territory matters less in off-season months."],
  },
  {
    id: "evening-culture",
    name: "Evening culture",
    summary:
      "Music, listening nights, vinyl and after-dark gatherings — the brand shows up in scenes people choose for pleasure.",
    matchSignals: ["Vinyl & DJ culture", "Natural wine", "Indie gaming", "Film photography"],
    weights: { "user": 2, "qloo-tag": 1.5, "qloo-taste": 1, category: 1 },
    archetypes: ["DJ and listening-night hosts", "Independent venue partners", "Zine and print makers"],
    formats: ["Night sponsor", "Listening kit", "Launch party", "Pop-up"],
    brandConnection: "The brand earns a place in the venues and events the audience already goes to.",
    uncertainties: ["Evening activations are harder to measure than online content."],
  },
  {
    id: "personal-care",
    name: "Personal care & self-care",
    summary:
      "Routines, ingredients and making things last — skincare, repair, slow fashion and plant care.",
    matchSignals: ["Skincare rituals", "Yoga & breathwork", "Slow fashion", "Plant care"],
    weights: { "user": 2, "qloo-tag": 1.5, "qloo-taste": 1, category: 1 },
    archetypes: ["Routine and ingredient educators", "Wellness creators", "Mending and repair advocates"],
    formats: ["Routine video", "Ingredient explainer", "Product seeding", "Repair tutorial"],
    brandConnection: "The brand becomes part of how the audience looks after itself and its things.",
    uncertainties: ["Care claims need ingredient-level evidence the brand may not have yet."],
  },
  {
    id: "family-life",
    name: "Family life",
    summary:
      "Parenting, cooking at home and making things with kids — the brand shows up in the rhythm of family routines.",
    matchSignals: ["Parenting", "Home cooking", "Plant care", "Ceramics & craft"],
    weights: { "user": 2, "qloo-tag": 1.5, "qloo-taste": 1, category: 1 },
    archetypes: ["Family routine creators", "Family event hosts"],
    formats: ["Day-in-the-life reel", "Recipe card", "Take-home kit", "Shared workshop"],
    brandConnection: "The brand earns trust by fitting into family life, not interrupting it.",
    uncertainties: ["Family audiences are protective of kids' attention; tone must be right."],
  },
  {
    id: "money-in-public",
    name: "Money in public life",
    summary:
      "Plain-talk personal finance, community meetups and zine culture — the brand talks money the way friends do.",
    matchSignals: ["Personal finance", "Zines & print", "Specialty coffee"],
    weights: { "user": 2, "qloo-tag": 1.5, "qloo-taste": 1, category: 1 },
    archetypes: ["Plain-language money educators", "Community meetup hosts"],
    formats: ["Explainer video", "Meetup sponsor", "Newsletter sponsor", "Joint giveaway"],
    brandConnection: "The brand becomes a trusted voice in conversations about money.",
    uncertainties: ["Finance-adjacent brands face higher compliance expectations."],
  },
  {
    id: "street-style",
    name: "Street style & creative scenes",
    summary:
      "Streetwear, vintage, indie gaming and cycling culture — the brand shows up in what people wear, play and make.",
    matchSignals: ["Streetwear", "Vintage & thrift", "Indie gaming", "Cycling"],
    weights: { "user": 2, "qloo-tag": 1.5, "qloo-taste": 1, category: 1 },
    archetypes: ["Street photographers", "Style and drop creators", "Sneaker community"],
    formats: ["Lookbook", "Street portrait series", "Giveaway", "Pop-up"],
    brandConnection: "The brand borrows credibility from the scenes the audience dresses for.",
    uncertainties: ["Fast-moving scenes need a longer-term presence, not a one-off post."],
  },
];

const SIGNAL_WEIGHT = { user: 2, "qloo-tag": 1.5, "qloo-taste": 1, category: 1 } as const;
/**
 * Builds the cultural territories relevant to this request, ranked by how many
 * of their defining signals appear in the available signals.
 */
export function buildTerritories(context: BrandContext, signals: CulturalSignal[]): CulturalTerritory[] {
  const available = new Map<string, CulturalSignal>();
  for (const s of signals) available.set(s.name.toLowerCase(), s);

  return TERRITORIES.map((rule) => {
    const { matchSignals, weights, ...territory } = rule;
    const matched = matchSignals.filter((s) => available.has(s.toLowerCase()));
    const score =
      matched.reduce((sum, s) => sum + (weights[available.get(s.toLowerCase())!.source] ?? SIGNAL_WEIGHT.category), 0) *
      10;
    return {
      ...territory,
      signals: matched,
      evidence: matched.map((s) => ({ signal: s, source: available.get(s.toLowerCase())!.source })),
      score,
    };
  }).filter((t) => t.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * The single recommended territory for this request, or null when no territory
 * is supported by any available signal. Callers must handle the null case
 * honestly rather than inventing a territory.
 */
export function recommendedTerritory(context: BrandContext, signals: CulturalSignal[]): CulturalTerritory | null {
  return buildTerritories(context, signals)[0] ?? null;
}

/** Turns a fit level into plain language the UI already renders. */
export function fitLabel(fit: FitLevel): string {
  return { strong: "Strong fit", good: "Good fit", stretch: "Stretch" }[fit];
}