import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DiscoveryEvent, DiscoveryRequest } from "../discovery/types";
const mock = vi.hoisted(() => ({ search: vi.fn(), tags: vi.fn(), tasteTags: vi.fn(), demographics: vi.fn(), insights: vi.fn() }));
vi.mock("../qloo/client", () => ({ qloo: mock, QlooError: class extends Error {} }));
vi.mock("../discovery/demo/provider", () => ({ demoProvider: { async *discover() {
  yield { type: "source", source: { id: "demo", label: "Illustrative", isDemo: true } };
  yield { type: "complete", result: { source: { id: "demo", label: "Illustrative", isDemo: true }, signals: [], audience: { source: "sample", entity: null, tags: [], skew: null }, matches: [], ideas: [], notes: [], generatedAt: "test" } };
} } }));
import { qlooProvider } from "../discovery/qloo/provider";
import { ONLINE_ONLY } from "../campaign/catalog";
const request: DiscoveryRequest = { brand: { name: "Test", domain: "test.com", category: "food-drink", signals: ["Specialty coffee"] }, setup: { url: "https://test.com", budget: 10000, goals: ["awareness"], location: ONLINE_ONLY } };
const collect = async (signal = new AbortController().signal) => {
  const events: DiscoveryEvent[] = [];
  for await (const event of qlooProvider.discover(request, signal)) events.push(event);
  return events;
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.search.mockResolvedValue([{ id: "brand-id", name: "Test", tags: [] }]);
  mock.tags.mockResolvedValue([{ id: "tag-coffee", name: "coffee" }]);
  mock.tasteTags.mockResolvedValue([{ id: "taste-coffee", name: "Specialty coffee", affinity: 0.3 }]);
  mock.demographics.mockResolvedValue(null);
  mock.insights.mockResolvedValue([]);
});
describe("Qloo provider integration", () => {
  it("retains live entity evidence alongside clearly illustrative opportunities", async () => {
    mock.insights.mockImplementation(async (params: Record<string, string>) => params["filter.type"] === "urn:entity:artist" ? [{ id: "real-artist", name: "Fixture Artist", type: "urn:entity:artist", affinity: 0.61, tags: [{ id: "tag-coffee", name: "Coffee" }] }] : []);
    const events = await collect();
    const complete = events.find(e => e.type === "complete");
    expect(complete?.type).toBe("complete");
    if (complete?.type !== "complete") return;
    const live = complete.result.matches.find(m => m.opportunity.id === "real-artist");
    expect(live?.opportunity).toMatchObject({ source: "qloo", costEvidence: { status: "unknown" }, culturalEvidence: { entityId: "real-artist", entityType: "urn:entity:artist", affinity: 0.61 } });
    expect(complete.result.matches.some(m => m.opportunity.source === "sample")).toBe(true);
    expect(complete.result.audience.tags[0]).toMatchObject({ id: "taste-coffee", affinity: 0.3 });
    expect(mock.tasteTags.mock.calls[0][0]).toMatchObject({ "signal.interests.entities": "brand-id", "signal.interests.tags": "tag-coffee", "filter.parents.types": "urn:entity:artist" });
  });
  it("uses an explicitly demo source and caveat when Qloo fails", async () => {
    mock.search.mockRejectedValue(new Error("API unavailable"));
    const events = await collect();
    const complete = events.find(e => e.type === "complete");
    if (complete?.type !== "complete") throw new Error("Missing fallback completion");
    expect(complete.result.source.isDemo).toBe(true);
    expect(complete.result.notes.join()).toContain("illustrative fallback");
  });
  it("continues with known seeds when optional signals are missing", async () => {
    mock.tasteTags.mockResolvedValue([]);
    mock.demographics.mockResolvedValue(null);
    const events = await collect();
    expect(events.some(e => e.type === "complete")).toBe(true);
    expect(events.some(e => e.type === "error")).toBe(false);
  });
  it("does not turn cancellation into a sample result", async () => {
    const controller = new AbortController(); controller.abort();
    mock.search.mockRejectedValue(new Error("cancelled"));
    await expect(collect(controller.signal)).rejects.toThrow("cancelled");
  });
});
