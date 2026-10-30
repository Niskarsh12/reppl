import { ONLINE_ONLY } from "../campaign/catalog";
import type { DiscoveryRequest, Match } from "../discovery/types";
import type { Evidence, SponsorshipOffer } from "./types";

export const PRICE_FRESH_DAYS = 30;
export const AVAILABILITY_FRESH_DAYS = 14;
export const AUDIENCE_FRESH_DAYS = 90;
const day = 86_400_000;
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function freshEvidence(e: Evidence, asOf: string, maxDays: number, validUntil = "") {
  if (!e.source.trim() || !validDate(e.checkedAt) || !validDate(asOf)) return false;
  const age = (Date.parse(asOf) - Date.parse(e.checkedAt)) / day;
  return age >= 0 && age <= maxDays && (!validUntil || (validDate(validUntil) && validUntil >= asOf));
}
export function assessOffer(offer: SponsorshipOffer, asOf: string, includeProvisional: boolean) {
  const warnings: string[] = [];
  const hard: string[] = [];
  if (offer.availability.status === "unavailable") hard.push("Partner marked this offer unavailable.");
  if (offer.endDate && offer.endDate < asOf) hard.push("The offer's delivery window has ended.");
  if (offer.price.validUntil && offer.price.validUntil < asOf) hard.push("The price has expired; request an updated quote.");
  if (offer.availability.validUntil && offer.availability.validUntil < asOf) hard.push("Availability confirmation has expired.");
  if (offer.price.amount === null) hard.push("Price is unknown; request a quote.");
  if (offer.availability.status !== "confirmed") warnings.push("Availability is pending partner confirmation.");
  if (!freshEvidence(offer.availability, asOf, AVAILABILITY_FRESH_DAYS, offer.availability.validUntil)) warnings.push("Availability evidence is missing, future-dated or older than 14 days.");
  if (offer.price.basis === "estimate") warnings.push("Price is a user estimate, not a partner quote or published rate.");
  if (!freshEvidence(offer.price, asOf, PRICE_FRESH_DAYS, offer.price.validUntil)) warnings.push("Price evidence is missing, future-dated or older than 30 days.");
  if (!offer.price.extrasConfirmed) warnings.push("Taxes, production, travel or other extra costs still need confirmation.");
  const commercialWarnings = [...warnings];
  if (offer.audience.size === null || offer.audience.basis === "unknown" || !freshEvidence(offer.audience, asOf, AUDIENCE_FRESH_DAYS)) warnings.push("Audience figures are missing, unsourced or older than 90 days; do not treat them as verified reach.");
  if (!offer.startDate || !offer.endDate) warnings.push("Delivery dates are incomplete; confirm timing before booking.");
  warnings.push("All evidence is user-recorded. Reppl has not independently verified it; audience overlap and future results remain unknown.");
  return { eligible: hard.length === 0 && (includeProvisional || commercialWarnings.length === 0), reason: hard[0] ?? (!includeProvisional ? commercialWarnings[0] : undefined), provisional: commercialWarnings.length > 0, warnings };
}
export function offerToMatch(offer: SponsorshipOffer, request: DiscoveryRequest, asOf: string, includeProvisional = false): Match {
  const assessment = assessOffer(offer, asOf, includeProvisional);
  const total = offer.price.amount === null ? 0 : offer.price.amount + offer.price.extras;
  const knownAudience = offer.audience.size !== null && offer.audience.basis !== "unknown" && freshEvidence(offer.audience, asOf, AUDIENCE_FRESH_DAYS);
  const shared = offer.interests.filter(t => request.brand.signals.some(s => s.toLowerCase() === t.toLowerCase()));
  return { opportunity: {
    id: offer.id, name: offer.partner, kind: offer.kind, detail: offer.title,
    city: offer.delivery === "in-person" ? offer.market : null,
    tags: offer.interests, formats: offer.deliverables, about: offer.deliverables.join("; "),
    rate: { min: total, max: total, basis: offer.price.basis === "estimate" ? "estimate" : "typical" },
    costEvidence: { status: offer.price.amount === null ? "unknown" : offer.price.basis === "quote" ? "quoted" : offer.price.basis === "published" ? "published" : "planning", source: offer.price.source || "No price source recorded" },
    source: "offer", eligibility: { available: assessment.eligible, reason: assessment.reason, ...(offer.goals.length ? { goals: offer.goals } : {}), ...(offer.market && (offer.delivery === "in-person" || request.setup.location !== ONLINE_ONLY) ? { markets: [offer.market] } : {}) },
    commercial: { offer, asOf, provisional: assessment.provisional, warnings: assessment.warnings },
    ...(knownAudience ? { audience: { size: offer.audience.size!, unit: offer.audience.unit } } : {}),
  }, shared, fit: shared.length >= 2 ? "strong" : shared.length ? "good" : "stretch", withinBudget: assessment.eligible && offer.price.amount !== null && total <= request.setup.budget,
    whyItFits: `Offer: ${offer.title}. Deliverables: ${offer.deliverables.join("; ")}. ${shared.length ? `Declared interests match ${shared.join(", ")}.` : "Cultural relevance has not yet been established."} ${assessment.provisional ? "Conditional planning scenario; commercial evidence needs follow-up." : "Price and availability have current user-recorded sources."}`,
  };
}
