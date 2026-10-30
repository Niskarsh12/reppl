import { inferProfile } from "@/lib/campaign/infer";
import { ReadError, readPage } from "@/lib/campaign/read";
import { normalizeUrl } from "@/lib/campaign/validate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? normalizeUrl(body.url) : null;
  if (!url) {
    return Response.json({ reason: "invalid", error: "That doesn't look like a web address." }, { status: 400 });
  }

  try {
    const facts = await readPage(url, request.signal);
    return Response.json({ profile: inferProfile(facts, "page") });
  } catch (error) {
    if (error instanceof ReadError) {
      return Response.json({ reason: error.reason, error: error.message }, { status: 422 });
    }
    console.error("[brand]", error);
    return Response.json({ reason: "unreachable", error: "Something went wrong while reading the page." }, { status: 500 });
  }
}
