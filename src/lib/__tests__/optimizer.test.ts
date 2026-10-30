import { describe, it, expect, vi, afterEach } from "vitest";
import { optimizePortfolio, opportunityCost, feasibleSelection } from "../campaign/optimizer";
import { splitBudget, buildPlan } from "../campaign/plan";
import { parseSetup } from "../campaign/validate";
import { ONLINE_ONLY } from "../campaign/catalog";
import type { DiscoveryRequest, Match } from "../discovery/types";
import { INITIAL_STATE, journeyReducer } from "../../components/journey/state";

vi.mock("server-only", () => ({}));
const request: DiscoveryRequest = { brand: { name: "Test", domain: "test.com", category: "other", signals: ["coffee", "cycling"] }, setup: { url: "https://test.com", budget: 100, goals: ["awareness"], location: ONLINE_ONLY } };
const match = (id: string, cost: number, tags: string[], affinity = 0.8): Match => ({ opportunity: { id, name: id, kind: "creator", city: null, detail: "Test fixture", tags, rate: { min: cost, max: cost, basis: "estimate" }, source: "sample", formats: ["Post"], about: "Illustrative test", affinity }, shared: tags, fit: "good", withinBudget: true, whyItFits: "Test fixture" });
const profile = { ...request.brand, url: request.setup.url, summary: "Test", audience: "Test", tone: ["warm" as const], origin: "manual" as const, fromPage: { name: false, summary: false } };

describe("portfolio optimization", () => {
  const candidates = [match("a", 50, ["coffee"], 0.9), match("b", 50, ["coffee"], 0.85), match("c", 50, ["cycling"], 0.7)];
  it("chooses complementary combinations over individual rankings", () => {
    const p = optimizePortfolio(candidates, request);
    expect(p.recommended.ids).toEqual(["a", "c"]);
    expect(p.baseline.ids).toEqual(["a", "b"]);
    expect(p.recommended.score).toBeGreaterThan(p.baseline.score);
    expect(p.recommended.totalCost).toBe(100);
    expect(p.decisions).toHaveLength(3);
  });
  it("is invariant to candidate order", () => {
    expect(optimizePortfolio([...candidates].reverse(), request)).toEqual(optimizePortfolio(candidates, request));
  });
  it("changes when brand signals and objective change", () => {
    const changed = { ...request, brand: { ...request.brand, signals: ["coffee"] } };
    expect(optimizePortfolio(candidates, changed).recommended.ids).not.toEqual(optimizePortfolio(candidates, request).recommended.ids);
    const sameTags = [match("a", 100, ["coffee"]), { ...match("z", 100, ["coffee"]), opportunity: { ...match("z", 100, ["coffee"]).opportunity, kind: "brand" as const, formats: ["Sampling"] } }];
    expect(optimizePortfolio(sameTags, request).recommended.ids).toEqual(["a"]);
    expect(optimizePortfolio(sameTags, { ...request, setup: { ...request.setup, goals: ["sales"] } }).recommended.ids).toEqual(["z"]);
  });
  it("never overspends across budgets and respects upper estimates", () => {
    for (let budget = 0; budget < 220; budget++) {
      const p = optimizePortfolio(candidates, { ...request, setup: { ...request.setup, budget } });
      expect(p.recommended.totalCost).toBeLessThanOrEqual(budget);
      expect(p.baseline.totalCost).toBeLessThanOrEqual(budget);
      expect(p.recommended.remaining).toBeGreaterThanOrEqual(0);
    }
    const wide = match("wide", 10, ["coffee"]); wide.opportunity.rate.max = 200;
    expect(optimizePortfolio([wide], request).recommended.ids).toEqual([]);
    expect(splitBudget(100, [wide]).amounts).toEqual([0]);
  });
  it("excludes unknown, invalid, unavailable and geographically ineligible opportunities", () => {
    const unknown = match("unknown", 0, ["coffee"]);
    const unavailable = match("unavailable", 1, ["coffee"]); unavailable.opportunity.eligibility = { available: false };
    const physical = match("physical", 1, ["coffee"]); physical.opportunity.kind = "event"; physical.opportunity.city = "London";
    const restricted = match("restricted", 1, ["coffee"]); restricted.opportunity.eligibility = { goals: ["sales"] };
    const invalid = match("invalid", NaN, ["coffee"]);
    const p = optimizePortfolio([unknown, unavailable, physical, restricted, invalid], request);
    expect(p.recommended.ids).toEqual([]);
    expect(p.decisions.every(d => d.reason.length > 10)).toBe(true);
    expect(opportunityCost(invalid)).toBeNull();
    expect(optimizePortfolio([physical], { ...request, setup: { ...request.setup, location: "Paris" } }).recommended.ids).toEqual([]);
  });
  it("does not count repeated cultural tags as independent coverage", () => {
    const p = optimizePortfolio(candidates.slice(0, 2), request);
    expect(p.recommended.ids).toEqual(["a"]);
    expect(p.recommended.segments).toEqual(["coffee"]);
    expect(p.assumptions.join()).toContain("not measured audience overlap");
  });
  it("handles empty, duplicate and large candidate sets deterministically", () => {
    expect(optimizePortfolio([], request).recommended.totalCost).toBe(0);
    expect(optimizePortfolio([candidates[0], candidates[0]], request).decisions).toHaveLength(1);
    const many = Array.from({ length: 25 }, (_, i) => match(String(i), 1, [i % 2 ? "coffee" : "cycling"]));
    const p = optimizePortfolio(many, request);
    expect(p.recommended.totalCost).toBeLessThanOrEqual(100);
    expect(p.recommended.ids.length).toBeLessThanOrEqual(6);
    expect(p.recommended.score).toBeGreaterThanOrEqual(p.baseline.score);
  });
  it("guards manual and idea selections and removes underfunded plan lines", () => {
    const result = { source: { id: "demo", label: "Demo", isDemo: true }, signals: [], audience: { source: "sample" as const, entity: null, tags: [], skew: null }, matches: candidates, ideas: [], notes: [], generatedAt: "test" };
    let state = journeyReducer({ ...INITIAL_STATE, profile, setup: request.setup }, { type: "discovered", key: "test", result });
    expect(state.selected).toEqual(["a", "c"]);
    state = journeyReducer(state, { type: "toggle", id: "b" });
    expect(state.selected).toEqual(["a", "c"]);
    state = journeyReducer(state, { type: "useIdea", id: "bad", anchors: ["a", "b", "c"] });
    expect(state.idea).toBeNull();
    expect(state.selected).toEqual(["a", "c"]);
    const plan = buildPlan(profile, request.setup, [match("big", 200, ["coffee"])], "2026-10-29");
    expect(plan.lines).toEqual([]);
    expect(plan.reserve + plan.unallocated).toBe(100);
  });
  it("preserves feasible manual selections even when they are redundant", () => {
    expect(feasibleSelection(candidates.slice(0, 2), request.setup).map(m => m.opportunity.id)).toEqual(["a", "b"]);
  });
  it("reoptimizes after planning-cost edits and clears dependent drafts", () => {
    const real = match("real", 0, ["coffee"]); real.opportunity.source = "qloo";
    real.opportunity.costEvidence = { status: "unknown", source: "No quote" };
    const result = { source: { id: "qloo", label: "Qloo", isDemo: false }, signals: [], audience: { source: "qloo" as const, entity: null, tags: [], skew: null }, matches: [real], ideas: [], notes: [], generatedAt: "test" };
    let state = journeyReducer({ ...INITIAL_STATE, profile, setup: request.setup }, { type: "discovered", key: "test", result });
    expect(state.selected).toEqual([]);
    state = journeyReducer(state, { type: "planningCost", id: "real", amount: 90 });
    state = journeyReducer(state, { type: "optimize" });
    expect(state.selected).toEqual(["real"]);
    expect(state.discovery?.result.matches[0].opportunity.costEvidence?.status).toBe("planning");
    const p = optimizePortfolio(state.discovery!.result.matches, request);
    expect(p.recommended.totalCost).toBe(90);
    expect(p.baseline.totalCost).toBe(90);
    state = journeyReducer(state, { type: "submitSetup", setup: { ...request.setup, budget: 50 } });
    expect(state.discovery).toBeNull();
    expect(state.selected).toEqual([]);
  });
  it("rejects nonfinite budgets at the API boundary", () => {
    expect(parseSetup({ ...request.setup, budget: NaN })).toBeNull();
    expect(parseSetup({ ...request.setup, budget: Infinity })).toBeNull();
  });
});

