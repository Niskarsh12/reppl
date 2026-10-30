import type { SponsorshipOffer } from "../offers/types";
import type { DiscoveryRequest } from "../discovery/types";
import type { BrandProfile } from "../campaign/types";
export const asOf = "2026-10-30";
export const offerFixture = (id = "offer-a"): SponsorshipOffer => ({
  id, partner: `Fixture ${id}`, title: "Test sponsorship package", kind: "creator", delivery: "online", market: "", deliverables: ["Two sponsored posts with a tracked offer"], interests: ["Specialty coffee"], goals: ["sales"], startDate: "2026-11-01", endDate: "2026-11-15",
  price: { amount: 1500, currency: "USD", basis: "quote", source: "Test quote email", checkedAt: asOf, validUntil: "2026-11-05", extras: 200, extrasConfirmed: true },
  availability: { status: "confirmed", source: "Test confirmation email", checkedAt: asOf, validUntil: "2026-11-05" },
  audience: { size: 3000, unit: "followers", description: "Test audience claim", basis: "media-kit", source: "Test media kit", checkedAt: asOf },
});
export const offerRequest: DiscoveryRequest = { brand: { name: "Test Coffee", domain: "example.com", category: "food-drink", signals: ["Specialty coffee", "Cycling"] }, setup: { url: "https://example.com", budget: 4000, goals: ["sales"], location: "Online only" } };
export const offerProfile: BrandProfile = { ...offerRequest.brand, url: offerRequest.setup.url, audience: "Coffee and cycling enthusiasts", summary: "Test coffee", tone: ["warm"], origin: "manual", fromPage: { name: false, summary: false } };
