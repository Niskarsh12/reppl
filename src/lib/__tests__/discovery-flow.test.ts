import { it, expect, vi } from "vitest";
import { demoProvider } from "../discovery/demo/provider";
import type { DiscoveryEvent } from "../discovery/types";
import { ONLINE_ONLY } from "../campaign/catalog";
it("completes the illustrative pipeline and releases every abort listener", async () => {
  vi.useFakeTimers();
  try {
    const signal = new AbortController().signal;
    const added = vi.spyOn(signal, "addEventListener");
    const removed = vi.spyOn(signal, "removeEventListener");
    const events: DiscoveryEvent[] = [];
    const run = (async () => {
      for await (const event of demoProvider.discover({ brand: { name: "Test", domain: "test.com", category: "food-drink", signals: ["Specialty coffee"] }, setup: { url: "https://test.com", budget: 10000, goals: ["awareness"], location: ONLINE_ONLY } }, signal)) events.push(event);
    })();
    await vi.runAllTimersAsync();
    await run;
    expect(events.at(-1)?.type).toBe("complete");
    expect(added.mock.calls.length).toBeGreaterThan(10);
    expect(removed.mock.calls.length).toBe(added.mock.calls.length);
    const result = events.at(-1);
    if (result?.type === "complete") expect(result.result.matches.every(m => m.opportunity.source === "sample" && m.opportunity.costEvidence?.status === "illustrative")).toBe(true);
  } finally { vi.useRealTimers(); vi.restoreAllMocks(); }
});
