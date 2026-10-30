import { validDate } from "./evidence";
import { GOALS } from "../campaign/catalog";
import { KINDS } from "../discovery/kinds";
import type { SponsorshipOffer } from "./types";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 2000) => typeof v === "string" ? v.trim().slice(0, max) : "";
const amount = (v: unknown) => v === null || (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 100_000_000);
const date = (v: unknown) => v === "" || (typeof v === "string" && validDate(v));
const list = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(x => typeof x === "string" && x.trim().length > 0 && x.length <= 300);
export function parseOffer(input: unknown): SponsorshipOffer | null {
  if (!object(input)) return null;
  const o = input;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(text(o.id, 101)) || !text(o.partner, 120) || !text(o.title, 160)) return null;
  if (!KINDS.includes(o.kind as never) || !["online", "in-person"].includes(String(o.delivery))) return null;
  if (o.delivery === "in-person" && !text(o.market, 90)) return null;
  if (!list(o.deliverables, 15) || o.deliverables.length === 0 || !list(o.interests, 20)) return null;
  if (!Array.isArray(o.goals) || o.goals.length > 5 || !o.goals.every(g => GOALS.some(x => x.id === g))) return null;
  if (!date(o.startDate) || !date(o.endDate) || (o.startDate && o.endDate && String(o.startDate) > String(o.endDate))) return null;
  const p = o.price, a = o.availability, u = o.audience;
  if (!object(p) || !object(a) || !object(u)) return null;
  if (!amount(p.amount) || !amount(p.extras) || p.extras === null || p.currency !== "USD" || typeof p.extrasConfirmed !== "boolean" || !["quote","published","estimate"].includes(String(p.basis))) return null;
  if (!date(p.checkedAt) || !date(p.validUntil) || !date(a.checkedAt) || !date(a.validUntil) || !date(u.checkedAt)) return null;
  if (!text(p.source) && p.amount !== null && p.basis !== "estimate") return null;
  if (!["confirmed","pending","unavailable"].includes(String(a.status)) || (a.status === "confirmed" && (!text(a.source) || !a.checkedAt))) return null;
  if (!amount(u.size) || !["media-kit","analytics","partner-reported","unknown"].includes(String(u.basis)) || (u.size !== null && (!text(u.source) || !text(u.unit,80) || u.basis === "unknown" || !u.checkedAt))) return null;
  const normalized = { id: text(o.id,100), partner: text(o.partner,120), title: text(o.title,160), kind: o.kind, delivery: o.delivery, market: text(o.market,90), deliverables: o.deliverables, interests: o.interests, goals: o.goals, startDate: o.startDate, endDate: o.endDate,
    price: { amount: p.amount, extras: p.extras, extrasConfirmed: p.extrasConfirmed, currency: "USD", basis: p.basis, source: text(p.source), checkedAt: p.checkedAt, validUntil: p.validUntil },
    availability: { status: a.status, source: text(a.source), checkedAt: a.checkedAt, validUntil: a.validUntil },
    audience: { size: u.size, unit: text(u.unit,80), description: text(u.description), basis: u.basis, source: text(u.source), checkedAt: u.checkedAt } } as SponsorshipOffer;
  if (o.outcomes !== undefined) {
    const r = o.outcomes;
    if (!object(r) || ![r.actualSpend,r.impressions,r.clicks,r.conversions].every(amount) || !date(r.checkedAt) || !text(r.source) || !r.checkedAt) return null;
    normalized.outcomes = { actualSpend: r.actualSpend as number|null, impressions: r.impressions as number|null, clicks: r.clicks as number|null, conversions: r.conversions as number|null, source: text(r.source), checkedAt: String(r.checkedAt), notes: text(r.notes) };
  }
  return normalized;
}
export function parseOffers(input: unknown): SponsorshipOffer[] | null {
  if (!Array.isArray(input) || input.length > 40) return null;
  const offers = input.map(parseOffer);
  if (offers.some(o => !o) || new Set(offers.map(o => o!.id)).size !== offers.length) return null;
  return offers as SponsorshipOffer[];
}
