import "server-only";
import { ONLINE_ONLY } from "@/lib/campaign/catalog";
import { buildIdeas } from "@/lib/campaign/ideas";
import { QlooError, qloo, type QlooEntity, type QlooSkew, type QlooTag } from "@/lib/qloo/client";
import { SCENE_QUERIES } from "@/lib/qloo/scenes";
import { getEventsProvider } from "../events";
import { OBVIOUS_SEARCH } from "../obvious";
import { demoProvider } from "../demo/provider";
import {
  DEMO_ARTISTS,
  DEMO_BRANDS,
  DEMO_CREATORS,
  DEMO_PODCASTS,
  DEMO_VENUES,
  type DemoOpportunity,
} from "../demo/opportunities";
import type {
  AudienceProfile,
  CategoryContrast,
  DataSource,
  DiscoveryEvent,
  DiscoveryProvider,
  DiscoveryRequest,
  Match,
  OpportunityKind,
  TasteTag,
} from "../types";
import { collectSignals, hasQlooSignal, normalizeBrandContext, qlooSignalNames } from "../context";
import { buildTerritories, recommendedTerritory } from "../territories";
import { matchOpportunities, toMatch } from "../matching";

export const QLOO_SOURCE: DataSource = { id: "qloo", label: "Qloo taste graph", isDemo: false };


type Params = Record<string, string | number>;

const TASTE_GROUPS: { group: TasteTag["group"]; parents: string; local: boolean }[] = [
  { group: "music", parents: "urn:entity:artist", local: false },
  { group: "lifestyle", parents: "urn:entity:brand", local: false },
  { group: "places", parents: "urn:entity:place", local: true },
];

const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "under 25",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55 and over",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Swallows a failed lookup so one empty corner of the graph doesn't stop the run. */
function soft<T>(fallback: T, signal: AbortSignal) {
  return (error: unknown): T => {
    if (signal.aborted) throw error;
    console.warn("[qloo]", error instanceof Error ? error.message : error);
    return fallback;
  };
}

async function resolveBrand(name: string, domain: string, signal: AbortSignal) {
  const label = domain.replace(/^www\./, "").split(".")[0] ?? "";
  const queries = uniqueBy([name, label].filter(Boolean), norm);
  for (const query of queries) {
    const target = norm(query);
    const results = await qloo.search(query, "urn:entity:brand", 5, signal);
    const hit =
      results.find((r) => norm(r.name) === target) ??
      results.find((r) => {
        const n = norm(r.name);
        return n.length >= 4 && (n.startsWith(target) || target.startsWith(n));
      });
    if (hit) return hit;
  }
  return null;
}

async function resolveTag(scene: string, signal: AbortSignal): Promise<QlooTag | null> {
  for (const query of SCENE_QUERIES[scene] ?? [scene.toLowerCase()]) {
    const found = await qloo.tags(query, 8, signal);
    const pick = found.find((t) => t.name.toLowerCase() === query) ?? found.find((t) => t.name.toLowerCase().includes(query));
    if (pick) return pick;
  }
  return null;
}

async function tasteProfile(seed: Params, location: string, signal: AbortSignal): Promise<TasteTag[]> {
  const groups = await Promise.all(
    TASTE_GROUPS.map(async ({ group, parents }) => {
      const params: Params = { ...seed, "filter.parents.types": parents, take: 10 };
      const run = (p: Params) => qloo.tasteTags(p, signal);
      const found =
        location !== ONLINE_ONLY
          ? await run({ ...params, "signal.location.query": location }).catch(() => run(params))
          : await run(params);
      return found.filter((t) => t.name.length <= 32).map((t) => ({ name: t.name, id: t.id, type: t.type, affinity: t.affinity, group }));
    }).map((p) => p.catch(soft<TasteTag[]>([], signal))),
  );
  return uniqueBy(
    groups.flatMap((g) => g.slice(0, 6)),
    (t) => t.name.toLowerCase(),
  );
}

function toSkew(raw: QlooSkew | null): { skew: AudienceProfile["skew"]; topAge: string | null } {
  if (!raw) return { skew: null, topAge: null };
  const ages = Object.entries(raw.age)
    .filter(([band, v]) => AGE_LABEL[band] && v > 0.1)
    .sort((a, b) => b[1] - a[1]);
  const female = raw.gender.female ?? 0;
  const male = raw.gender.male ?? 0;
  const gender = female - male > 0.15 ? "female" : male - female > 0.15 ? "male" : null;
  if (!ages.length && !gender) return { skew: null, topAge: null };
  return {
    skew: { age: ages.slice(0, 2).map(([band]) => AGE_LABEL[band]), gender },
    topAge: ages[0] && ages[0][1] > 0.15 ? ages[0][0] : null,
  };
}

