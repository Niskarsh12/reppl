import type { DiscoveryEvent, DiscoveryRequest, DiscoveryResult } from "./types";

export class DiscoveryError extends Error {}

/** Streams discovery progress from the server. Resolves with the final result. */
export async function runDiscovery(
  request: DiscoveryRequest,
  onEvent: (event: DiscoveryEvent) => void,
  signal: AbortSignal,
): Promise<DiscoveryResult> {
  let response: Response;
  try {
    response = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new DiscoveryError("We couldn't reach the search service. Check your connection and try again.");
  }

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null);
    throw new DiscoveryError(payload?.error ?? "The search couldn't start. Please try again.");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let result: DiscoveryResult | null = null;

  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as DiscoveryEvent;
    if (event.type === "error") throw new DiscoveryError(event.message);
    if (event.type === "complete") result = event.result;
    onEvent(event);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(handle);
    }
    handle(buffer);
  } catch (error) {
    if (signal.aborted || error instanceof DiscoveryError) throw error;
    throw new DiscoveryError("The connection dropped mid-search. Please try again.");
  }

  if (!result) throw new DiscoveryError("The search ended before any results came back.");
  return result;
}
