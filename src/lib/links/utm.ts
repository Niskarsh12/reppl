export const STATS_DAYS = 14;

export function slugify(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "campaign"
  );
}

export function withUtm(destination: string, utm: { source: string; medium: string; campaign: string; content?: string }) {
  const url = new URL(destination);
  url.searchParams.set("utm_source", utm.source);
  url.searchParams.set("utm_medium", utm.medium);
  url.searchParams.set("utm_campaign", utm.campaign);
  if (utm.content) url.searchParams.set("utm_content", utm.content);
  return url.toString();
}

export function shortLink(code: string, origin = typeof window === "undefined" ? "" : window.location.origin) {
  return `${origin}/r/${code}`;
}

export function isCampaignId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{8,48}$/.test(value);
}
