import type { OpportunityKind } from "./types";

export const KINDS: OpportunityKind[] = ["artist", "creator", "podcast", "venue", "brand", "event"];

export const KIND_LABEL: Record<OpportunityKind, { one: string; many: string }> = {
  artist: { one: "Artist", many: "Artists" },
  creator: { one: "Creator", many: "Creators" },
  podcast: { one: "Podcast", many: "Podcasts" },
  venue: { one: "Venue", many: "Venues" },
  brand: { one: "Brand partner", many: "Brand partners" },
  event: { one: "Event", many: "Events" },
};

export function isKind(value: unknown): value is OpportunityKind {
  return typeof value === "string" && (KINDS as string[]).includes(value);
}

export function kindCount(kind: OpportunityKind, n: number) {
  const label = n === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many;
  return `${n} ${label.toLowerCase()}`;
}

/** Kinds where the brand shows up in a physical place. */
export function isInPerson(kind: OpportunityKind) {
  return kind === "event" || kind === "venue";
}
