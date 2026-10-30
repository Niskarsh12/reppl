import type { DiscoveryRequest, DiscoveryResult, Match } from "../discovery/types";
import { optimizePortfolio } from "../campaign/optimizer";
import { offerToMatch } from "./evidence";
import type { SponsorshipOffer } from "./types";

export function evaluateOffers(offers: SponsorshipOffer[], request: DiscoveryRequest, asOf: string, includeProvisional = false, enriched?: Match[], notes: string[] = []): DiscoveryResult {
  const matches = enriched ?? offers.map(o => offerToMatch(o, request, asOf, includeProvisional));
  const audience = { source: "offer" as const, entity: null, tags: request.brand.signals.map(name => ({ name, group: "interests" as const })), skew: null };
  return { scope: "offers", source: { id: includeProvisional ? "offers-conditional" : "offers", label: includeProvisional ? "Conditional offer scenario" : "Your sourced offers", isDemo: false },
    signals: request.brand.signals, audience, matches, ideas: [],
    portfolio: optimizePortfolio(matches, request), generatedAt: new Date().toISOString(), notes: [
      `Evidence evaluated as of ${asOf}. ${includeProvisional ? "Conditional scenario: pending availability, estimates and stale evidence may be included." : "Standard shortlist requires sourced quote/published prices checked within 30 days, confirmed availability checked within 14 days, and confirmed extra costs."}`,
      "Reppl records your evidence; it does not independently verify partner claims. Audience evidence older than 90 days receives no data-quality credit. Audience sizes are never added up as independent reach.", ...notes,
    ] };
}

/** Recheck commercial freshness without reassigning old Qloo affinity to a different entity. */
export function refreshOfferMatches(result: DiscoveryResult, request: DiscoveryRequest, asOf: string): Match[] {
  if (result.scope !== "offers") return result.matches;
  return result.matches.map(m => {
    if (!m.opportunity.commercial) return m;
    const fresh = offerToMatch(m.opportunity.commercial.offer, request, asOf, result.source.id === "offers-conditional");
    return { ...fresh, opportunity: { ...fresh.opportunity, culturalEvidence: m.opportunity.culturalEvidence, tags: [...new Set([...fresh.opportunity.tags, ...(m.opportunity.culturalEvidence?.identityConfirmed ? m.opportunity.culturalEvidence.tags.map(t => t.name) : [])])] } };
  });
}
