import type { BrandInvestigation, EventBrief, PartnershipCandidate, PartnershipResearch } from "./types";

export const ASSETS = [
  { id: "listening-room", name: "Listening space", role: "Listening-room partner", concept: "The listening room", terms: /\b(music|vinyl|dj|audio|record|electronic|jazz|soul)\b/i, activity: "an artist-led listening programme and conversations between sets", ask: "Explore support for hosting, sound production or access to the listening programme", measure: "Session participation and optional post-experience feedback" },
  { id: "creative-workshop", name: "Makers workshop", role: "Creative-workshop partner", concept: "The creative exchange", terms: /\b(fashion|design|art|craft|streetwear|sneaker|creative|print)\b/i, activity: "a maker-led customization or print workshop where visitors create a take-home piece", ask: "Explore support for artist commissions, workshop materials or accessible participation", measure: "Workshop participation and consented feedback on the experience" },
  { id: "hospitality", name: "Hospitality area", role: "Hospitality partner", concept: "Common ground", terms: /\b(coffee|food|drink|dining|cafe|restaurant|hospitality|tea)\b/i, activity: "a hosted gathering with local makers and event artists, built around hospitality and conversation", ask: "Explore a useful hospitality contribution, with service arrangements and capabilities to be confirmed", measure: "Participation and optional feedback; sampling measures only if sampling is agreed" },
  { id: "content-studio", name: "Content / photo space", role: "Creative-content partner", concept: "A different point of view", terms: /\b(photo|camera|film|media|content|design|creative)\b/i, activity: "an artist-led portrait or documentation studio with an agreed consent and licensing process", ask: "Explore support for creative production and a jointly agreed content distribution plan", measure: "Consented participation and delivery of agreed, licensed creative assets" },
  { id: "community-space", name: "Community gathering", role: "Community-programme partner", concept: "In good company", terms: /\b(community|culture|social|wellness|outdoor|sport|running)\b/i, activity: "a practitioner-hosted community gathering connected to the event's cultural programme", ask: "Explore support for a community host, accessible attendance and programme delivery", measure: "Attendance and voluntary feedback on relevance and belonging" },
] as const;

export interface PartnershipDraft {
  roleId: string;
  concept: string;
  experience: string;
  ask: string;
  validation: string;
  measurement: string;
  subject: string;
  email: string;
}

export function availableAssets(brief: EventBrief) {
  return ASSETS.filter(asset => brief.assets?.includes(asset.id));
}

/** Transparent planning heuristic. Counts are never presented as Qloo fit scores. */
export function roleOptions(brief: EventBrief, candidate: PartnershipCandidate, investigation?: BrandInvestigation) {
  const descriptors = [...candidate.tags, ...(investigation?.branches.filter(b => b.id !== "artists" && b.status === "retrieved").flatMap(b => b.records) || [])];
  return availableAssets(brief).map(asset => {
    const support = descriptors.filter(t => asset.terms.test(t.name)).filter((t, i, all) => all.findIndex(v => v.name.trim().toLowerCase() === t.name.trim().toLowerCase()) === i);
    return { asset, support: support.slice(0, 4), supportCount: support.length };
  }).sort((a, b) => b.supportCount - a.supportCount);
}

export function createDraft(brief: EventBrief, candidate: PartnershipCandidate, investigation?: BrandInvestigation, roleId?: string): PartnershipDraft {
  const options = roleOptions(brief, candidate, investigation);
  const chosen = options.find(o => o.asset.id === roleId) || options[0];
  const asset = chosen?.asset;
  const concept = `${asset?.concept || "A shared cultural moment"} · ${candidate.name} × ${brief.name}`;
  const evidence = chosen?.support.map(t => t.name).join(", ");
  const basis = evidence ? `Cultural themes in our research—${evidence}—prompted an idea for ${candidate.name}.` : "Your brand surfaced in our cultural research, and we would like to explore a collaboration.";
  const activity = asset?.activity || "a participatory experience whose format and available event space still need to be defined";
  const ask = asset?.ask || "Agree an available event asset and a practical role for the brand before making an approach";
  return {
    roleId: asset?.id || "", concept,
    experience: `Develop ${activity} at ${brief.name}${brief.location ? ` in ${brief.location}` : ""} with ${candidate.name}. ${asset ? `${asset.name} is available at the event; the scope would be agreed together.` : "An available event experience still needs to be confirmed."}`,
    ask: `${ask}.`,
    validation: `Does this serve a current priority for ${candidate.name}? Confirm the decision-maker, timing, fees, rights and exclusivity before committing.`,
    measurement: `${asset?.measure || "Agree an experience and measurement method first"}. Set targets after agreeing the scope.`,
    subject: `${candidate.name} × ${brief.name}: explore ${asset?.name.toLowerCase() || "a cultural partnership"}`,
    email: `Hi ${candidate.name} partnerships team,\n\nI'm organizing ${brief.name}${brief.location ? ` in ${brief.location}` : ""}, bringing together ${brief.scenes.join(", ").toLowerCase()}.\n\n${basis}\n\nCould we develop ${activity} together? ${ask}.\n\nWould you be open to a short conversation?\n\nBest,\n[Your name / event team]`,
  };
}

export function exportApproach(brief: EventBrief, candidate: PartnershipCandidate, research: PartnershipResearch, investigation: BrandInvestigation, draft: PartnershipDraft, example: boolean) {
  const branches = investigation.branches.map(b => `### ${b.label}: ${b.status}\n${b.endpoint}\nParameters: ${JSON.stringify(b.params)}\n${b.note}\n${b.records.map(r => `- ${r.name} [${r.id}]${r.affinity === undefined ? "" : ` · raw affinity ${r.affinity}`}`).join("\n")}`).join("\n\n");
  return `# ${candidate.name} × ${brief.name}\n\nWorking partnership proposal${example ? " · illustrative event brief" : ""}\n\n## Event context — organizer supplied\n${brief.description}\nLocation: ${brief.location || "Not supplied"}\nInterests: ${brief.scenes.join(", ")}\nAmbition: ${brief.objective || "Not supplied"}\nAvailable experiences: ${availableAssets(brief).map(a => a.name).join(", ") || "None confirmed"}\n\n## Proposed role — creative hypothesis\n${draft.concept}\n\n${draft.experience}\n\n## Proposed contribution\n${draft.ask}\n\n## Evidence assessment\n${investigation.summary}\n${investigation.limitations.join("\n")}\n\n## Before making the approach\n${draft.validation}\n\n## Proposed measurement\n${draft.measurement}\n\n## Opening approach — editable, not sent\nSubject: ${draft.subject}\n\n${draft.email}\n\n## Commercial status\nFees, availability, audience overlap, rights, budget and ROI are unverified. No sponsorship commitment is implied.\n\n## Evidence appendix\nSource: Qloo /v2/insights · filter.type=urn:entity:brand\nDiscovery run: ${research.generatedAt}\nInvestigation run: ${investigation.generatedAt}\nEntity: ${candidate.name} [${candidate.id}]\nRaw affinity: ${candidate.affinity ?? "Not returned"} — not a fit percentage, probability or audience overlap.\nEntity tags: ${candidate.tags.map(t => `${t.name} [${t.id}]`).join("; ")}\nResolved event seeds: ${research.seeds.map(s => `${s.name} [${s.id}] (${s.kind})`).join("; ")}\nUnresolved event inputs: ${research.unresolved.join(", ") || "None"}\nLocation query: ${research.locationApplied ? brief.location : "None"}\n\n${branches}\n\n${research.notes.join("\n")}\n`;
}
