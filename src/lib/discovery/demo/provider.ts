import { buildIdeas } from "@/lib/campaign/ideas";
import { CATEGORY_SCENES, ONLINE_ONLY } from "@/lib/campaign/catalog";
import { getEventsProvider } from "../events";
import { OBVIOUS_SEARCH } from "../obvious";
import { matchSample } from "../sample";
import type { AudienceProfile, CategoryContrast, DataSource, DiscoveryEvent, DiscoveryProvider, Match } from "../types";
import { DEMO_ARTISTS, DEMO_BRANDS, DEMO_CREATORS, DEMO_PODCASTS, DEMO_VENUES } from "./opportunities";

export const DEMO_SOURCE: DataSource = {
  id: "demo",
  label: "Illustrative partners",
  isDemo: true,
};

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const stop = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** Runs the same pipeline as the Qloo provider over the fictional catalogue. */
export const demoProvider: DiscoveryProvider = {
  source: DEMO_SOURCE,

  async *discover(request, signal): AsyncGenerator<DiscoveryEvent> {
    const { brand, setup } = request;
    const local = setup.location !== ONLINE_ONLY;
    yield { type: "source", source: DEMO_SOURCE };
    yield { type: "plan", signals: brand.signals, searchesEvents: local };

    yield { type: "step", step: "brand", status: "active" };
    await wait(500, signal);
    yield { type: "step", step: "brand", status: "done", detail: "Qloo isn't connected, so we start from your audience interests." };

    yield { type: "step", step: "taste", status: "active" };
    await wait(500, signal);
    const adjacent = CATEGORY_SCENES[brand.category].filter((s) => !brand.signals.includes(s));
    const audience: AudienceProfile = {
      source: "sample",
      entity: null,
      tags: [...brand.signals, ...adjacent].map((name) => ({ name, group: "interests" as const })),
      skew: null,
    };
    yield { type: "audience", audience };
    yield { type: "step", step: "taste", status: "done" };

    yield { type: "step", step: "search", status: "active" };
    const matches: Match[] = [
      ...matchSample(DEMO_ARTISTS, request, 3),
      ...matchSample(DEMO_CREATORS, request, 4),
      ...matchSample(DEMO_PODCASTS, request, 2),
      ...(local ? matchSample(DEMO_VENUES, request, 2) : []),
      ...matchSample(DEMO_BRANDS, request, 2),
    ];
    for (const match of matches) {
      await wait(220, signal);
      yield { type: "match", match };
    }
    yield { type: "step", step: "search", status: "done" };

    const obviousScenes = new Set(CATEGORY_SCENES[brand.category]);
    const chosen = new Set(brand.signals);
    const contrast: CategoryContrast = {
      lookedFor: OBVIOUS_SEARCH[brand.category].label,
      found: [...DEMO_PODCASTS, ...DEMO_CREATORS]
        .filter((o) => o.scenes.some((s) => obviousScenes.has(s) && !chosen.has(s)))
        .slice(0, 3)
        .map((o) => o.name),
      culture: audience.tags.slice(0, 4).map((t) => t.name),
      sample: true,
    };
    yield { type: "contrast", contrast };

    if (local) {
      yield { type: "step", step: "events", status: "active" };
      const culture = audience.tags.map((t) => t.name);
      const events = await getEventsProvider().find(request, culture, 3, signal);
      for (const match of events) {
        await wait(220, signal);
        yield { type: "match", match };
      }
      matches.push(...events);
      yield { type: "step", step: "events", status: "done", detail: `Sample calendar, searched for ${culture.slice(0, 4).join(", ")}.` };
    }

    yield { type: "step", step: "ideas", status: "active" };
    await wait(600, signal);
    const ideas = buildIdeas(brand.name, setup, audience, matches);
    for (const idea of ideas) yield { type: "idea", idea };
    yield { type: "step", step: "ideas", status: "done" };

    yield {
      type: "complete",
      result: {
        source: DEMO_SOURCE,
        signals: brand.signals,
        audience,
        contrast,
        matches,
        ideas,
        notes: [
          "Every partner and category-search name here is a fictional example. Connect Qloo to get real artists, podcasts, places and brands.",
          "Events are sample listings, searched with the audience interests. A live events feed can take the same tags.",
        ],
        generatedAt: new Date().toISOString(),
      },
    };
  },
};
