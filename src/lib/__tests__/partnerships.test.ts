import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ tags: vi.fn(), search: vi.fn(), insights: vi.fn(), configured: vi.fn() }));
vi.mock("../qloo/client", () => ({ qloo: mock, isQlooConfigured: mock.configured, QlooError: class extends Error {} }));
import { EXAMPLE_BRIEF } from "../partnerships/types";
import { parseEventBrief, researchPartnerships } from "../partnerships/research";
import { POST } from "@/app/api/partnerships/route";

beforeEach(() => {
  vi.clearAllMocks(); mock.configured.mockReturnValue(true);
  mock.tags.mockImplementation(async (query: string) => [{ id: `tag:${query}`, name: query }]);
  mock.search.mockResolvedValue([]); mock.insights.mockResolvedValue([]);
});

describe("Event partnership research", () => {
  it("rejects malformed inputs and limits cultural seeds", () => {
    expect(parseEventBrief({ ...EXAMPLE_BRIEF, name: " " })).toBeNull();
    expect(parseEventBrief({ ...EXAMPLE_BRIEF, scenes: ["made up"] })).toBeNull();
    expect(parseEventBrief({ ...EXAMPLE_BRIEF, scenes: Array(9).fill("Streetwear") })).toBeNull();
    expect(parseEventBrief({ ...EXAMPLE_BRIEF, scenes: ["Streetwear", "Streetwear"] })?.scenes).toEqual(["Streetwear"]);
  });
  it("uses resolved seed IDs, preserves raw evidence, and never invents commercial data", async () => {
    mock.insights.mockResolvedValue([{ id: "qloo-brand", name: "Retrieved brand", type: "urn:entity:brand", affinity: 0, tags: [{ id: "culture-tag", name: "Music" }] }]);
    const result = await researchPartnerships(EXAMPLE_BRIEF, new AbortController().signal);
    expect(mock.insights).toHaveBeenCalledWith(expect.objectContaining({ "filter.type": "urn:entity:brand", "signal.location.query": "London", "signal.interests.tags": expect.stringContaining("tag:") }), expect.any(AbortSignal));
    expect(result.candidates).toEqual([{ id: "qloo-brand", name: "Retrieved brand", type: "urn:entity:brand", description: undefined, affinity: 0, tags: [{ id: "culture-tag", name: "Music" }] }]);
    expect(result.seeds).toHaveLength(4);
    expect(result.candidates[0]).not.toHaveProperty("price");
    expect(result.candidates[0]).not.toHaveProperty("audience");
  });
  it("leaves missing affinity absent and never substitutes sample brands for empty results", async () => {
    const result = await researchPartnerships(EXAMPLE_BRIEF, new AbortController().signal);
    expect(result.candidates).toEqual([]);
    mock.insights.mockResolvedValue([{ id: "entity", name: "Brand", tags: [] }]);
    expect((await researchPartnerships(EXAMPLE_BRIEF, new AbortController().signal)).candidates[0].affinity).toBeUndefined();
  });
  it("rejects unrelated substring matches and prefers cultural tags over dish namesakes", async () => {
    mock.tags.mockImplementation(async (query: string) => query === "streetwear"
      ? [{ id: "urn:tag:decor:qloo:streetwear_store_integration", name: "Streetwear Store Integration" }]
      : query === "sneakers" ? [{ id: "urn:tag:specialty_dish:place:sneakers", name: "Sneakers" }, { id: "urn:tag:genre:brand:fashion:sneakers", name: "Sneakers" }]
        : [{ id: "urn:tag:category:place:vinyl_sign_shop", name: "Vinyl sign shop" }]);
    const result = await researchPartnerships({ ...EXAMPLE_BRIEF, scenes: ["Vinyl & DJ culture", "Streetwear"] }, new AbortController().signal);
    expect(result.seeds).toEqual([{ id: "urn:tag:genre:brand:fashion:sneakers", name: "Sneakers", kind: "interest" }]);
    expect(result.unresolved).toEqual(["Vinyl & DJ culture"]);
    expect(mock.insights.mock.calls[0][0]["signal.interests.tags"]).not.toContain("vinyl_sign_shop");
    expect(mock.insights.mock.calls[0][0]["signal.interests.tags"]).not.toContain("specialty_dish");
  });
  it("excludes ambiguous artists and unresolved tags from query seeds", async () => {
    mock.tags.mockResolvedValue([]);
    mock.search.mockResolvedValue([{ id: "a", name: "Artist" }, { id: "b", name: "Artist" }]);
    await expect(researchPartnerships({ ...EXAMPLE_BRIEF, artists: "Artist" }, new AbortController().signal)).rejects.toThrow("No cultural interests");
    expect(mock.insights).not.toHaveBeenCalled();
  });
  it("uses an exact artist and reports unresolved interests without fabricating them", async () => {
    mock.tags.mockResolvedValue([]);
    mock.search.mockResolvedValue([{ id: "artist-id", name: "Artist" }]);
    const result = await researchPartnerships({ ...EXAMPLE_BRIEF, artists: "Artist", location: "" }, new AbortController().signal);
    expect(result.seeds).toEqual([{ id: "artist-id", name: "Artist", kind: "artist" }]);
    expect(result.unresolved).toEqual(EXAMPLE_BRIEF.scenes);
    expect(mock.insights.mock.calls[0][0]).not.toHaveProperty("signal.location.query");
    expect(mock.insights.mock.calls[0][0]["signal.interests.entities"]).toBe("artist-id");
  });
  it("returns an explicit configuration error instead of a fictional successful run", async () => {
    mock.configured.mockReturnValue(false);
    const response = await POST(new Request("http://localhost/api/partnerships", { method: "POST", body: JSON.stringify(EXAMPLE_BRIEF) }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("QLOO_API_KEY");
    expect(mock.insights).not.toHaveBeenCalled();
  });
  it("rejects invalid API input before calling Qloo", async () => {
    const response = await POST(new Request("http://localhost/api/partnerships", { method: "POST", body: "{}" }));
    expect(response.status).toBe(400);
    expect(mock.tags).not.toHaveBeenCalled();
  });
});
