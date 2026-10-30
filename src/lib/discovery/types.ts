import type { BrandCategoryId, CampaignSetup, GoalId } from "../campaign/types";

/** Where results came from. Every surface that shows results must honour `isDemo`. */
export interface DataSource {
  id: string;
  label: string;
  isDemo: boolean;
}

export type OpportunityKind = "artist" | "creator" | "podcast" | "venue" | "brand" | "event";

/** `qloo` came from Qloo's taste graph; `sample` is illustrative catalogue data. */
export type Provenance = "qloo" | "sample" | "offer";

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  name: string;
  /** One line: genre, handle, neighbourhood or format. */
  detail: string;
  /** Null for partners who work online. */
  city: string | null;
  /** Audience size, when known. Qloo doesn't publish follower counts. */
  audience?: { size: number; unit: string };
  /** Descriptive tags: Qloo tag names or catalogue interests. */
  tags: string[];
  /** Fee range in whole US dollars. Estimates are illustrative or planning assumptions, never Qloo quotes. */
  rate: { min: number; max: number; basis: "typical" | "estimate" };
  formats: string[];
  about: string;
  image?: string;
  /** Qloo popularity percentile, 0–1. */
  popularity?: number;
  /** Raw Qloo cultural affinity. Not a probability or audience overlap. */
  affinity?: number;
  source: Provenance;
  /** Commercial facts are independent of Qloo's cultural signals. */
  costEvidence?: { status: "unknown" | "illustrative" | "quoted" | "planning" | "published"; source: string };
  eligibility?: { available?: boolean; reason?: string; markets?: string[]; goals?: GoalId[] };
  commercial?: { offer: import("../offers/types").SponsorshipOffer; asOf: string; provisional: boolean; warnings: string[] };
  culturalEvidence?: { source: "qloo"; identityConfirmed?: boolean; entityId: string; entityType?: string; affinity?: number; tags: { id: string; name: string }[] };
}

export type FitLevel = "strong" | "good" | "stretch";

export interface Match {
  opportunity: Opportunity;
  /** Audience interests or taste tags this opportunity shares. */
  shared: string[];
  fit: FitLevel;
  withinBudget: boolean;
  whyItFits: string;
  /**
   * Whether their own audience leans back toward this brand's culture.
   * Only set for partners we actually checked. Absent means unchecked.
   */
  conversation?: "mutual" | "one-way";
}

/** What a category directory would buy, set next to the taste-graph result. */
export interface CategoryContrast {
  /** Plain-language description of the obvious search, e.g. "fashion and sneaker podcasts". */
  lookedFor: string;
  /** Names that obvious search returned. */
  found: string[];
  /** Taste tags the graph connected to the brand instead. */
  culture: string[];
  /** True when `found` comes from the sample catalogue rather than Qloo. */
  sample: boolean;
}

export interface TasteTag {
  name: string;
  id?: string;
  type?: string;
  affinity?: number;
  /** Which part of life the tag describes. */
  group: "music" | "lifestyle" | "places" | "interests";
}

export interface AudienceProfile {
  source: Provenance;
  /** The brand as Qloo knows it, when it was found. */
  entity: { id: string; name: string } | null;
  tags: TasteTag[];
  /** Age bands and gender this audience over-indexes on, strongest first. Only from Qloo. */
  skew: { age: string[]; gender: "female" | "male" | null } | null;
}

export interface CampaignIdea {
  id: string;
  format: string;
  title: string;
  pitch: string;
  /** What to ask each anchor, by opportunity id, written to that partner. */
  asks: Record<string, string>;
  /** Why this idea, grounded in the recommendations behind it. */
  why: string;
  /** Opportunity ids the idea is built on. */
  anchors: string[];
  cost: { min: number; max: number };
  goals: GoalId[];
}

export interface DiscoveryRequest {
  brand: { name: string; domain: string; category: BrandCategoryId; signals: string[]; audience?: string; summary?: string };
  setup: CampaignSetup;
}

export interface DiscoveryResult {
  scope?: "offers" | "discovery";
  portfolio?: import("../campaign/optimizer").PortfolioResult;
  source: DataSource;
  signals: string[];
  audience: AudienceProfile;
  /** The obvious category buy, beside what the taste graph found. */
  contrast?: CategoryContrast;
  matches: Match[];
  ideas: CampaignIdea[];
  /** Plain-language caveats about how the search ran. */
  notes: string[];
  generatedAt: string;
}

export type DiscoveryStep = "brand" | "taste" | "search" | "events" | "ideas";

export type DiscoveryEvent =
  | { type: "source"; source: DataSource }
  | { type: "plan"; signals: string[]; searchesEvents: boolean }
  | { type: "step"; step: DiscoveryStep; status: "active" | "done"; detail?: string }
  | { type: "audience"; audience: AudienceProfile }
  | { type: "contrast"; contrast: CategoryContrast }
  | { type: "match"; match: Match }
  | { type: "conversation"; id: string; conversation: NonNullable<Match["conversation"]>; whyItFits: string }
  | { type: "idea"; idea: CampaignIdea }
  | { type: "complete"; result: DiscoveryResult }
  | { type: "error"; message: string };

/**
 * A discovery backend. Implementations stream progress so the UI can show
 * what the agent is doing instead of a spinner. Runs server-side only.
 */
export interface DiscoveryProvider {
  readonly source: DataSource;
  discover(request: DiscoveryRequest, signal: AbortSignal): AsyncIterable<DiscoveryEvent>;
}
