import { optimizePortfolio } from "@/lib/campaign/optimizer";
import { getDiscoveryProvider } from "@/lib/discovery/provider";
import type { DiscoveryEvent } from "@/lib/discovery/types";
import { parseDiscoveryRequest } from "@/lib/discovery/validate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseDiscoveryRequest(body);
  if (!parsed) {
    return Response.json({ error: "The brand profile or campaign details are incomplete." }, { status: 400 });
  }

  const provider = getDiscoveryProvider();
  const iterator = provider.discover(parsed, request.signal)[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const encode = (event: DiscoveryEvent) => encoder.encode(`${JSON.stringify(event)}\n`);

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else {
          if (value.type === "complete") value.result.portfolio = optimizePortfolio(value.result.matches, parsed);
          controller.enqueue(encode(value));
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("[discover]", error);
          controller.enqueue(encode({ type: "error", message: "The search stopped unexpectedly. Please try again." }));
        }
        controller.close();
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
