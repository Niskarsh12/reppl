import type { NextRequest } from "next/server";
import { getLinkStore } from "@/lib/links/store";

/** Link unfurlers and crawlers fetch links without a person behind them. */
const NOT_A_PERSON = /bot|crawler|spider|preview|slurp|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|skype|vkshare|quora link/i;

function notFound() {
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link not found · Reppl</title>
<body style="margin:0;min-height:100svh;display:grid;place-items:center;background:#f5f1e8;color:#191a16;font:16px/1.5 system-ui,sans-serif">
<main style="max-width:28rem;padding:24px"><h1 style="font-size:24px;margin:0 0 8px">This link doesn't exist</h1>
<p style="margin:0;color:#4f4f47">It may have been mistyped. If someone sent it to you, ask them for the link again.</p></main></body></html>`;
  return new Response(html, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9]{4,16}$/.test(code)) return notFound();

  const store = getLinkStore();
  const agent = request.headers.get("user-agent") ?? "";
  const prefetch = /prefetch|prerender/i.test(request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "");
  const counts = !prefetch && !NOT_A_PERSON.test(agent);

  let referrer: string | undefined;
  try {
    const ref = request.headers.get("referer");
    referrer = ref ? new URL(ref).hostname : undefined;
  } catch {
    referrer = undefined;
  }

  const record = counts
    ? await store.recordClick(code, { at: new Date().toISOString(), ref: referrer })
    : await store.get(code);
  if (!record) return notFound();

  return new Response(null, {
    status: 302,
    headers: { Location: record.destination, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer-when-downgrade" },
  });
}