/** The podcasts a category directory would return, with no taste signal at all. */
async function categoryDirectory(request: DiscoveryRequest, signal: AbortSignal): Promise<string[]> {
  const obvious = OBVIOUS_SEARCH[request.brand.category];
  for (const query of obvious.tags) {
    const found = await qloo.tags(query, 8, signal).catch(soft<QlooTag[]>([], signal));
    const pick = found.find((t) => t.name.toLowerCase() === query) ?? found.find((t) => t.name.toLowerCase().includes(query));
    if (!pick) continue;
    const locationParam = request.setup.location !== ONLINE_ONLY
      ? { "signal.location.query": request.setup.location }
      : {};
    const shows = await qloo
      .insights({ "filter.type": "urn:entity:podcast", "signal.interests.tags": pick.id, take: 3, ...locationParam }, signal)
      .catch(soft<QlooEntity[]>([], signal));
    if (shows.length) return shows.map((s) => s.name);
  }
  return [];
}

function failure(error: unknown) {
  if (error instanceof QlooError) {
    if (error.status === 401 || error.status === 403) return "Qloo didn't accept the API key. Check QLOO_API_KEY and restart the server.";
    if (error.status === 429) return "Qloo is limiting requests right now. Wait a moment and try again.";
    if (error.status === 504) return "Qloo didn't respond in time. Please try again.";
  }
  return "Qloo returned an error. Please try again.";
}

/**
 * Brand and interests go in; Qloo's taste graph decides who the audience is and
 * which artists, people, podcasts, places and brands they over-index on. Events
 * come from a separate feed, and campaign ideas are composed from all of it.
 */
