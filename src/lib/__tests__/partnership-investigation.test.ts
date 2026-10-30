import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ tags: vi.fn(), search: vi.fn(), insights: vi.fn(), tasteTags: vi.fn(), configured: vi.fn() }));
vi.mock("../qloo/client", () => ({ qloo: mock, isQlooConfigured: mock.configured, QlooError: class extends Error {} }));
import { investigateBrand } from "../partnerships/investigate";
import { createDraft, exportApproach, roleOptions } from "../partnerships/strategy";
import { EXAMPLE_BRIEF, type PartnershipCandidate, type PartnershipResearch } from "../partnerships/types";
import { POST } from "@/app/api/partnerships/investigate/route";

const candidate: PartnershipCandidate = { id: "brand-id", name: "Research brand", affinity: 0, tags: [{ id: "fashion", name: "Fashion" }] };
const research: PartnershipResearch = { generatedAt: "2026-10-30T10:00:00Z", seeds: [{ id: "music-seed", name: "Electronic Music", kind: "interest" }], unresolved: [], candidates: [candidate], locationApplied: true, notes: [] };
beforeEach(() => {
  vi.clearAllMocks(); mock.configured.mockReturnValue(true);
  mock.tags.mockImplementation(async (query: string) => [{ id: `tag:${query}`, name: query }]);
  mock.search.mockResolvedValue([]); mock.tasteTags.mockResolvedValue([]); mock.insights.mockResolvedValue([]);
});

describe("Brand-specific evidence investigation", () => {
  it("uses the actual brand ID and stops after a direct cultural bridge, without claiming artist results", async () => {
    mock.tasteTags.mockResolvedValue([{ id: "music-seed", name: "Electronic Music", affinity: 0 }]);
    const result = await investigateBrand(candidate, research, new AbortController().signal);
    expect(result.connections[0]).toMatchObject({ id: "music-seed", matchedBy: "id" });
    expect(result.branches.find(b => b.id === "artists")?.status).toBe("skipped");
    expect(mock.insights).not.toHaveBeenCalled();
    expect(mock.tasteTags.mock.calls.every(call => call[0]["signal.interests.entities"] === candidate.id)).toBe(true);
    expect(result.verdict).toBe("connections-found");
  });
  it("expands research when the bridge is missing, and keeps absent evidence unknown", async () => {
    mock.tasteTags.mockResolvedValue([{ id: "other-tag", name: "Other culture" }]);
    mock.insights.mockResolvedValue([{ id: "other-artist", name: "Retrieved artist", tags: [] }]);
    const result = await investigateBrand(candidate, research, new AbortController().signal);
    expect(mock.insights).toHaveBeenCalledWith(expect.objectContaining({ "filter.type": "urn:entity:artist", "signal.interests.entities": "brand-id" }), expect.any(AbortSignal));
    expect(result.connections).toEqual([]);
    expect(result.verdict).toBe("needs-validation");
    expect(result.limitations.join(" ")).toContain("unknown affinity");
  });
  it("distinguishes label connections from exact IDs and does not invent audience overlap", async () => {
    mock.tasteTags.mockResolvedValue([{ id: "other-id", name: "Electronic Music" }]);
    const result = await investigateBrand(candidate, research, new AbortController().signal);
    expect(result.connections[0].matchedBy).toBe("label");
    expect(result.limitations.join()).toContain("not measured event audience overlap");
  });
  it("checks reference artists by ID even when a direct tag bridge exists", async () => {
    mock.tasteTags.mockResolvedValue([{ id: "music-seed", name: "Electronic Music" }]);
    mock.insights.mockResolvedValue([{ id: "artist-id", name: "Actual artist", tags: [] }]);
    const result = await investigateBrand(candidate, { ...research, seeds: [...research.seeds, { id: "artist-id", name: "Actual artist", kind: "artist" }] }, new AbortController().signal);
    expect(result.connections.some(c => c.id === "artist-id" && c.matchedBy === "id")).toBe(true);
  });
  it("reports partial and total failures without substituting evidence", async () => {
    mock.tasteTags.mockRejectedValue(new Error("unavailable")); mock.insights.mockRejectedValue(new Error("unavailable"));
    const result = await investigateBrand(candidate, research, new AbortController().signal);
    expect(result.verdict).toBe("limited-data");
    expect(result.branches.every(b => b.status === "failed" && b.records.length === 0)).toBe(true);
    expect(result.connections).toEqual([]);
  });
  it("propagates cancellation rather than manufacturing a completed assessment", async () => {
    const controller = new AbortController(); controller.abort();
    mock.tasteTags.mockRejectedValue(new Error("cancelled"));
    await expect(investigateBrand(candidate, research, controller.signal)).rejects.toThrow("cancelled");
  });
  it("rejects a client-supplied brand that was never returned by this event query", async () => {
    mock.insights.mockResolvedValue([{ ...candidate, tags: [] }]);
    const response = await POST(new Request("http://localhost/api/partnerships/investigate", { method: "POST", body: JSON.stringify({ brief: EXAMPLE_BRIEF, candidateId: "invented-brand" }) }));
    expect(response.status).toBe(409);
    expect(mock.tasteTags).not.toHaveBeenCalled();
  });
});

