import "server-only";
import { SCENE_LABELS } from "../campaign/catalog";
import { qloo } from "../qloo/client";
import { SCENE_QUERIES } from "../qloo/scenes";
import type { EventBrief, PartnershipResearch } from "./types";
import { ASSETS } from "./strategy";

export function parseEventBrief(input: unknown): EventBrief | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 100) return null;
  if (typeof b.location !== "string" || b.location.length > 90) return null;
  if (typeof b.description !== "string" || b.description.length > 3000) return null;
  if (typeof b.artists !== "string" || b.artists.length > 300) return null;
  if (typeof b.objective !== "string" || b.objective.length > 1000) return null;
  if (!Array.isArray(b.scenes) || b.scenes.length > 8 || !b.scenes.length || b.scenes.some(s => typeof s !== "string" || !SCENE_LABELS.includes(s))) return null;
  if (b.assets !== undefined && (!Array.isArray(b.assets) || b.assets.length > ASSETS.length || b.assets.some(a => typeof a !== "string" || !ASSETS.some(option => option.id === a)))) return null;
  return { name: b.name.trim(), location: b.location.trim(), description: b.description.trim(), scenes: [...new Set(b.scenes)] as string[], artists: b.artists.trim(), objective: b.objective.trim(), ...(Array.isArray(b.assets) ? { assets: [...new Set(b.assets)] as string[] } : {}) };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const EVENT_QUERIES: Record<string, string[]> = { ...SCENE_QUERIES, "Vinyl & DJ culture": ["electronic music", "dj", "record store"] };

function resolveInterest(tags: Awaited<ReturnType<typeof qloo.tags>>, query: string) {
  // Qloo search may return unrelated substring hits (e.g. vinyl sign shops),
  // and namesakes in different domains (e.g. Sneakers as a dish). Use exact
  // canonical labels and prefer cultural genres/keywords over place descriptors.
  const priority = (id: string) => id.includes(":genre:") ? 3 : id.includes(":keyword:") ? 2 : 1;
  return tags.filter(t => norm(t.name) === norm(query) && !t.id.includes(":specialty_dish:"))
    .sort((a, b) => priority(b.id) - priority(a.id))[0];
}

/** Event interests seed the existing Qloo client directly. No catalogue or demo fallback. */
export async function researchPartnerships(brief: EventBrief, signal: AbortSignal): Promise<PartnershipResearch> {
  const unresolved: string[] = [];
  const seeds: PartnershipResearch["seeds"] = [];
  const resolved = await Promise.all(brief.scenes.map(async scene => {
    for (const query of EVENT_QUERIES[scene] ?? [scene]) {
      const tags = await qloo.tags(query, 8, signal);
      const tag = resolveInterest(tags, query);
      if (tag) return { id: tag.id, name: tag.name, kind: "interest" as const };
    }
    return null;
  }));
  resolved.forEach((seed, index) => { if (seed) seeds.push(seed); else unresolved.push(brief.scenes[index]); });
  const artistNames = [...new Set(brief.artists.split(",").map(a => a.trim()).filter(Boolean))].slice(0, 5);
  const artists = await Promise.all(artistNames.map(async name => {
    const found = await qloo.search(name, "urn:entity:artist", 5, signal);
    // Ambiguous names need a human identity check; never take the first search result.
    const exact = found.filter(e => norm(e.name) === norm(name));
    return exact.length === 1 ? { id: exact[0].id, name: exact[0].name, kind: "artist" as const } : null;
  }));
  artists.forEach((seed, index) => { if (seed) seeds.push(seed); else unresolved.push(artistNames[index]); });
  const unique = seeds.filter((s, i) => seeds.findIndex(other => other.id === s.id) === i);
  if (!unique.length) throw new Error("No cultural interests could be resolved in Qloo. Try different interests or a reference artist.");
  const tags = unique.filter(s => s.kind === "interest").map(s => s.id);
  const entities = unique.filter(s => s.kind === "artist").map(s => s.id);
  const found = await qloo.insights({
    "filter.type": "urn:entity:brand", take: 20,
    ...(tags.length ? { "signal.interests.tags": tags.join(",") } : {}),
    ...(entities.length ? { "signal.interests.entities": entities.join(",") } : {}),
    ...(brief.location ? { "signal.location.query": brief.location } : {}),
  }, signal);
  return {
    generatedAt: new Date().toISOString(), seeds: unique, unresolved,
    candidates: found.filter((e, i) => found.findIndex(other => other.id === e.id) === i).map(e => ({ id: e.id, name: e.name, type: e.type, description: e.description, affinity: e.affinity, tags: e.tags.map(t => ({ id: t.id, name: t.name })) })),
    locationApplied: Boolean(brief.location),
    notes: ["Source: Qloo /v2/insights, filter.type=urn:entity:brand. Results are conditioned on the resolved cultural seeds shown here.", "Raw affinity is a provider signal, not a fit percentage, audience overlap or likelihood of sponsorship.", "Qloo responses may use the existing 30-minute private server cache. The retrieval timestamp identifies this research run, not when Qloo last updated an entity.", "Event descriptions and partnership objectives inform the proposal draft; they are not measured audience data. Qloo is queried using resolved interests, reference artists and optional location.", "Sponsorship availability, exclusivity, audience size, fees and ROI have not been verified."],
  };
}
