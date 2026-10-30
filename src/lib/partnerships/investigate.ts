import "server-only";
import { qloo } from "../qloo/client";
import type { BrandInvestigation, InvestigationBranch, PartnershipCandidate, PartnershipResearch } from "./types";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export async function investigateBrand(candidate: PartnershipCandidate, research: PartnershipResearch, signal: AbortSignal): Promise<BrandInvestigation> {
  async function branch(id: InvestigationBranch["id"], label: string, parents: string): Promise<InvestigationBranch> {
    const params = { "signal.interests.entities": candidate.id, "filter.type": "urn:tag", "filter.parents.types": parents, take: 12 };
    try {
      const records = await qloo.tasteTags(params, signal);
      return { id, label, status: records.length ? "retrieved" : "empty", endpoint: "/v2/insights", params, records: records.map(t => ({ id: t.id, name: t.name, affinity: t.affinity })), note: "Brand-seeded cultural descriptors from Qloo. These do not verify the brand's marketing objectives or sponsorship activity." };
    } catch (error) {
      if (signal.aborted) throw error;
      return { id, label, status: "failed", endpoint: "/v2/insights", params, records: [], note: "This Qloo branch could not be retrieved. No substitute records were generated." };
    }
  }
  const branches = await Promise.all([branch("music", "Music connections", "urn:entity:artist"), branch("lifestyle", "Lifestyle connections", "urn:entity:brand")]);
  const connections: BrandInvestigation["connections"] = [];
  for (const seed of research.seeds.filter(s => s.kind === "interest")) {
    const records = [...candidate.tags.map(t => ({ ...t, source: "Brand entity tags" })), ...branches.flatMap(b => b.records.map(r => ({ ...r, source: b.label })))];
    const match = records.find(r => r.id === seed.id) || records.find(r => norm(r.name) === norm(seed.name));
    if (match) connections.push({ input: seed.name, name: match.name, id: match.id, matchedBy: match.id === seed.id ? "id" : "label", source: match.source });
  }
  // Adapt the investigation to its evidence: weak tag connections or supplied
  // reference artists trigger a separate entity-level check. No averaged scores.
  const params = { "signal.interests.entities": candidate.id, "filter.type": "urn:entity:artist", take: 8 };
  let artists: InvestigationBranch;
  if (connections.length === 0 || research.seeds.some(s => s.kind === "artist")) {
    try {
      const found = await qloo.insights(params, signal);
      artists = { id: "artists", label: "Artist cross-check", status: found.length ? "retrieved" : "empty", endpoint: "/v2/insights", params, records: found.map(e => ({ id: e.id, name: e.name, affinity: e.affinity })), note: "Additional entity-level query because a direct tag bridge was missing or the brief included reference artists. Returned artists are cultural records, not a proposed event lineup." };
      for (const seed of research.seeds.filter(s => s.kind === "artist")) {
        const match = found.find(e => e.id === seed.id);
        if (match) connections.push({ input: seed.name, name: match.name, id: match.id, matchedBy: "id", source: "Artist cross-check" });
      }
    } catch (error) {
      if (signal.aborted) throw error;
      artists = { id: "artists", label: "Artist cross-check", status: "failed", endpoint: "/v2/insights", params, records: [], note: "The additional entity-level query failed. The missing evidence remains unknown." };
    }
  } else {
    artists = { id: "artists", label: "Artist cross-check", status: "skipped", endpoint: "/v2/insights", params, records: [], note: "Direct cultural descriptor connections were found. No additional artist query was needed, and no artist matches are claimed." };
  }
  const all = [...branches, artists];
  const hasData = all.some(b => b.status === "retrieved");
  const verdict = connections.length ? "connections-found" : hasData ? "needs-validation" : "limited-data";
  return {
    candidateId: candidate.id, generatedAt: new Date().toISOString(), branches: all, connections, verdict,
    summary: connections.length ? `${connections.length} direct cultural descriptor ${connections.length === 1 ? "connection was" : "connections were"} found between the resolved event inputs and brand-seeded records. A specific activation is worth exploring, subject to commercial validation.` : hasData ? "Qloo returned additional cultural context, but no direct connection to the resolved event inputs was found in this investigation. Use an exploratory approach rather than asserting a strong match." : "The candidate appeared in event discovery, but this investigation returned no additional usable evidence. Defer a confident pitch until the cultural and commercial case is stronger.",
    limitations: ["Cultural descriptors and entity connections are not measured event audience overlap.", "Absence from a returned list is unknown affinity, not proof of a poor match.", "The brand's current objectives, sponsorship appetite, available budget and decision-maker remain unverified.", ...(all.some(b => b.status === "failed") ? ["Some research branches failed; their missing data cannot support this proposal."] : [])],
  };
}
