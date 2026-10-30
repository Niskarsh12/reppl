import { calendarDate } from "@/lib/offers/date";
import { refreshOfferMatches } from "@/lib/offers/evaluate";
import type { SponsorshipOffer } from "@/lib/offers/types";
import { parseOffer, parseOffers } from "@/lib/offers/validate";
import { optimizePortfolio, ineligibleReason, opportunityCost } from "@/lib/campaign/optimizer";
import type { BrandProfile, CampaignSetup, PitchDraft, ReadFailure, TrackedLink } from "@/lib/campaign/types";
import { EMPTY_SETUP, type SetupDraft } from "@/lib/campaign/validate";
import type { DiscoveryResult } from "@/lib/discovery/types";

export type Stage = "landing" | "setup" | "brand" | "offers" | "opportunities" | "plan" | "links" | "performance";

export const STAGES: Stage[] = ["landing", "setup", "brand", "offers", "opportunities", "plan", "links", "performance"];

export const STEPS: { stage: Exclude<Stage, "landing">; label: string }[] = [
  { stage: "setup", label: "Details" },
  { stage: "brand", label: "Brand" },
  { stage: "offers", label: "Offers" },
  { stage: "opportunities", label: "Compare" },
  { stage: "plan", label: "Pitches" },
  { stage: "links", label: "Links" },
  { stage: "performance", label: "Performance" },
];

export const MAX_SELECTED = 6;

export interface ReadingState {
  url: string;
  status: "idle" | "reading" | "done" | "error";
  profile: BrandProfile | null;
  error: { reason: ReadFailure; message: string } | null;
}

export interface JourneyState {
  stage: Stage;
  campaignId: string;
  startedAt: string;
  draft: SetupDraft;
  setup: CampaignSetup | null;
  reading: ReadingState;
  profile: BrandProfile | null;
  /** `key` records the inputs that produced the result, so stale results are re-run. */
  discovery: { key: string; result: DiscoveryResult } | null;
  offers: SponsorshipOffer[];
  offerMode: "offers" | "discovery";
  selected: string[];
  /** The campaign idea the user chose, if any. */
  idea: string | null;
  /** Only pitches the user has edited; the rest are drafted from the plan. */
  pitches: Record<string, PitchDraft>;
  links: TrackedLink[];
}

const IDLE_READING: ReadingState = { url: "", status: "idle", profile: null, error: null };

export const INITIAL_STATE: JourneyState = {
  stage: "landing",
  campaignId: "",
  startedAt: "",
  draft: EMPTY_SETUP,
  setup: null,
  reading: IDLE_READING,
  profile: null,
  discovery: null,
  offers: [],
  offerMode: "offers",
  selected: [],
  idea: null,
  pitches: {},
  links: [],
};

export type JourneyAction =
  | { type: "go"; stage: Stage }
  | { type: "hydrate"; state: JourneyState }
  | { type: "start"; url: string; campaignId: string; startedAt: string }
  | { type: "draft"; draft: SetupDraft }
  | { type: "read"; url: string }
  | { type: "readDone"; url: string; profile: BrandProfile }
  | { type: "readFailed"; url: string; error: NonNullable<ReadingState["error"]> }
  | { type: "submitSetup"; setup: CampaignSetup }
  | { type: "confirmBrand"; profile: BrandProfile }
  | { type: "discovered"; key: string; result: DiscoveryResult }
  | { type: "toggle"; id: string }
  | { type: "useIdea"; id: string; anchors: string[] }
  | { type: "dropIdea" }
  | { type: "optimize" }
  | { type: "saveOffer"; offer: SponsorshipOffer }
  | { type: "removeOffer"; id: string }
  | { type: "importOffers"; offers: SponsorshipOffer[] }
  | { type: "confirmOfferEntity"; id: string }
  | { type: "offerMode"; mode: "offers" | "discovery" }
  | { type: "planningCost"; id: string; amount: number }
  | { type: "editPitch"; id: string; pitch: PitchDraft }
  | { type: "resetPitch"; id: string }
  | { type: "linksCreated"; links: TrackedLink[] }
  | { type: "reset" };

