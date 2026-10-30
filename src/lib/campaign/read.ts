import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { PageFacts } from "./infer";
import type { ReadFailure } from "./types";

const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;

export class ReadError extends Error {
  constructor(
    readonly reason: ReadFailure,
    message: string,
  ) {
    super(message);
  }
}

function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** Refuses hosts that resolve to loopback, link-local or private ranges. */
async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ReadError("invalid", "Only web addresses can be read.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new ReadError("invalid", "Only standard web ports can be read.");
  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new ReadError("unreachable", `We couldn't find ${url.hostname}. Check the address for typos.`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new ReadError("invalid", "That address points to a private network, so we can't read it.");
  }
}

async function readCapped(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

async function fetchPage(start: string, signal: AbortSignal) {
  let url = new URL(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Reppl/0.2; brand profile reader)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en",
        },
      });
    } catch {
      if (signal.aborted) throw new ReadError("timeout", "The page took too long to respond.");
      throw new ReadError("unreachable", `We couldn't connect to ${url.hostname}.`);
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location")!, url);
      continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw new ReadError("blocked", `${url.hostname} doesn't allow automated reading (it answered ${response.status}).`);
    }
    if (!response.ok) throw new ReadError("unreachable", `${url.hostname} answered with an error (${response.status}).`);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new ReadError("not-html", "That address isn't a web page we can read.");
    return { finalUrl: url.toString(), html: await readCapped(response) };
  }
  throw new ReadError("unreachable", "The page redirected too many times.");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

function decode(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string) {
  return decode(html.replace(/<[^>]+>/g, " "));
}

function meta(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (name !== key) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
  return undefined;
}

export function extractFacts(html: string, url: string): PageFacts {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, " ");
  const title = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const headings = [...cleaned.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((h) => h.length > 2 && h.length < 160)
    .slice(0, 8);
  const body = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? cleaned;

  return {
    url,
    title: title ? stripTags(title) : meta(cleaned, "og:title"),
    siteName: meta(cleaned, "og:site_name") ?? meta(cleaned, "application-name"),
    description: meta(cleaned, "description") ?? meta(cleaned, "og:description") ?? meta(cleaned, "twitter:description"),
    headings,
    bodyText: stripTags(body).slice(0, 6000),
  };
}

export async function readPage(url: string, parent: AbortSignal): Promise<PageFacts> {
  const signal = AbortSignal.any([parent, AbortSignal.timeout(TIMEOUT_MS)]);
  const { finalUrl, html } = await fetchPage(url, signal);
  const facts = extractFacts(html, finalUrl);
  if (!facts.title && !facts.description && !facts.headings?.length && !facts.bodyText) {
    throw new ReadError("empty", "The page loaded but had no readable text. It may be built entirely in JavaScript.");
  }
  return facts;
}
