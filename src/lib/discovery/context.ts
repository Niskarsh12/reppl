import { CATEGORY_AUDIENCE, CATEGORY_SCENES, ONLINE_ONLY } from "@/lib/campaign/catalog";
import type { BrandCategoryId, CampaignSetup } from "@/lib/campaign/types";
import type { DiscoveryRequest } from "./types";

/** The brand and campaign context the decision engine works from. (Step A) */
export interface BrandContext {
  brand: { name: string; domain: string; category: BrandCategoryId; signals: string[] };
  setup: CampaignSetup;
  /** Plain-language description of who this category typically speaks to (category-level, not verified). */
  categoryAudience: string;
  /** Scenes adjacent to the brand's category, used to extend thin signal lists. */
  adjacentScenes: string[];
  /** True when the brand asked for online-only activation. */
  online: boolean;
}

/**
 * Normalises the user's brand and campaign inputs into one internal context.
 * Only fields the UI already captures are used; nothing is invented.
 */
export function normalizeBrandContext(request: DiscoveryRequest): BrandContext {
  const { brand, setup } = request;
  const online = setup.location === ONLINE_ONLY;
  const category = brand.category;
  const adjacentScenes = CATEGORY_SCENES[category].filter((s) => !brand.signals.includes(s));

  return {
    brand,
    setup,
    categoryAudience: CATEGORY_AUDIENCE[category],
    adjacentScenes,
    online,
  };
}

/** Every signal the engine may reason about, tagged by where it came from. */
export interface CulturalSignal {
  name: string;
  source: "user" | "qloo-tag" | "qloo-taste" | "category";
}

/** All signals available for a request, with provenance. */
export function collectSignals(context: BrandContext, qloo: { tags: string[]; tasteTags: string[] }): CulturalSignal[] {
  const signals: CulturalSignal[] = [];
  for (const name of context.brand.signals) signals.push({ name, source: "user" });
  for (const name of qloo.tags) {
    const existing = signals.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing >= 0) signals[existing] = { name, source: "qloo-tag" };
    else signals.push({ name, source: "qloo-tag" });
  }
  for (const name of qloo.tasteTags) {
    if (!signals.some((s) => s.name === name)) signals.push({ name, source: "qloo-taste" });
  }
  for (const name of context.adjacentScenes) {
    if (!signals.some((s) => s.name === name)) signals.push({ name, source: "category" });
  }
  return signals;
}

export function signalNames(signals: CulturalSignal[]): string[] {
  return signals.map((s) => s.name);
}

export function qlooSignalNames(signals: CulturalSignal[]): string[] {
  return signals.filter((s) => s.source === "qloo-tag" || s.source === "qloo-taste").map((s) => s.name);
}

export function hasQlooSignal(signals: CulturalSignal[]): boolean {
  return signals.some((s) => s.source === "qloo-tag" || s.source === "qloo-taste");
}