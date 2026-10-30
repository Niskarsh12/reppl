import { GOALS, MAX_BUDGET, MAX_GOALS, MIN_BUDGET, ONLINE_ONLY, money } from "./catalog";
import type { CampaignSetup, GoalId } from "./types";

/** Accepts `brand.com`, `www.brand.com/shop` or a full URL. Returns null when it can't be a public web address. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url.hostname)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function urlError(input: string) {
  if (!input.trim()) return "Paste the page where people buy your product.";
  return normalizeUrl(input) ? undefined : "That doesn't look like a web address. Try something like yourbrand.com.";
}

export interface SetupDraft {
  url: string;
  budget: string;
  goals: GoalId[];
  location: string;
}

export const EMPTY_SETUP: SetupDraft = { url: "", budget: "", goals: [], location: "" };

export type SetupField = keyof SetupDraft;
export type SetupErrors = Partial<Record<SetupField, string>>;
export const SETUP_FIELDS: SetupField[] = ["url", "budget", "goals", "location"];

export function parseBudget(input: string) {
  const n = Number(input.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function validateSetup(draft: SetupDraft): SetupErrors {
  const errors: SetupErrors = {};
  const url = urlError(draft.url);
  if (url) errors.url = url;

  const budget = parseBudget(draft.budget);
  if (!draft.budget.trim()) errors.budget = "Add a total budget so we can suggest a realistic mix.";
  else if (!Number.isFinite(budget) || budget < MIN_BUDGET)
    errors.budget = `Most creator and event deals start around ${money(MIN_BUDGET)}. Enter at least that.`;
  else if (budget > MAX_BUDGET) errors.budget = `Enter ${money(MAX_BUDGET)} or less.`;

  if (draft.goals.length === 0) errors.goals = "Pick at least one goal.";
  if (!draft.location.trim()) errors.location = `Add a city or region, or choose ${ONLINE_ONLY.toLowerCase()}.`;
  return errors;
}

export function setupFromDraft(draft: SetupDraft): CampaignSetup {
  return {
    url: normalizeUrl(draft.url)!,
    budget: parseBudget(draft.budget),
    goals: draft.goals.slice(0, MAX_GOALS),
    location: draft.location.trim().replace(/\s+/g, " "),
  };
}

/** Server-side guard for request bodies that carry a campaign setup. */
export function parseSetup(input: unknown): CampaignSetup | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Record<string, unknown>;
  const goals = Array.isArray(s.goals) ? s.goals.filter((g): g is GoalId => GOALS.some((x) => x.id === g)) : [];
  if (typeof s.url !== "string" || !normalizeUrl(s.url)) return null;
  if (typeof s.budget !== "number" || !Number.isSafeInteger(s.budget) || s.budget < MIN_BUDGET || s.budget > MAX_BUDGET) return null;
  if (typeof s.location !== "string" || !s.location.trim() || s.location.length > 90) return null;
  if (goals.length === 0) return null;
  return { url: normalizeUrl(s.url)!, budget: Math.round(s.budget), goals: goals.slice(0, MAX_GOALS), location: s.location.trim() };
}
