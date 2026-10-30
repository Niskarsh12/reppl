import { isQlooConfigured, QlooError } from "@/lib/qloo/client";
import { parseEventBrief, researchPartnerships } from "@/lib/partnerships/research";
import { investigateBrand } from "@/lib/partnerships/investigate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const brief = parseEventBrief(body?.brief);
  if (!brief || typeof body?.candidateId !== "string" || !body.candidateId || body.candidateId.length > 200) return Response.json({ error: "Choose a brand from this event's discovery results." }, { status: 400 });
  if (!isQlooConfigured()) return Response.json({ error: "Qloo is not configured. Your saved work remains available." }, { status: 503 });
  try {
    // The client cannot inject invented brand evidence: resolve it from the
    // validated event query on the server, using the existing private cache.
    const research = await researchPartnerships(brief, request.signal);
    const candidate = research.candidates.find(c => c.id === body.candidateId);
    if (!candidate) return Response.json({ error: "This brand was not returned for the current event query. Refresh discovery and choose a current result." }, { status: 409 });
    return Response.json(await investigateBrand(candidate, research, request.signal), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("[partnership-investigation]", error instanceof QlooError ? error.status : "failed");
    return Response.json({ error: "The investigation could not start. Retry after checking the event's discovery results." }, { status: 502 });
  }
}