export const qlooProvider: DiscoveryProvider = {
  source: QLOO_SOURCE,

  async *discover(request, signal): AsyncGenerator<DiscoveryEvent> {
    const { brand, setup } = request;
    const local = setup.location !== ONLINE_ONLY;
    const notes: string[] = [];
    yield { type: "source", source: QLOO_SOURCE };
    yield { type: "plan", signals: brand.signals, searchesEvents: local };

    try {
      yield { type: "step", step: "brand", status: "active" };
      const [entity, resolved] = await Promise.all([
        resolveBrand(brand.name, brand.domain, signal),
        Promise.all(brand.signals.map((s) => resolveTag(s, signal).catch(soft(null, signal)))),
      ]);
      const tags = resolved.filter((t): t is QlooTag => t !== null);
      const tagIds = tags.map((t) => t.id);
      if (!entity && !tagIds.length) {
        throw new Error("No brand or interest seed could be resolved in Qloo.");
      }
      const interestNote = `${tagIds.length} of ${brand.signals.length} audience interests matched Qloo tags.`;
      yield {
        type: "step",
        step: "brand",
        status: "done",
        detail: entity ? `Found ${entity.name} in Qloo. ${interestNote}` : `${brand.name} isn't in Qloo yet, so we're working from its audience interests. ${interestNote}`,
      };
      if (!entity) notes.push(`Qloo doesn't list ${brand.name} as a brand yet, so results are based on your audience interests.`);

      yield { type: "step", step: "taste", status: "active" };
      const seed: Params = { ...(entity ? { "signal.interests.entities": entity.id } : {}), ...(tagIds.length ? { "signal.interests.tags": tagIds.join(",") } : {}) };
      const [taste, rawSkew] = await Promise.all([
        tasteProfile(seed, setup.location, signal),
        qloo.demographics(seed, signal).catch(soft(null, signal)),
      ]);
      const { skew } = toSkew(rawSkew);
      const audience: AudienceProfile = {
        source: "qloo",
        entity: entity ? { id: entity.id, name: entity.name } : null,
        tags: taste.length ? taste : tags.map((t) => ({ name: t.name, id: t.id, type: t.type, affinity: t.affinity, group: "interests" as const })),
        skew,
      };
      yield { type: "audience", audience };
      yield { type: "step", step: "taste", status: "done" };

      yield { type: "step", step: "search", status: "active" };

      // Cultural territories from the signals, then curated opportunities matched to them.
      const context = normalizeBrandContext(request);
      const signals = collectSignals(context, {
        tags: tags.map((t) => t.name),
        tasteTags: taste.map((t) => t.name),
      });
      const territories = buildTerritories(context, signals);
      const recommended = recommendedTerritory(context, signals);

      const directory = await categoryDirectory(request, signal).catch(soft<string[]>([], signal));
      const culture = recommended ? recommended.signals.slice(0, 4) : taste.slice(0, 4).map((t) => t.name);
      const contrast: CategoryContrast = {
        lookedFor: OBVIOUS_SEARCH[brand.category].label,
        found: directory,
        culture,
        sample: false,
      };
      yield { type: "contrast", contrast };

      const pools: Partial<Record<OpportunityKind, DemoOpportunity[]>> = {
        artist: DEMO_ARTISTS,
        creator: DEMO_CREATORS,
        podcast: DEMO_PODCASTS,
        brand: DEMO_BRANDS,
        ...(local ? { venue: DEMO_VENUES } : {}),
      };
      const picks = matchOpportunities(territories, pools, context, qlooSignalNames(signals));
      const matches: Match[] = picks.map((pick) => {
        const territory = territories.find((t) => t.id === pick.territoryId)!;
        return toMatch(pick, territory, context, setup.goals);
      });
      // Real cultural candidates have no commercial quote. Do not infer fees from popularity.
      const liveGroups = await Promise.all([
        ["artist", "urn:entity:artist"], ["podcast", "urn:entity:podcast"], ["brand", "urn:entity:brand"],
      ].map(async ([kind, type]) => {
        const found = await qloo.insights({ ...seed, "filter.type": type, take: 3,
          ...(local ? { "signal.location.query": setup.location } : {}) }, signal).catch(soft<QlooEntity[]>([], signal));
        return found.map((e): Match => ({
          opportunity: { id: e.id, kind: kind as OpportunityKind, name: e.name,
            detail: "Qloo cultural candidate · sponsorship unverified", city: null,
            tags: e.tags.map(t => t.name), rate: { min: 0, max: 0, basis: "estimate" },
            costEvidence: { status: "unknown", source: "Qloo does not provide sponsorship fees" },
            formats: ["Proposed sponsorship; confirm format"], about: e.description ?? "Cultural candidate returned by Qloo.",
            image: e.image, popularity: e.popularity, affinity: e.affinity, source: "qloo",
            culturalEvidence: { source: "qloo", entityId: e.id, entityType: e.type ?? type, affinity: e.affinity, tags: e.tags } },
          shared: e.tags.map(t => t.name).filter(t => brand.signals.some(s => norm(s) === norm(t))),
          fit: "stretch", withinBudget: false,
          whyItFits: "Qloo returned this entity for the campaign's cultural seed. Availability, pricing and audience overlap have not been verified.",
        }));
      }));
      matches.push(...liveGroups.flat());
      notes.push("Qloo entities are real cultural records, with unknown fees and availability. Catalogue partners, audience sizes and costs are illustrative.");
      for (const match of matches) yield { type: "match", match };
      if (recommended) {
        notes.push(`We recommend building around "${recommended.name}": ${recommended.summary}`);
        notes.push(
          `Creator archetypes to test here: ${recommended.archetypes.join(", ")}. These are hypotheses matched to illustrative profiles — not verified, bookable creators.`,
        );
        if (recommended.uncertainties.length) {
          notes.push(`Uncertainties to test first: ${recommended.uncertainties.join(" ")}`);
        }
      } else {
        notes.push(
          "No cultural territory matched this brand's signals strongly. Matches below are based on category and interests alone.",
        );
      }
      if (!hasQlooSignal(signals)) {
        notes.push("Qloo signals weren't available for this run, so matches are based on your category and interests alone.");
      }
      if (matches.length === 0) {
        notes.push(
          "No catalogue opportunity matched this brief closely enough. Try broadening your interests or increasing the budget.",
        );
      }
      yield {
        type: "step",
        step: "search",
        status: "done",
        detail: `${matches.length} opportunities matched to ${territories.length} cultural territories.`,
      };

      if (local) {
        yield { type: "step", step: "events", status: "active" };
        const events = getEventsProvider();
        const queries = audience.tags.map((t) => t.name);
        const found = await events.find(request, queries, 3, signal);
        for (const match of found) yield { type: "match", match };
        matches.push(...found);
        const searched = queries.slice(0, 4).join(", ");
        if (events.isSample)
          notes.push(
            queries.length
              ? `Events are sample listings, searched for ${searched}. A live events feed can take the same taste tags.`
              : "Events are sample listings for now. A live events feed can replace them.",
          );
        yield {
          type: "step",
          step: "events",
          status: "done",
          detail: queries.length ? `Sample calendar, searched for ${searched}.` : `${found.length} sample events.`,
        };
      }

      yield { type: "step", step: "ideas", status: "active" };
      const ideas = buildIdeas(brand.name, setup, audience, matches);
      for (const idea of ideas) yield { type: "idea", idea };
      yield { type: "step", step: "ideas", status: "done" };

      yield {
        type: "complete",
        result: { source: QLOO_SOURCE, signals: brand.signals, audience, contrast, matches, ideas, notes, generatedAt: new Date().toISOString() },
      };
    } catch (error) {
      if (signal.aborted) throw error;
      console.error("[qloo]", error);
      const message = failure(error);
      for await (const event of demoProvider.discover(request, signal)) {
        if (event.type === "complete") event.result.notes.unshift(`${message} Showing an explicitly illustrative fallback run.`);
        yield event;
      }
    }
  },
};
