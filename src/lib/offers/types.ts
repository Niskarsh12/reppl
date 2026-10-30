import type { GoalId } from "../campaign/types";
import type { OpportunityKind } from "../discovery/types";

export interface Evidence {
  source: string;
  checkedAt: string;
}
export interface SponsorshipOffer {
  id: string;
  partner: string;
  title: string;
  kind: OpportunityKind;
  delivery: "online" | "in-person";
  market: string;
  deliverables: string[];
  interests: string[];
  goals: GoalId[];
  startDate: string;
  endDate: string;
  price: Evidence & { amount: number | null; currency: "USD"; basis: "quote" | "published" | "estimate"; validUntil: string; extras: number; extrasConfirmed: boolean };
  availability: Evidence & { status: "confirmed" | "pending" | "unavailable"; validUntil: string };
  audience: Evidence & { size: number | null; unit: string; description: string; basis: "media-kit" | "analytics" | "partner-reported" | "unknown" };
  outcomes?: Evidence & { actualSpend: number | null; impressions: number | null; clicks: number | null; conversions: number | null; notes: string };
}
