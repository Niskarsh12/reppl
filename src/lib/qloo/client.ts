import "server-only";

const DEFAULT_BASE_URL = "https://hackathon.api.qloo.com";
const TIMEOUT_MS = 9000;
const RETRIES = 2;
/** Qloo's terms allow private server-side caching; responses are never written to disk or the repo. */
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX = 400;

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface QlooTag {
  id: string;
  name: string;
  type?: string;
  affinity?: number;
}

export interface QlooEntity {
  id: string;
  name: string;
  subtype?: string;
  type?: string;
  popularity?: number;
  /** Raw provider affinity; never rescaled into reach. */
  affinity?: number;
  tags: QlooTag[];
  description?: string;
  image?: string;
  address?: string;
}

export interface QlooSkew {
  age: Record<string, number>;
  gender: Record<string, number>;
}

type Params = Record<string, string | number | boolean | undefined>;

export function isQlooConfigured() {
  return Boolean(process.env.QLOO_API_KEY?.trim());
}

const cache = new Map<string, { at: number; data: unknown }>();

function remember(key: string, data: unknown) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), data });
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const stop = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** GET a Qloo route. Resolves `null` for 404, which Qloo uses for "no results". */
async function get(path: string, params: Params, signal: AbortSignal): Promise<unknown> {
  const key = process.env.QLOO_API_KEY?.trim();
  if (!key) throw new QlooError("QLOO_API_KEY is not set.", 401);
  const url = new URL(path, process.env.QLOO_API_URL?.trim() || DEFAULT_BASE_URL);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const id = url.toString();

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "X-Api-Key": key, accept: "application/json" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
        cache: "no-store",
      });
    } catch (error) {
      if (signal.aborted) throw error;
      if (attempt < RETRIES) continue;
      throw new QlooError("Qloo didn't respond in time.", 504);
    }

    if (response.status === 404) {
      remember(id, null);
      return null;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : 500 * (attempt + 1), signal);
      continue;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new QlooError(`Qloo ${path} returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`, response.status);
    }
    const data = await response.json();
    remember(id, data);
    return data;
  }
}

/* Parsing is deliberately lenient: the hackathon API returns a few shapes for the same idea. */

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function list(data: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isObject(data)) return [];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
    if (isObject(value)) {
      const nested = list(value, ...keys);
      if (nested.length) return nested;
    }
  }
  return [];
}

function parseTag(raw: unknown): QlooTag | null {
  if (!isObject(raw)) return null;
  const id = str(raw.tag_id) ?? str(raw.id) ?? str(raw.tag_value);
  const name = str(raw.name);
  if (!id || !name) return null;
  const query = isObject(raw.query) ? raw.query : {};
  return { id, name, type: str(raw.subtype) ?? str(raw.type), affinity: num(query.affinity) ?? num(raw.affinity) };
}

function parseDescription(props: Raw) {
  const short = props.short_descriptions;
  if (Array.isArray(short)) {
    const first = short.find((s) => isObject(s) && str(s.value));
    if (isObject(first)) return str(first.value);
  }
  return str(props.short_description) ?? str(props.description);
}

function parseEntity(raw: unknown): QlooEntity | null {
  if (!isObject(raw)) return null;
  const id = str(raw.entity_id) ?? str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const props = isObject(raw.properties) ? raw.properties : {};
  const query = isObject(raw.query) ? raw.query : {};
  const affinity = num(query.affinity) ?? num(raw.affinity);
  const image = isObject(props.image) ? str(props.image.url) : isObject(raw.image) ? str(raw.image.url) : undefined;
  const tags = (Array.isArray(raw.tags) ? raw.tags : Array.isArray(props.tags) ? props.tags : [])
    .map(parseTag)
    .filter((t): t is QlooTag => t !== null);
  return {
    id,
    name,
    subtype: str(raw.subtype),
    type: Array.isArray(raw.types) ? raw.types.find((t): t is string => typeof t === "string") : str(raw.type),
    popularity: num(raw.popularity) ?? num(props.popularity),
    affinity,
    tags,
    description: parseDescription(props),
    image,
    address: str(props.address),
  };
}

const entities = (data: unknown) => list(data, "results", "entities").map(parseEntity).filter((e): e is QlooEntity => e !== null);
const tags = (data: unknown) => list(data, "results", "tags").map(parseTag).filter((t): t is QlooTag => t !== null);

export const qloo = {
  /** Finds entities by name, e.g. a brand. */
  async search(query: string, type: string, take: number, signal: AbortSignal) {
    return entities(await get("/search", { query, types: type, take }, signal));
  },

  /** Finds tag ids whose names match a keyword. */
  async tags(query: string, take: number, signal: AbortSignal) {
    return tags(await get("/v2/tags", { "filter.query": query, take }, signal));
  },

  /** Recommendations of one entity type for the given signals. */
  async insights(params: Params, signal: AbortSignal) {
    return entities(await get("/v2/insights", params, signal));
  },

  /** Taste analysis: the tags that best describe the given signals. */
  async tasteTags(params: Params, signal: AbortSignal) {
    return tags(await get("/v2/insights", { ...params, "filter.type": "urn:tag" }, signal));
  },

  /** Age and gender affinity for the given signals, where positive means over-indexing. */
  async demographics(params: Params, signal: AbortSignal): Promise<QlooSkew | null> {
    const data = await get("/v2/insights", { ...params, "filter.type": "urn:demographics" }, signal);
    const first = list(data, "results", "demographics").find(isObject);
    const query = first && isObject(first.query) ? first.query : null;
    if (!query) return null;
    const numbers = (v: unknown) =>
      Object.fromEntries(Object.entries(isObject(v) ? v : {}).filter((e): e is [string, number] => typeof e[1] === "number"));
    return { age: numbers(query.age), gender: numbers(query.gender) };
  },
};
