import { describe, it, expect, vi, afterEach } from "vitest";
import { parseOffer, parseOffers } from "../offers/validate";
import { assessOffer, offerToMatch, freshEvidence, validDate } from "../offers/evidence";
import { evaluateOffers, refreshOfferMatches } from "../offers/evaluate";
import { feasibleSelection, optimizePortfolio, opportunityCost } from "../campaign/optimizer";
import { calendarDate } from "../offers/date";
import { buildPlan, draftPitch } from "../campaign/plan";
import { INITIAL_STATE, canEnter, journeyReducer } from "../../components/journey/state";
import { offerFixture, offerRequest, offerProfile, asOf } from "./offers.fixture";

afterEach(() => vi.useRealTimers());
describe("commercial offer validation and evidence", () => {
  it("accepts actual recorded offers and preserves their evidence", () => {
    const offer = offerFixture();
    expect(parseOffer(offer)).toEqual(offer);
    expect(assessOffer(offer, asOf, false).eligible).toBe(true);
  });
  it("requires sources for quoted prices, confirmed availability and audience claims", () => {
    for (const key of ["price", "availability", "audience"] as const) {
      const o = offerFixture(); o[key].source = "";
      expect(parseOffer(o)).toBeNull();
    }
    const o = offerFixture(); o.audience.basis = "unknown";
    expect(parseOffer(o)).toBeNull();
  });
  it("does not manufacture missing prices or audience", () => {
    const o = offerFixture(); o.price.amount = null; o.audience = { size: null, unit: "", description: "", basis: "unknown", source: "", checkedAt: "" };
    expect(parseOffer(o)).not.toBeNull();
    const m = offerToMatch(o, offerRequest, asOf, true);
    expect(opportunityCost(m)).toBeNull(); expect(m.opportunity.audience).toBeUndefined();
    expect(evaluateOffers([o], offerRequest, asOf, true).portfolio!.recommended.ids).toEqual([]);
  });
  it("keeps estimates, stale confirmations and unconfirmed extras out of the standard shortlist", () => {
    for (const kind of ["estimate", "pending", "old-price", "old-availability", "extras"] as const) {
      const o = offerFixture();
      if (kind === "estimate") o.price.basis = "estimate";
      if (kind === "pending") o.availability.status = "pending";
      if (kind === "old-price") o.price.checkedAt = "2026-09-01";
      if (kind === "old-availability") o.availability.checkedAt = "2026-10-01";
      if (kind === "extras") o.price.extrasConfirmed = false;
      expect(assessOffer(o, asOf, false).eligible).toBe(false);
      expect(assessOffer(o, asOf, true).eligible).toBe(true);
      expect(evaluateOffers([o], offerRequest, asOf, true).source.id).toBe("offers-conditional");
    }
  });
  it("never includes unavailable, expired or ended offers even in a conditional scenario", () => {
    for (const kind of ["unavailable", "price", "availability", "ended"] as const) {
      const o = offerFixture();
      if (kind === "unavailable") o.availability.status = "unavailable";
      if (kind === "price") o.price.validUntil = "2026-10-29";
      if (kind === "availability") o.availability.validUntil = "2026-10-29";
      if (kind === "ended") o.endDate = "2026-10-29";
      expect(assessOffer(o, asOf, true).eligible).toBe(false);
    }
  });
  it("uses the user's calendar day around midnight", () => {
    const instant = new Date("2026-10-29T20:00:00Z");
    expect(calendarDate("Asia/Kolkata", instant)).toBe("2026-10-30");
    expect(calendarDate("UTC", instant)).toBe("2026-10-29");
  });
  it("uses the actual package scope and dates in activation plans and pitches", () => {
    const o = offerFixture(); o.kind = "podcast"; o.deliverables = ["One 60-second ad", "One newsletter mention"];
    const m = offerToMatch(o, offerRequest, asOf);
    const plan = buildPlan(offerProfile, offerRequest.setup, [m], asOf);
    const pitch = draftPitch(offerProfile, offerRequest.setup, m, 1700);
    expect(plan.lines[0].format).toContain("One newsletter mention");
    expect(plan.timeline.map(t => t.what).join()).toContain("2026-11-15");
    expect(pitch.body).toContain("One 60-second ad; One newsletter mention");
    expect(pitch.body).not.toContain("Three episodes");
  });
  it("handles freshness boundaries and rejects invalid dates", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-02-28")).toBe(true);
    expect(freshEvidence({ source: "Email", checkedAt: "2026-10-16" }, asOf, 14)).toBe(true);
    expect(freshEvidence({ source: "Email", checkedAt: "2026-10-15" }, asOf, 14)).toBe(false);
    expect(freshEvidence({ source: "Email", checkedAt: "2026-10-31" }, asOf, 14)).toBe(false);
  });
  it("retains stale audience claims as evidence without audience-quality credit", () => {
    const o = offerFixture(); o.audience.checkedAt = "2026-01-01";
    const m = offerToMatch(o, offerRequest, asOf);
    expect(m.opportunity.audience).toBeUndefined();
    expect(m.opportunity.commercial!.offer.audience.size).toBe(3000);
    expect(m.opportunity.commercial!.warnings.join()).toContain("90 days");
  });
  it("adds all declared extras and supports explicit zero-cost quotes", () => {
    const o = offerFixture();
    expect(evaluateOffers([o], offerRequest, asOf).portfolio!.recommended.totalCost).toBe(1700);
    o.price.amount = 0; o.price.extras = 0;
    const m = offerToMatch(o, offerRequest, asOf);
    expect(opportunityCost(m)).toBe(0);
    expect(feasibleSelection([m], offerRequest.setup)).toHaveLength(1);
    expect(buildPlan(offerProfile, offerRequest.setup, [m], `${asOf}T00:00:00Z`).lines[0].amount).toBe(0);
  });
  it("excludes wrong markets but supports online events and artists", () => {
    const o = offerFixture(); o.kind = "event";
    expect(evaluateOffers([o], offerRequest, asOf).portfolio!.recommended.ids).toEqual([o.id]);
    o.delivery = "in-person"; o.market = "London";
    expect(evaluateOffers([o], offerRequest, asOf).portfolio!.recommended.ids).toEqual([]);
    expect(evaluateOffers([o], { ...offerRequest, setup: { ...offerRequest.setup, location: "Paris" } }, asOf).portfolio!.recommended.ids).toEqual([]);
    expect(evaluateOffers([o], { ...offerRequest, setup: { ...offerRequest.setup, location: "London" } }, asOf).portfolio!.recommended.ids).toEqual([o.id]);
  });
  it("rejects malformed imports, duplicate IDs, unsupported currency and invalid numbers", () => {
    expect(parseOffers([offerFixture(), offerFixture()])).toBeNull();
    expect(parseOffers(Array.from({ length: 41 }, (_,i) => offerFixture(String(i))))).toBeNull();
    for (const amount of [-1, NaN, Infinity, 1.5]) expect(parseOffer({ ...offerFixture(), price: { ...offerFixture().price, amount } })).toBeNull();
    expect(parseOffer({ ...offerFixture(), price: { ...offerFixture().price, currency: "INR" } })).toBeNull();
  });
});
describe("real-offer decisions and campaign state", () => {
  it("selects complementary real offers and uses identical costs for the baseline", () => {
    const a = offerFixture("a"), b = offerFixture("b"), c = offerFixture("c"); c.interests = ["Cycling"];
    const result = evaluateOffers([a,b,c], offerRequest, asOf);
    expect(result.matches.every(m => m.opportunity.source === "offer")).toBe(true);
    expect(result.portfolio!.recommended.ids).toEqual(["a", "c"]);
    expect(result.portfolio!.recommended.totalCost).toBe(3400);
    expect(result.portfolio!.baseline.totalCost).toBeLessThanOrEqual(4000);
    expect(result.portfolio!.decisions[0].evidence!.join()).toContain("Test quote email");
  });
  it("rechecks stale saved evidence before generating pitches", () => {
    const result = evaluateOffers([offerFixture()], offerRequest, asOf);
    const matches = refreshOfferMatches(result, offerRequest, "2026-12-01");
    expect(feasibleSelection(matches, offerRequest.setup)).toEqual([]);
    expect(optimizePortfolio(matches, offerRequest).recommended.ids).toEqual([]);
  });
  it("ignores name-matched Qloo affinity until identity is confirmed", () => {
    const result = evaluateOffers([offerFixture()], offerRequest, asOf);
    const m = result.matches[0];
    m.opportunity.culturalEvidence = { source: "qloo", entityId: "real-id", affinity: 0.99, tags: [{ id: "cycling", name: "Cycling" }], identityConfirmed: false };
    const before = optimizePortfolio(refreshOfferMatches(result, offerRequest, asOf), offerRequest);
    const plain = evaluateOffers([offerFixture()], offerRequest, asOf).portfolio!;
    expect(before.recommended.score).toBe(plain.recommended.score);
    m.opportunity.culturalEvidence.identityConfirmed = true;
    const after = optimizePortfolio(refreshOfferMatches(result, offerRequest, asOf), offerRequest);
    expect(after.recommended.score).toBeGreaterThan(before.recommended.score);
  });
  it("persists offers through context edits and invalidates derived results", () => {
    const offer = offerFixture();
    let state = journeyReducer({ ...INITIAL_STATE, profile: offerProfile, setup: offerRequest.setup }, { type: "saveOffer", offer });
    state = journeyReducer(state, { type: "discovered", key: "real", result: evaluateOffers(state.offers, offerRequest, asOf) });
    state = journeyReducer(state, { type: "confirmBrand", profile: { ...offerProfile, signals: ["Cycling"] } });
    expect(state.stage).toBe("offers"); expect(state.offers).toEqual([offer]); expect(state.discovery).toBeNull(); expect(state.selected).toEqual([]);
    expect(canEnter("offers", state)).toBe(true);
  });
  it("does not let a late price edit reuse an earlier funded portfolio", () => {
    const offer = offerFixture();
    let state = journeyReducer({ ...INITIAL_STATE, profile: offerProfile, setup: offerRequest.setup }, { type: "saveOffer", offer });
    state = journeyReducer(state, { type: "discovered", key: "real", result: evaluateOffers([offer], offerRequest, asOf) });
    state = journeyReducer(state, { type: "saveOffer", offer: { ...offer, price: { ...offer.price, amount: 10000 } } });
    expect(state.discovery).toBeNull(); expect(state.selected).toEqual([]); expect(state.links).toEqual([]);
  });
  it("keeps observed zero outcomes distinct from missing values without changing recommendations", () => {
    const offer = offerFixture();
    const result = evaluateOffers([offer], offerRequest, asOf);
    offer.outcomes = { actualSpend: 0, impressions: null, clicks: 0, conversions: 0, notes: "No conversions reported", source: "Observed report", checkedAt: asOf };
    expect(parseOffer(offer)?.outcomes?.clicks).toBe(0);
    expect(evaluateOffers([offer], offerRequest, asOf).portfolio!.recommended).toEqual(result.portfolio!.recommended);
    let state = { ...INITIAL_STATE, offers: [offerFixture()], profile: offerProfile, setup: offerRequest.setup, discovery: { key: "real", result }, selected: [offer.id] };
    state = journeyReducer(state, { type: "saveOffer", offer }) as typeof state;
    expect(state.discovery).not.toBeNull(); expect(state.selected).toEqual([offer.id]);
  });
  it("hydrates older campaigns safely and validates imported offers", () => {
    const old = { ...INITIAL_STATE, offers: undefined };
    const state = journeyReducer(INITIAL_STATE, { type: "hydrate", state: old as never });
    expect(state.offers).toEqual([]);
    expect(journeyReducer(state, { type: "importOffers", offers: [offerFixture()] }).offers).toHaveLength(1);
    expect(journeyReducer(state, { type: "importOffers", offers: [{ id: "bad" } as never] }).offers).toEqual([]);
  });
});
