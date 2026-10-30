import {
  CATEGORY_AUDIENCE,
  CATEGORY_PATTERNS,
  CATEGORY_SCENES,
  SCENES,
  TONE_PATTERNS,
} from "./catalog";
import type { BrandCategoryId, BrandProfile, ToneId } from "./types";

export interface PageFacts {
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  headings?: string[];
  bodyText?: string;
}

const SEPARATORS = /\s+[|–—·•:]\s+|\s+-\s+/;

function hits(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function titleCase(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Picks the brand name from the page title, preferring the segment that matches the domain. */
export function nameFrom(facts: PageFacts): { name: string; fromPage: boolean } {
  const domain = domainOf(facts.url);
  const label = domain.split(".")[0] ?? domain;
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (facts.siteName && facts.siteName.length <= 40) return { name: facts.siteName.trim(), fromPage: true };

  const segments = (facts.title ?? "").split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
  const matching = segments.find((s) => squash(s) && (squash(label).includes(squash(s)) || squash(s).includes(squash(label))));
  if (matching && matching.length <= 40) return { name: matching, fromPage: true };
  if (segments.length > 1) {
    const shortest = [...segments].sort((a, b) => a.length - b.length)[0];
    if (shortest.length <= 30) return { name: shortest, fromPage: true };
  }
  return { name: label.split("-").map(titleCase).join(" "), fromPage: false };
}

function trimSentence(text: string, max = 240) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function inferCategory(text: string): BrandCategoryId {
  let best: BrandCategoryId = "other";
  let score = 0;
  for (const [id, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    const n = hits(text, pattern);
    if (n > score) {
      best = id as BrandCategoryId;
      score = n;
    }
  }
  return best;
}

export function inferTone(text: string): ToneId[] {
  const scored = (Object.entries(TONE_PATTERNS) as [ToneId, RegExp][])
    .map(([id, pattern]) => [id, hits(text, pattern)] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return scored.length ? scored.slice(0, 2).map(([id]) => id) : ["warm"];
}

export function inferSignals(text: string, category: BrandCategoryId): string[] {
  const found = SCENES.map((s) => [s.label, hits(text, s.pattern)] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label);
  for (const fallback of CATEGORY_SCENES[category]) {
    if (found.length >= 3) break;
    if (!found.includes(fallback)) found.push(fallback);
  }
  return found;
}

/** A first read of the brand. Everything except name and summary is a heuristic for the user to correct. */
export function inferProfile(facts: PageFacts, origin: BrandProfile["origin"]): BrandProfile {
  const { name, fromPage: nameFromPage } = nameFrom(facts);
  const description = facts.description?.trim() || facts.headings?.[0]?.trim() || "";
  const text = [facts.title, facts.description, ...(facts.headings ?? []), facts.bodyText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const category = inferCategory(text);

  return {
    url: facts.url,
    domain: domainOf(facts.url),
    name,
    summary: description ? trimSentence(description) : "",
    category,
    audience: CATEGORY_AUDIENCE[category],
    tone: inferTone(text),
    signals: inferSignals(text, category),
    origin,
    fromPage: { name: origin === "page" && nameFromPage, summary: origin === "page" && !!description },
  };
}
