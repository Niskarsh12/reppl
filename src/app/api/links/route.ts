import type { LinkStats } from "@/lib/campaign/types";
import { normalizeUrl } from "@/lib/campaign/validate";
import { isKind } from "@/lib/discovery/kinds";
import { getLinkStore, type LinkRecord } from "@/lib/links/store";
import { STATS_DAYS, isCampaignId, slugify, withUtm } from "@/lib/links/utm";

const MAX_LINKS = 12;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toStats(record: LinkRecord, now: Date): LinkStats {
  const days = Array.from({ length: STATS_DAYS }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - (STATS_DAYS - 1 - i));
    return dayKey(d);
  });
  const daily = days.map((day) => record.clicks.filter((c) => c.at.startsWith(day)).length);
  return {
    code: record.code,
    opportunityId: record.opportunityId,
    label: record.label,
    destination: record.destination,
    createdAt: record.createdAt,
    clicks: record.clicks.length,
    lastClickAt: record.clicks.at(-1)?.at ?? null,
    daily,
  };
}

export async function GET(request: Request) {
  const campaignId = new URL(request.url).searchParams.get("campaign");
  if (!isCampaignId(campaignId)) return Response.json({ error: "Missing campaign." }, { status: 400 });
  const now = new Date();
  const records = await getLinkStore().list(campaignId);
  return Response.json(
    { links: records.map((r) => toStats(r, now)), checkedAt: now.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

interface CreateBody {
  campaignId?: unknown;
  campaignName?: unknown;
  destination?: unknown;
  items?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const destination = typeof body?.destination === "string" ? normalizeUrl(body.destination) : null;
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!body || !isCampaignId(body.campaignId) || !destination || typeof body.campaignName !== "string") {
    return Response.json({ error: "The link request is incomplete." }, { status: 400 });
  }

  const valid = items
    .filter(
      (i): i is { opportunityId: string; label: string; kind: string } =>
        typeof i?.opportunityId === "string" && typeof i?.label === "string" && isKind(i?.kind),
    )
    .slice(0, MAX_LINKS);
  if (valid.length === 0) return Response.json({ error: "Choose at least one opportunity first." }, { status: 400 });

  const campaign = slugify(body.campaignName);
  const records = await getLinkStore().create(
    valid.map((item) => ({
      campaignId: body.campaignId as string,
      opportunityId: item.opportunityId.slice(0, 64),
      label: item.label.slice(0, 80),
      destination: withUtm(destination, {
        source: slugify(item.label),
        medium: item.kind,
        campaign,
        content: "reppl",
      }),
    })),
  );

  const now = new Date();
  return Response.json({ links: records.map((r) => toStats(r, now)) }, { status: 201 });
}
