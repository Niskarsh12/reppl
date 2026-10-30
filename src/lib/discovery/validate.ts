import { CATEGORIES, SCENE_LABELS } from "../campaign/catalog";
import type { BrandCategoryId } from "../campaign/types";
import { parseSetup } from "../campaign/validate";
import type { DiscoveryRequest } from "./types";

export const MAX_SIGNALS = 8;

export function parseDiscoveryRequest(input: unknown): DiscoveryRequest | null {
  if (!input || typeof input !== "object") return null;
  const { brand, setup } = input as { brand?: Record<string, unknown>; setup?: unknown };
  const parsedSetup = parseSetup(setup);
  if (!brand || !parsedSetup) return null;

  const name = typeof brand.name === "string" ? brand.name.trim().slice(0, 80) : "";
  const domain = typeof brand.domain === "string" ? brand.domain.trim().toLowerCase().slice(0, 253) : "";
  const category = CATEGORIES.some((c) => c.id === brand.category) ? (brand.category as BrandCategoryId) : null;
  const signals = Array.isArray(brand.signals)
    ? brand.signals.filter((s): s is string => typeof s === "string" && SCENE_LABELS.includes(s)).slice(0, MAX_SIGNALS)
    : [];
  if (!name || !category || signals.length === 0) return null;

  const audience = typeof brand.audience === "string" ? brand.audience.trim().slice(0, 2000) : undefined;
  const summary = typeof brand.summary === "string" ? brand.summary.trim().slice(0, 2000) : undefined;
  return { brand: { name, domain, category, signals, ...(audience ? { audience } : {}), ...(summary ? { summary } : {}) }, setup: parsedSetup };
}
