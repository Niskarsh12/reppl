import { DEMO_EVENTS, type DemoOpportunity } from "./demo/opportunities";
import { fromSample, matchSample } from "./sample";
import type { DiscoveryRequest, FitLevel, Match } from "./types";

/**
 * Cultural words a sample event can be found by. A live events API replaces
 * this table and the catalogue; the search still starts from Qloo's taste tags.
 */
const EVENT_CULTURE: Record<string, string[]> = {
  "saturday-slow-market": ["coffee", "craft", "vintage", "market", "ceramics"],
  "dawn-patrol-5k": ["running", "marathon", "fitness", "yoga"],
  "low-light-listening": ["vinyl", "indie", "folk", "music", "rock", "dj"],
  "table-for-twenty": ["cooking", "wine", "coffee", "food"],
  "print-and-paper-fair": ["books", "zines", "photography", "print"],
  "second-life-swap": ["fashion", "vintage", "thrift", "sustainable fashion", "streetwear"],
  "open-studio-weekend": ["design", "interior", "craft", "art"],
  "pixel-picnic": ["games", "gaming", "indie", "streetwear"],
  "sunrise-breath-club": ["yoga", "wellness", "skincare", "running"],
  "gravel-and-grain": ["cycling", "coffee", "outdoors"],
  "little-makers-morning": ["parenting", "family", "craft"],
  "money-talks": ["finance", "investing", "coffee", "money"],
};

/**
 * Local events to sponsor. Qloo doesn't list dated events, so this is a separate
 * feed: today a sample catalogue searched with Qloo's taste tags, later a
 * ticketing or listings API. A live implementation returns the same `Match` shape.
 */
export interface EventsProvider {
  readonly isSample: boolean;
  /**
   * `culture` is the taste the brand's audience over-indexes on, usually Qloo tag
   * names. The feed is searched with those words, not with the brand's category.
   */
  find(request: DiscoveryRequest, culture: string[], limit: number, signal: AbortSignal): Promise<Match[]>;
}

function loose(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

function matchEvents(pool: DemoOpportunity[], request: DiscoveryRequest, culture: string[], limit: number): Match[] {
  const signals = request.brand.signals.map((s) => s.toLowerCase());
  const queries = culture.map((c) => c.toLowerCase()).filter((c) => c.length >= 3);

  const scored = pool.map((o) => {
    const keys = EVENT_CULTURE[o.id] ?? [];
    const sharedCulture = [...new Set(queries.filter((q) => keys.some((k) => loose(k, q))))].slice(0, 3);
    const sharedScenes = o.scenes.filter((s) => signals.some((sig) => loose(s.toLowerCase(), sig)) || queries.some((q) => loose(s.toLowerCase(), q)));
    return { o, sharedCulture, sharedScenes, score: sharedCulture.length * 10 + sharedScenes.length * 4 };
  });

  const picked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!picked.length) return matchSample(pool, request, limit, culture);

  return picked.map(({ o, sharedCulture, sharedScenes }) => {
    const via = (sharedCulture.length ? sharedCulture : sharedScenes).slice(0, 3);
    const searched = via.length ? `the search for ${via.join(", ")}` : "the audience's taste";
    const shared = [...new Set([...sharedScenes, ...sharedCulture])].slice(0, 3);
    const fit: FitLevel = shared.length >= 2 ? "good" : "stretch";
    const opportunity = fromSample(o, request.setup.location);
    return {
      opportunity,
      shared,
      fit,
      withinBudget: o.rate.min <= request.setup.budget,
      whyItFits: `Sample listing, standing in for a live events feed. It came up from ${searched}.`,
    };
  });
}

export const sampleEvents: EventsProvider = {
  isSample: true,
  async find(request, culture, limit) {
    return matchEvents(DEMO_EVENTS, request, culture, limit);
  },
};

export function getEventsProvider(): EventsProvider {
  return sampleEvents;
}
