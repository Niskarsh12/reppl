import { describe, it, expect, vi } from "vitest";
vi.mock("../discovery/provider", () => ({ getDiscoveryProvider: () => ({ async *discover() {
  yield { type: "source", source: { id: "demo", label: "Illustrative", isDemo: true } };
  yield { type: "complete", result: { source: { id: "demo", label: "Illustrative", isDemo: true }, signals: ["Specialty coffee"], audience: { source: "sample", entity: null, tags: [], skew: null }, matches: [{ opportunity: { id: "fixture", name: "Fixture", kind: "creator", city: null, detail: "Fixture", tags: ["Specialty coffee"], rate: { min: 500, max: 900, basis: "estimate" }, formats: ["Post"], about: "Illustrative", source: "sample" }, shared: ["Specialty coffee"], fit: "good", withinBudget: true, whyItFits: "Test" }], ideas: [], notes: [], generatedAt: "test" } };
} }) }));
import { POST } from "../../app/api/discover/route";
const body = { brand: { name: "Test", domain: "test.com", category: "food-drink", signals: ["Specialty coffee"] }, setup: { url: "https://test.com", budget: 1000, goals: ["awareness"], location: "Online only" } };
describe("discovery API compatibility", () => {
  it("retains NDJSON events and existing fields, adding a feasible portfolio", async () => {
    const response = await POST(new Request("http://localhost/api/discover", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    expect(events.map(e => e.type)).toEqual(["source", "complete"]);
    const result = events[1].result;
    expect(result.matches).toHaveLength(1);
    expect(result.ideas).toEqual([]);
    expect(result.portfolio.recommended.ids).toEqual(["fixture"]);
    expect(result.portfolio.recommended.totalCost).toBe(900);
    expect(result.portfolio.recommended.remaining).toBe(100);
  });
  it("returns the existing 400 error contract for malformed requests", async () => {
    const response = await POST(new Request("http://localhost/api/discover", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
  });
});
