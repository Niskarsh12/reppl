import { describe, it, expect, vi, afterEach } from "vitest";
import { offerFixture, offerRequest, asOf } from "./offers.fixture";
import { offerToMatch } from "../offers/evidence";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), search: vi.fn(), tags: vi.fn(), insights: vi.fn() }));
vi.mock("../qloo/client", () => ({ isQlooConfigured: mocks.configured, qloo: mocks }));
import { enrichOfferCulture } from "../offers/qloo";
afterEach(() => vi.resetAllMocks());
describe("cultural enrichment of commercial offers", () => {
  it("leaves actual offers usable when Qloo is not configured", async () => {
    mocks.configured.mockReturnValue(false);
    const matches = [offerToMatch(offerFixture(), offerRequest, asOf)];
    const result = await enrichOfferCulture(matches, offerRequest, new AbortController().signal);
    expect(result.matches).toEqual(matches); expect(result.notes.join()).toContain("not configured");
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("attaches raw evidence only to unique exact matches, pending identity confirmation", async () => {
    const offer = offerFixture();
    mocks.configured.mockReturnValue(true); mocks.search.mockResolvedValue([{ id: "brand", name: offerRequest.brand.name }]); mocks.tags.mockResolvedValue([{ id: "coffee", name: "coffee" }]);
    mocks.insights.mockResolvedValue([{ id: "entity", name: offer.partner, affinity: 0.6, tags: [{ id: "t", name: "Cycling" }] }, { id: "unrelated", name: "Unrelated name", affinity: 0.99, tags: [] }]);
    const result = await enrichOfferCulture([offerToMatch(offer, offerRequest, asOf)], offerRequest, new AbortController().signal);
    expect(result.matches[0].opportunity.culturalEvidence).toMatchObject({ entityId: "entity", affinity: 0.6, identityConfirmed: false });
    expect(result.matches[0].opportunity.tags).not.toContain("Cycling");
    expect(result.matches[0].opportunity.costEvidence?.status).toBe("quoted");
    expect(mocks.insights.mock.calls[0][0]).toMatchObject({ "filter.type": "urn:entity:person", take: 20, "signal.interests.entities": "brand" });
  });
  it("does not score an ambiguous name or substitute fictional candidates when a request fails", async () => {
    const offer = offerFixture();
    mocks.configured.mockReturnValue(true); mocks.search.mockResolvedValue([{ id: "brand", name: offerRequest.brand.name }]); mocks.tags.mockResolvedValue([]);
    mocks.insights.mockResolvedValue([{ id: "one", name: offer.partner }, { id: "two", name: offer.partner }]);
    const matches = [offerToMatch(offer, offerRequest, asOf)];
    expect((await enrichOfferCulture(matches, offerRequest, new AbortController().signal)).matches[0].opportunity.culturalEvidence).toBeUndefined();
    mocks.insights.mockRejectedValue(new Error("API down"));
    const failed = await enrichOfferCulture(matches, offerRequest, new AbortController().signal);
    expect(failed.matches).toEqual(matches); expect(failed.notes.join()).toContain("unavailable");
  });
});
