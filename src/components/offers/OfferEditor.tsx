"use client";

import { useState, type InputHTMLAttributes } from "react";
import { GOALS } from "@/lib/campaign/catalog";
import { KINDS, KIND_LABEL } from "@/lib/discovery/kinds";
import type { SponsorshipOffer } from "@/lib/offers/types";
import { parseOffer } from "@/lib/offers/validate";
import { Notice } from "../ui/Status";

function Input({ label, name, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <label className="grid content-start gap-2 text-sm font-medium">{label}<input name={name} className="input font-normal" {...props} /></label>;
}
function Area({ label, name, value, required = false }: { label: string; name: string; value?: string; required?: boolean }) {
  return <label className="grid content-start gap-2 text-sm font-medium">{label}<textarea name={name} className="input min-h-24 font-normal" defaultValue={value} maxLength={2000} required={required} /></label>;
}
export function OfferEditor({ offer, onSave, onCancel }: { offer?: SponsorshipOffer; onSave: (offer: SponsorshipOffer) => void; onCancel: () => void }) {
  const [error, setError] = useState("");
  return <form className="card grid gap-8 p-5 sm:p-8" aria-label={offer ? "Edit sponsorship offer" : "Add sponsorship offer"} onSubmit={e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const number = (key: string) => text(key) === "" ? null : Number(text(key));
    const source = (prefix: string) => ({ source: text(`${prefix}Source`), checkedAt: text(`${prefix}Checked`) });
    const outcomeValues = ["actualSpend", "impressions", "clicks", "conversions"].some(key => text(key) !== "");
    const candidate = { id: offer?.id ?? `offer-${crypto.randomUUID()}`, partner: text("partner"), title: text("title"), kind: text("kind"), delivery: text("delivery"), market: text("market"),
      deliverables: text("deliverables").split("\n").map(s => s.trim()).filter(Boolean), interests: text("interests").split(",").map(s => s.trim()).filter(Boolean), goals: data.getAll("goals"), startDate: text("startDate"), endDate: text("endDate"),
      price: { ...source("price"), amount: number("amount"), currency: "USD", basis: text("priceBasis"), validUntil: text("priceExpiry"), extras: number("extras") ?? 0, extrasConfirmed: data.has("extrasConfirmed") },
      availability: { ...source("availability"), status: text("availability"), validUntil: text("availabilityExpiry") },
      audience: { ...source("audience"), size: number("audienceSize"), unit: text("audienceUnit"), description: text("audienceDescription"), basis: text("audienceBasis") },
      ...(outcomeValues || text("outcomeSource") ? { outcomes: { ...source("outcome"), actualSpend: number("actualSpend"), impressions: number("impressions"), clicks: number("clicks"), conversions: number("conversions"), notes: text("outcomeNotes") } } : {}),
    };
    const parsed = parseOffer(candidate);
    if (!parsed) { setError("Check the evidence fields. Quotes and published prices need a source. Confirmed availability needs a source and date checked. Audience figures need a source, date, unit and evidence type. Actual outcomes need a source and date. Use whole, non-negative numbers and valid delivery dates."); return; }
    onSave(parsed);
  }}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{offer ? "Edit offer and evidence" : "Add an actual offer"}</h2><button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button></div>
    <p className="text-sm leading-relaxed text-ink-soft">Record what the partner offered and where each fact came from. A source can be a rate-card URL, proposal reference or dated email note. Your entries are user-recorded evidence; Reppl does not independently verify them.</p>
    <fieldset className="grid gap-4"><legend className="mb-4 text-base font-semibold">The offer</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Partner or event" name="partner" defaultValue={offer?.partner} required maxLength={120} />
        <Input label="Package / offer name" name="title" defaultValue={offer?.title} required maxLength={160} />
        <label className="grid gap-2 text-sm font-medium">Opportunity type<select className="input" name="kind" defaultValue={offer?.kind ?? "creator"}>{KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k].one}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Delivery<select className="input" name="delivery" defaultValue={offer?.delivery ?? "online"}><option value="online">Online</option><option value="in-person">In person</option></select></label>
        <Input label="Market / city (required for in person)" name="market" defaultValue={offer?.market} maxLength={90} />
        <Input label="Audience interests (comma-separated)" name="interests" defaultValue={offer?.interests.join(", ")} placeholder="Use interests supported by the proposal" maxLength={2000} />
        <Input label="Delivery starts (optional)" name="startDate" type="date" defaultValue={offer?.startDate} />
        <Input label="Delivery ends (optional)" name="endDate" type="date" defaultValue={offer?.endDate} />
      </div>
      <Area label="Deliverables (one per line)" name="deliverables" value={offer?.deliverables.join("\n")} required />
      <div><p className="mb-2 text-sm font-medium">Objectives supported by these deliverables (optional)</p><div className="flex flex-wrap gap-x-5 gap-y-3">{GOALS.map(g => <label key={g.id} className="flex items-center gap-2 text-sm"><input className="accent-forest" type="checkbox" name="goals" value={g.id} defaultChecked={offer?.goals.includes(g.id)} />{g.label}</label>)}</div></div>
    </fieldset>
    <p className="text-sm text-ink-faint">For online delivery, leave market blank if unrestricted. A specified market must match the campaign market. Physical offers require an exact city / region match.</p>
    <fieldset className="grid gap-4 border-t border-line pt-6"><legend className="pr-3 text-base font-semibold">Price and scope</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Package fee (USD; blank if unknown)" name="amount" type="number" min="0" max="100000000" step="1" defaultValue={offer?.price.amount ?? ""} />
        <label className="grid gap-2 text-sm font-medium">Price basis<select className="input" name="priceBasis" defaultValue={offer?.price.basis ?? "quote"}><option value="quote">Partner quote (recorded by you)</option><option value="published">Published rate</option><option value="estimate">My planning estimate</option></select></label>
        <Input label="Price source / proposal reference" name="priceSource" defaultValue={offer?.price.source} maxLength={2000} />
        <Input label="Price checked on" name="priceChecked" type="date" defaultValue={offer?.price.checkedAt} />
        <Input label="Quote / rate valid until (optional)" name="priceExpiry" type="date" defaultValue={offer?.price.validUntil} />
        <Input label="Extra costs (USD: tax, production, travel…)" name="extras" type="number" min="0" max="100000000" step="1" defaultValue={offer?.price.extras ?? 0} />
      </div>
      <label className="flex items-start gap-2 text-sm leading-relaxed"><input className="mt-1 accent-forest" type="checkbox" name="extrasConfirmed" defaultChecked={offer?.price.extrasConfirmed} />I have checked extra costs for this scope, including whether they are zero.</label>
    </fieldset>
    <fieldset className="grid gap-4 border-t border-line pt-6"><legend className="pr-3 text-base font-semibold">Availability evidence</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">Availability<select className="input" name="availability" defaultValue={offer?.availability.status ?? "pending"}><option value="pending">Pending confirmation</option><option value="confirmed">Confirmed by partner (recorded by you)</option><option value="unavailable">Unavailable</option></select></label>
        <Input label="Availability source / email reference" name="availabilitySource" defaultValue={offer?.availability.source} maxLength={2000} />
        <Input label="Availability checked on" name="availabilityChecked" type="date" defaultValue={offer?.availability.checkedAt} />
        <Input label="Availability valid until (optional)" name="availabilityExpiry" type="date" defaultValue={offer?.availability.validUntil} />
      </div>
      <p className="text-sm text-ink-faint">The standard shortlist needs availability checked within 14 days and price evidence checked within 30 days. Expired offers are excluded even from provisional scenarios.</p>
    </fieldset>
    <details className="border-t border-line pt-4" open={offer?.audience.size !== null && offer?.audience.size !== undefined}>
      <summary className="cursor-pointer text-base font-semibold">Audience evidence (optional)</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Reported audience size" name="audienceSize" type="number" min="0" max="100000000" step="1" defaultValue={offer?.audience.size ?? ""} />
        <Input label="Audience unit (followers, listeners, attendees…)" name="audienceUnit" defaultValue={offer?.audience.unit} maxLength={80} />
        <label className="grid gap-2 text-sm font-medium">Audience evidence type<select className="input" name="audienceBasis" defaultValue={offer?.audience.basis ?? "unknown"}><option value="unknown">Unknown / no evidence</option><option value="media-kit">Media kit</option><option value="analytics">Platform analytics</option><option value="partner-reported">Partner-reported figure</option></select></label>
        <Input label="Audience source / media-kit reference" name="audienceSource" defaultValue={offer?.audience.source} maxLength={2000} />
        <Input label="Audience checked on" name="audienceChecked" type="date" defaultValue={offer?.audience.checkedAt} />
        <Area label="Audience description / market evidence" name="audienceDescription" value={offer?.audience.description} />
      </div>
      <p className="mt-3 text-sm text-ink-faint">A media kit is a partner claim, not independently verified reach. Figures older than 90 days stay visible as evidence but receive no audience-data quality credit.</p>
    </details>
    <details className="border-t border-line pt-4" open={!!offer?.outcomes}>
      <summary className="cursor-pointer text-base font-semibold">Actual outcomes (optional, after activation)</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Actual spend (USD)" name="actualSpend" type="number" min="0" max="100000000" step="1" defaultValue={offer?.outcomes?.actualSpend ?? ""} />
        <Input label="Reported impressions" name="impressions" type="number" min="0" max="100000000" step="1" defaultValue={offer?.outcomes?.impressions ?? ""} />
        <Input label="Reported clicks" name="clicks" type="number" min="0" max="100000000" step="1" defaultValue={offer?.outcomes?.clicks ?? ""} />
        <Input label="Reported conversions" name="conversions" type="number" min="0" max="100000000" step="1" defaultValue={offer?.outcomes?.conversions ?? ""} />
        <Input label="Results source / analytics report" name="outcomeSource" defaultValue={offer?.outcomes?.source} maxLength={2000} />
        <Input label="Results recorded on" name="outcomeChecked" type="date" defaultValue={offer?.outcomes?.checkedAt} />
        <Area label="Results notes / attribution limitations" name="outcomeNotes" value={offer?.outcomes?.notes} />
      </div>
      <p className="mt-3 text-sm text-ink-faint">Record observed results, not projections. Reported clicks stay separate from Reppl tracked clicks; neither is added to the other.</p>
    </details>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="flex flex-wrap gap-3"><button type="submit" className="btn btn-primary">Save offer and evidence</button><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
  </form>;
}