export function discoveryKey(profile: BrandProfile, setup: CampaignSetup) {
  return JSON.stringify([profile.name, profile.domain, profile.category, profile.signals, profile.audience, profile.summary, setup.budget, setup.location, setup.goals]);
}

export function canEnter(stage: Stage, state: JourneyState) {
  switch (stage) {
    case "landing":
      return true;
    case "setup":
      return state.campaignId !== "";
    case "brand":
      return state.setup !== null;
    case "offers":
    case "opportunities":
      return state.setup !== null && state.profile !== null;
    case "plan":
    case "links":
      return state.discovery !== null && state.selected.length > 0;
    case "performance":
      return state.links.length > 0;
  }
}

function startReading(state: JourneyState, url: string): ReadingState {
  if (state.reading.url === url && state.reading.status !== "error") return state.reading;
  return { url, status: "reading", profile: null, error: null };
}

function currentMatches(state: JourneyState) {
  if (!state.discovery || !state.profile || !state.setup) return [];
  return refreshOfferMatches(state.discovery.result, { brand: state.profile, setup: state.setup }, calendarDate());
}

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case "go":
      return { ...state, stage: action.stage };
    case "hydrate":
      return { ...INITIAL_STATE, ...action.state, offers: parseOffers(action.state.offers) ?? [], offerMode: action.state.offerMode === "discovery" ? "discovery" : "offers" };
    case "start": {
      const sameBrand = state.reading.url === action.url;
      const base = sameBrand && state.campaignId ? state : { ...INITIAL_STATE, campaignId: action.campaignId, startedAt: action.startedAt };
      return {
        ...base,
        draft: { ...base.draft, url: action.url },
        reading: startReading(base, action.url),
        stage: "setup",
      };
    }
    case "draft":
      return { ...state, draft: action.draft };
    case "read": {
      const reading = startReading(state, action.url);
      if (reading === state.reading) return state;
      // A different page means a different brand: nothing built from the old one carries over.
      return { ...state, reading, profile: null, offers: [], discovery: null, selected: [], idea: null, pitches: {}, links: [] };
    }
    case "readDone":
      if (action.url !== state.reading.url) return state;
      return { ...state, reading: { ...state.reading, status: "done", profile: action.profile, error: null } };
    case "readFailed":
      if (action.url !== state.reading.url) return state;
      return { ...state, reading: { ...state.reading, status: "error", profile: null, error: action.error } };
    case "submitSetup":
      return { ...state, setup: action.setup, stage: "brand", discovery: null, selected: [], idea: null, pitches: {}, links: [] };
    case "confirmBrand":
      return { ...state, profile: action.profile, stage: "offers", discovery: null, selected: [], idea: null, pitches: {}, links: [] };
    case "discovered": {
      const recommended = state.profile && state.setup ? optimizePortfolio(action.result.matches, { brand: state.profile, setup: state.setup }).recommended.ids : [];
      return {
        ...state,
        discovery: { key: action.key, result: action.result },
        selected: recommended,
        pitches: {}, links: [],
        idea: action.result.ideas.some((i) => i.id === state.idea) ? state.idea : null,
      };
    }
    case "confirmOfferEntity": {
      if (!state.discovery || state.discovery.result.scope !== "offers") return state;
      const matches = state.discovery.result.matches.map(m => m.opportunity.id === action.id && m.opportunity.culturalEvidence ? { ...m, opportunity: { ...m.opportunity, culturalEvidence: { ...m.opportunity.culturalEvidence, identityConfirmed: true } } } : m);
      return { ...state, discovery: { ...state.discovery, result: { ...state.discovery.result, matches, portfolio: undefined } }, selected: [], idea: null, pitches: {}, links: [] };
    }
    case "offerMode":
      return { ...state, offerMode: action.mode, discovery: null, selected: [], idea: null, pitches: {}, links: [] };
    case "saveOffer": {
      const offer = parseOffer(action.offer);
      if (!offer || (!state.offers.some(o => o.id === offer.id) && state.offers.length >= 40)) return state;
      const old = state.offers.find(o => o.id === offer.id);
      const offers = [...state.offers.filter(o => o.id !== offer.id), offer];
      if (old && JSON.stringify({ ...parseOffer(old), outcomes: undefined }) === JSON.stringify({ ...offer, outcomes: undefined })) {
        const discovery = state.discovery ? { ...state.discovery, result: { ...state.discovery.result, matches: state.discovery.result.matches.map(m => m.opportunity.id === offer.id && m.opportunity.commercial ? { ...m, opportunity: { ...m.opportunity, commercial: { ...m.opportunity.commercial, offer } } } : m) } } : null;
        return { ...state, offers, discovery };
      }
      return { ...state, offers, discovery: null, selected: [], idea: null, pitches: {}, links: [] };
    }
    case "removeOffer":
      return { ...state, offers: state.offers.filter(o => o.id !== action.id), discovery: null, selected: [], idea: null, pitches: {}, links: [] };
    case "importOffers": {
      const imported = parseOffers(action.offers);
      if (!imported) return state;
      const offers = [...new Map([...state.offers, ...imported].map(o => [o.id, o])).values()];
      if (offers.length > 40) return state;
      return { ...state, offers, discovery: null, selected: [], idea: null, pitches: {}, links: [] };
    }
    case "planningCost": {
      if (!state.discovery || !Number.isSafeInteger(action.amount) || action.amount <= 0 || action.amount > 100_000_000) return state;
      const matches = state.discovery.result.matches.map(m => m.opportunity.id === action.id ? { ...m, opportunity: { ...m.opportunity,
        rate: { min: action.amount, max: action.amount, basis: "estimate" as const },
        costEvidence: { status: "planning" as const, source: "User-entered planning assumption; not a partner quote" } } } : m);
      return { ...state, discovery: { ...state.discovery, result: { ...state.discovery.result, matches, portfolio: undefined } }, selected: [], idea: null, pitches: {}, links: [] };
    }
    case "optimize":
      if (!state.profile || !state.setup || !state.discovery) return state;
      return { ...state, selected: optimizePortfolio(currentMatches(state), { brand: state.profile, setup: state.setup }).recommended.ids, idea: null, pitches: {}, links: [] };
    case "toggle": {
      if (state.selected.includes(action.id)) return { ...state, selected: state.selected.filter((id) => id !== action.id), idea: null, pitches: {}, links: [] };
      if (state.selected.length >= MAX_SELECTED) return state;
      const match = currentMatches(state).find(m => m.opportunity.id === action.id);
      const spent = currentMatches(state).filter(m => state.selected.includes(m.opportunity.id)).reduce((s, m) => s + (opportunityCost(m) ?? 0), 0) ?? 0;
      if (!match || !state.setup || ineligibleReason(match, state.setup) || opportunityCost(match)! > state.setup.budget - spent) return state;
      return { ...state, selected: [...state.selected, action.id], idea: null, pitches: {}, links: [] };
    }
    case "useIdea": {
      if (!state.profile || !state.setup || !state.discovery) return state;
      const candidates = currentMatches(state).filter(m => action.anchors.includes(m.opportunity.id));
      const selected = optimizePortfolio(candidates, { brand: state.profile, setup: state.setup }).recommended.ids;
      return { ...state, idea: selected.length === action.anchors.length ? action.id : null, selected, pitches: {}, links: [] };
    }
    case "dropIdea":
      return { ...state, idea: null };
    case "editPitch":
      return { ...state, pitches: { ...state.pitches, [action.id]: action.pitch } };
    case "resetPitch": {
      const pitches = { ...state.pitches };
      delete pitches[action.id];
      return { ...state, pitches };
    }
    case "linksCreated": {
      const byId = new Map(state.links.map((l) => [l.opportunityId, l]));
      for (const link of action.links) byId.set(link.opportunityId, link);
      return { ...state, links: [...byId.values()] };
    }
    case "reset":
      return { ...INITIAL_STATE };
  }
}
