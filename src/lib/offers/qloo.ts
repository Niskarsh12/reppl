import "server-only";
import { isQlooConfigured, qloo } from "../qloo/client";
import type { DiscoveryRequest, Match, OpportunityKind } from "../discovery/types";
import { SCENE_QUERIES } from "../qloo/scenes";
const types: Partial<Record<OpportunityKind,string>> = { artist: "urn:entity:artist", creator: "urn:entity:person", podcast: "urn:entity:podcast", venue: "urn:entity:place", brand: "urn:entity:brand" };
const norm = (s: string) => s.trim().toLowerCase();
/** Only exact, unique names in actual Insights results are attached. No inferred entity IDs. */
export async function enrichOfferCulture(matches: Match[], request: DiscoveryRequest, signal: AbortSignal) {
  if (!isQlooConfigured()) return { matches, notes: ["Qloo is not configured. The comparison uses declared interests and commercial evidence; no cultural affinity was invented."] };
  try {
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
    const brands = await qloo.search(request.brand.name, "urn:entity:brand", 5, bounded);
    const brand = brands.filter(b => norm(b.name) === norm(request.brand.name));
    const tags = await Promise.all(request.brand.signals.slice(0,4).map(async s => {
      const query = SCENE_QUERIES[s]?.[0] ?? s;
      const found = await qloo.tags(query, 5, bounded);
      return found.find(t => norm(t.name) === norm(query));
    }));
    const seed = { ...(brand.length === 1 ? { "signal.interests.entities": brand[0].id } : {}), ...(tags.some(Boolean) ? { "signal.interests.tags": tags.filter(t => !!t).map(t => t!.id).join(",") } : {}) };
    if (!Object.keys(seed).length) return { matches, notes: ["No unambiguous Qloo seed resolved; cultural affinity remains unknown."] };
    const groups = await Promise.all([...new Set(matches.map(m => types[m.opportunity.kind]).filter((t): t is string => !!t))].map(async type => ({ type, entities: await qloo.insights({ ...seed, "filter.type": type, take: 20 }, bounded) })));
    let count = 0;
    const enriched = matches.map(m => {
      const group = groups.find(g => g.type === types[m.opportunity.kind]);
      const candidates = group?.entities.filter(e => norm(e.name) === norm(m.opportunity.name)) ?? [];
      if (candidates.length !== 1) return m;
      const e = candidates[0]; count++;
      return { ...m, opportunity: { ...m.opportunity, culturalEvidence: { source: "qloo" as const, identityConfirmed: false, entityId: e.id, entityType: e.type ?? group!.type, affinity: e.affinity, tags: e.tags } } };
    });
    return { matches: enriched, notes: [`Qloo cultural evidence attached to ${count} exact-name offers. A name match needs your identity confirmation before its tags or affinity can affect scoring; candidates absent from the returned top 20 have unknown affinity, not zero. Qloo does not verify the commercial offer.`] };
  } catch (error) {
    if (signal.aborted) throw error;
    return { matches, notes: ["Qloo enrichment was unavailable or timed out. Your real offers remain intact; evaluation uses their recorded evidence and declared interests."] };
  }
}