describe("Qloo wire responses", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("parses nested results, preserves raw affinity and uses documented parameters", async () => {
    vi.stubEnv("QLOO_API_KEY", "fixture-key");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: { entities: [{ entity_id: "entity-1", name: "Real fixture", types: ["urn:entity:artist"], query: { affinity: 42 }, tags: [{ tag_id: "tag-1", name: "Coffee" }] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { qloo } = await import("../qloo/client");
    const found = await qloo.insights({ "filter.type": "urn:entity:artist", "signal.interests.tags": "tag-1", take: 3 }, new AbortController().signal);
    expect(found[0]).toMatchObject({ id: "entity-1", type: "urn:entity:artist", affinity: 42, tags: [{ id: "tag-1", name: "Coffee" }] });
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.pathname).toBe("/v2/insights");
    expect(url.searchParams.get("signal.interests.tags")).toBe("tag-1");
  });
  it("handles missing fields, malformed rows and 404s", async () => {
    vi.stubEnv("QLOO_API_KEY", "fixture-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ results: { tags: [{ tag_id: "t", name: "Music", query: { affinity: 0.4 } }, { name: "No id" }, null] } }))).mockResolvedValueOnce(new Response("", { status: 404 })));
    const { qloo } = await import("../qloo/client");
    expect(await qloo.tasteTags({ "signal.interests.tags": "missing-fields" }, new AbortController().signal)).toEqual([{ id: "t", name: "Music", affinity: 0.4, type: undefined }]);
    expect(await qloo.search("no-entity-fixture", "urn:entity:brand", 2, new AbortController().signal)).toEqual([]);
  });
  it("surfaces authorization failures without inventing results", async () => {
    vi.stubEnv("QLOO_API_KEY", "fixture-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })));
    const { qloo } = await import("../qloo/client");
    await expect(qloo.search("unauthorized-fixture", "urn:entity:brand", 2, new AbortController().signal)).rejects.toMatchObject({ status: 401 });
  });
});