describe("Grounded partnership roles and approaches", () => {
  it("proposes only organizer-confirmed experiences and differentiates roles using retrieved descriptors", () => {
    const fashion = roleOptions(EXAMPLE_BRIEF, candidate);
    const coffee = roleOptions(EXAMPLE_BRIEF, { ...candidate, tags: [{ id: "coffee", name: "Coffee" }] });
    expect(fashion[0].asset.id).toBe("creative-workshop");
    expect(coffee[0].asset.id).toBe("hospitality");
    expect(roleOptions({ ...EXAMPLE_BRIEF, assets: ["hospitality"] }, candidate).map(o => o.asset.id)).toEqual(["hospitality"]);
    expect(roleOptions({ ...EXAMPLE_BRIEF, assets: [] }, candidate)).toEqual([]);
  });
  it("changes the proposition and opening email when a different role is chosen", () => {
    const workshop = createDraft(EXAMPLE_BRIEF, candidate, undefined, "creative-workshop");
    const hospitality = createDraft(EXAMPLE_BRIEF, candidate, undefined, "hospitality");
    expect(workshop.ask).not.toEqual(hospitality.ask);
    expect(workshop.email).not.toEqual(hospitality.email);
    expect(workshop.email).toContain("Fashion");
    expect(workshop.email).toContain("[Your name / event team]");
    expect(workshop.email).not.toContain("@researchbrand");
  });
  it("does not repeat namesake descriptors as additional support in the pitch", () => {
    const options = roleOptions(EXAMPLE_BRIEF, { ...candidate, tags: [{ id: "fashion-one", name: "Fashion" }, { id: "fashion-two", name: "Fashion" }, { id: "fashion-three", name: "fashion" }] });
    expect(options[0].supportCount).toBe(1);
    expect(createDraft(EXAMPLE_BRIEF, { ...candidate, tags: [{ id: "one", name: "Fashion" }, { id: "two", name: "Fashion" }] }).email).not.toContain("Fashion, Fashion");
  });
  it("exports full provenance, zero affinity and unverified commercial status", async () => {
    const investigation = await investigateBrand(candidate, research, new AbortController().signal);
    const result = exportApproach(EXAMPLE_BRIEF, candidate, research, investigation, createDraft(EXAMPLE_BRIEF, candidate, investigation), true);
    expect(result).toContain("Raw affinity: 0");
    expect(result).toContain("music-seed");
    expect(result).toContain("brand-id");
    expect(result).toContain("signal.interests.entities");
    expect(result).toContain("Opening approach — editable, not sent");
    expect(result).toContain("unverified");
  });
});
