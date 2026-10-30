import { calendarDate } from "@/lib/offers/date";
import { parseDiscoveryRequest } from "@/lib/discovery/validate";
import { parseOffers } from "@/lib/offers/validate";
import { evaluateOffers } from "@/lib/offers/evaluate";
import { offerToMatch } from "@/lib/offers/evidence";
import { enrichOfferCulture } from "@/lib/offers/qloo";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const context = parseDiscoveryRequest(body);
  const offers = parseOffers(body?.offers);
  if (!context || !offers || !offers.length || (body.includeProvisional !== undefined && typeof body.includeProvisional !== "boolean") || (body.enrich !== undefined && typeof body.enrich !== "boolean")) return Response.json({ error: "Add valid offers and campaign details before comparing." }, { status: 400 });
  let asOf: string;
  try {
    if (body.timeZone !== undefined && (typeof body.timeZone !== "string" || body.timeZone.length > 100)) throw new Error("Invalid time zone");
    asOf = calendarDate(body.timeZone ?? "UTC");
  } catch { return Response.json({ error: "Choose a valid calendar time zone." }, { status: 400 }); }
  const matches = offers.map(o => offerToMatch(o, context, asOf, body.includeProvisional === true));
  const culture = body.enrich === true ? await enrichOfferCulture(matches, context, request.signal) : { matches, notes: ["Optional Qloo enrichment was not requested. Interests are user-declared."] };
  return Response.json({ result: evaluateOffers(offers, context, asOf, body.includeProvisional === true, culture.matches, culture.notes) }, { headers: { "Cache-Control": "no-store" } });
}
