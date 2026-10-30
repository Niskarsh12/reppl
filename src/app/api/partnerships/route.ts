import { isQlooConfigured, QlooError } from "@/lib/qloo/client";
import { parseEventBrief, researchPartnerships } from "@/lib/partnerships/research";

export async function GET() {
  return Response.json({ configured: isQlooConfigured() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const brief = parseEventBrief(await request.json().catch(() => null));
  if (!brief) return Response.json({ error: "Add an event name and one to eight cultural interests. Check the field lengths and try again." }, { status: 400 });
  if (!isQlooConfigured()) return Response.json({ error: "Live research is not connected. Add QLOO_API_KEY to the server environment and restart. Your brief and strategy workspace remain available." }, { status: 503 });
  try {
    return Response.json(await researchPartnerships(brief, request.signal), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const message = error instanceof QlooError
      ? error.status === 401 || error.status === 403 ? "Qloo did not accept the server API key. Check the integration configuration."
        : error.status === 429 ? "Qloo is limiting requests. Please wait a moment and retry."
          : "Qloo could not complete this research. Retry or refine your cultural interests."
      : "No cultural interests could be resolved. Try different interests or a reference artist.";
    console.error("[partnerships]", error instanceof QlooError ? error.status : "resolution-failed");
    return Response.json({ error: message }, { status: 502 });
  }
}
