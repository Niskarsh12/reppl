import { describe, it, expect, vi, afterEach } from "vitest";
import { offerFixture, offerRequest, asOf } from "./offers.fixture";
vi.mock("../offers/qloo", () => ({ enrichOfferCulture: vi.fn(async (matches) => ({ matches, notes: ["Qloo fixture enrichment"] })) }));
import { POST } from "../../app/api/offers/evaluate/route";
import { enrichOfferCulture } from "../offers/qloo";
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
const submit = (body: unknown) => POST(new Request("http://localhost/api/offers/evaluate", { method: "POST", body: JSON.stringify(body) }));
describe("real-offer evaluation API", () => {
  it("evaluates supplied real offers without introducing illustrative inventory", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(`${asOf}T12:00:00Z`));
    const response = await submit({ ...offerRequest, offers: [offerFixture()], enrich: false });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { result } = await response.json();
    expect(result.scope).toBe("offers"); expect(result.source.isDemo).toBe(false);
    expect(result.matches).toHaveLength(1); expect(result.matches[0].opportunity.source).toBe("offer");
    expect(result.portfolio.recommended.totalCost).toBe(1700);
    expect(enrichOfferCulture).not.toHaveBeenCalled();
  });
  it("records an explicit conditional scenario and optional cultural enrichment", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(`${asOf}T12:00:00Z`));
    const offer = offerFixture(); offer.availability.status = "pending";
    const standard = await (await submit({ ...offerRequest, offers: [offer] })).json();
    expect(standard.result.portfolio.recommended.ids).toEqual([]);
    const scenario = await (await submit({ ...offerRequest, offers: [offer], includeProvisional: true, enrich: true })).json();
    expect(scenario.result.portfolio.recommended.ids).toEqual([offer.id]);
    expect(scenario.result.source.id).toBe("offers-conditional");
    expect(scenario.result.notes.join()).toContain("Qloo fixture enrichment");
    expect(enrichOfferCulture).toHaveBeenCalledOnce();
  });
  it("evaluates local checked dates using the client's time zone", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T20:00:00Z"));
    const response = await submit({ ...offerRequest, offers: [offerFixture()], timeZone: "Asia/Kolkata" });
    const { result } = await response.json();
    expect(result.portfolio.recommended.ids).toEqual([offerFixture().id]);
    expect(result.notes.join()).toContain("2026-10-30");
    expect((await submit({ ...offerRequest, offers: [offerFixture()], timeZone: "Invalid/Zone" })).status).toBe(400);
  });
  it("validates imports and flags rather than coercing request values", async () => {
    for (const body of [null, { ...offerRequest, offers: [] }, { ...offerRequest, offers: [offerFixture(), offerFixture()] }, { ...offerRequest, offers: [offerFixture()], includeProvisional: "true" }, { ...offerRequest, offers: [offerFixture()], enrich: "false" }]) {
      expect((await submit(body)).status).toBe(400);
    }
  });
});
