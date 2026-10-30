"use client";

import { calendarDate } from "@/lib/offers/date";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { money } from "@/lib/campaign/catalog";
import { assessOffer } from "@/lib/offers/evidence";
import { parseOffers } from "@/lib/offers/validate";
import type { SponsorshipOffer } from "@/lib/offers/types";
import type { DiscoveryResult } from "@/lib/discovery/types";
import { useJourney } from "../journey/JourneyProvider";
import { discoveryKey } from "../journey/state";
import { PageHeader, Shell } from "../ui/PageHeader";
import { Notice } from "../ui/Status";
import { OfferOutcomes } from "./OfferOutcomes";
import { OfferEditor } from "./OfferEditor";

export function Offers() {
  const { state, dispatch, navigate } = useJourney();
  const [editing, setEditing] = useState<SponsorshipOffer | "new" | null>(null);
  const [includeProvisional, setIncludeProvisional] = useState(false);
  const [enrich, setEnrich] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const asOf = calendarDate();
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const ready = state.offers.filter(o => assessOffer(o, asOf, false).eligible).length;
  const compare = async () => {
    if (!state.profile || !state.setup || !state.offers.length) return;
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/offers/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ brand: state.profile, setup: state.setup, offers: state.offers, includeProvisional, enrich, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      const payload = await response.json() as { result?: DiscoveryResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "Could not compare offers.");
      if (controller.signal.aborted) return;
      dispatch({ type: "offerMode", mode: "offers" });
      dispatch({ type: "discovered", key: JSON.stringify([discoveryKey(state.profile, state.setup), state.offers, includeProvisional]), result: payload.result });
      navigate("opportunities");
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not reach the comparison service. Your offers are still saved."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const exportOffers = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, offers: state.offers }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "reppl-sponsorship-offers.json"; a.click(); URL.revokeObjectURL(url);
  };
  const imported = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error("Keep the import under 1 MB.");
      const value = JSON.parse(await file.text());
      const offers = parseOffers(Array.isArray(value) ? value : value && typeof value === "object" ? value.offers : undefined);
      if (!offers || new Set([...state.offers, ...offers].map(o => o.id)).size > 40) throw new Error("Import needs valid offer records with unique IDs, up to 40 offers in total. Existing IDs are updated.");
      dispatch({ type: "importOffers", offers }); setError(""); toast(`${offers.length} offers imported`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the offer file."); }
  };
  return <Shell wide>
    <PageHeader title="Your sponsorship offers" subline="Compare proposals you can actually consider buying. Keep price, availability and audience evidence beside each offer." actions={<button type="button" className="btn btn-secondary" disabled={busy || editing !== null || state.offers.length >= 40} onClick={() => setEditing("new")}>Add offer</button>} />
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 text-sm">
      <p className="text-ink-soft">{state.offers.length} offers · {ready} with current commercial evidence · Budget <span className="num text-ink">{money(state.setup?.budget ?? 0)}</span></p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-quiet" disabled={busy || !state.offers.length} onClick={exportOffers}>Export offers</button>
        <label className="btn btn-quiet cursor-pointer">Import offers<input className="sr-only" type="file" accept="application/json,.json" disabled={busy || editing !== null} onChange={e => { void imported(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <button type="button" className="btn btn-quiet" disabled={busy || editing !== null} onClick={() => { dispatch({ type: "offerMode", mode: "discovery" }); navigate("opportunities"); }}>Explore cultural leads</button>
      </div>
    </div>
    {error && <div className="mb-6"><Notice tone="error">{error}</Notice></div>}
    {editing && <div className="mb-8"><OfferEditor key={editing === "new" ? "new" : editing.id} offer={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSave={offer => { dispatch({ type: "saveOffer", offer }); setEditing(null); toast("Offer and evidence saved"); }} /></div>}
    {state.offers.some(o => o.outcomes) && <OfferOutcomes offers={state.offers} />}
    <div className="grid items-start gap-8 lg:grid-cols-12">
      <section className="grid min-w-0 gap-4 lg:col-span-8" aria-label="Your recorded offers">
        {state.offers.length === 0 && <div className="card grid justify-items-start gap-4 p-6 sm:p-8"><h2 className="text-lg font-semibold">Start with a proposal, rate card or email</h2><p className="max-w-[60ch] text-sm leading-relaxed text-ink-soft">Add the packages you are considering, what they include and the evidence you have. Unknown prices and pending availability are welcome; the comparison will explain what needs follow-up.</p><button type="button" className="btn btn-primary" disabled={editing !== null} onClick={() => setEditing("new")}>Add your first offer</button></div>}
        {state.offers.map(offer => {
          const assessment = assessOffer(offer, asOf, false);
          return <article key={offer.id} className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-base font-semibold">{offer.partner}</h2><p className="mt-1 break-words text-sm text-ink-soft">{offer.title}</p></div><p className="num text-sm font-medium">{offer.price.amount === null ? "Price unknown" : money(offer.price.amount + offer.price.extras)}</p></div>
            <div className="mt-4 flex flex-wrap gap-2"><span className={`pill ${assessment.eligible ? "pill-moss" : "pill-neutral"}`}>{assessment.eligible ? "Current commercial evidence" : "Needs follow-up"}</span><span className="pill pill-neutral">{offer.price.basis === "quote" ? "Recorded partner quote" : offer.price.basis === "published" ? "Published rate" : "Planning estimate"}</span><span className="pill pill-neutral">Availability: {offer.availability.status}</span></div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{offer.deliverables.join(" · ")}</p>
            <dl className="mt-4 grid gap-2 break-words text-sm sm:grid-cols-2"><div><dt className="text-ink-faint">Price checked</dt><dd>{offer.price.checkedAt || "Not recorded"}</dd></div><div><dt className="text-ink-faint">Availability checked</dt><dd>{offer.availability.checkedAt || "Not recorded"}</dd></div><div><dt className="text-ink-faint">Audience evidence</dt><dd>{offer.audience.size === null ? "Unknown" : `${offer.audience.size.toLocaleString()} ${offer.audience.unit} · ${offer.audience.basis}`}</dd></div><div><dt className="text-ink-faint">Delivery</dt><dd>{offer.delivery === "online" ? `Online${offer.market ? ` · ${offer.market}` : ""}` : offer.market} · {offer.startDate || "Start unconfirmed"} – {offer.endDate || "End unconfirmed"}</dd></div></dl>
            {!assessment.eligible && <p className="mt-4 text-sm text-rust">{assessment.reason}</p>}
            {offer.outcomes && <p className="mt-3 text-sm text-ink-soft">Actual results recorded · {offer.outcomes.source} · {offer.outcomes.checkedAt}</p>}
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn btn-secondary" disabled={busy || editing !== null} onClick={() => setEditing(offer)}>Edit offer / evidence</button><button type="button" className="btn btn-quiet" disabled={busy || editing !== null} onClick={() => { dispatch({ type: "removeOffer", id: offer.id }); toast("Offer removed", { action: { label: "Undo", onClick: () => dispatch({ type: "saveOffer", offer }) } }); }}>Remove</button></div>
          </article>;
        })}
      </section>
      <aside className="card grid gap-5 p-6 lg:sticky lg:top-28 lg:col-span-4" aria-label="Comparison options">
        <h2 className="text-lg font-semibold">Build the shortlist</h2>
        <p className="text-sm leading-relaxed text-ink-soft">The standard comparison uses sourced prices, current partner availability and checked extra costs. Missing audience data stays visible as uncertainty.</p>
        <label className="flex items-start gap-2 text-sm leading-relaxed"><input className="mt-1 accent-forest" type="checkbox" disabled={busy || editing !== null} checked={includeProvisional} onChange={e => setIncludeProvisional(e.target.checked)} />Include provisional offers: estimates, pending availability and stale evidence. This produces a conditional scenario.</label>
        <label className="flex items-start gap-2 text-sm leading-relaxed"><input className="mt-1 accent-forest" type="checkbox" disabled={busy || editing !== null} checked={enrich} onChange={e => setEnrich(e.target.checked)} />Add cultural evidence with Qloo when connected. Offers remain usable if it is unavailable.</label>
        <button type="button" className="btn btn-primary" disabled={busy || !state.offers.length || editing !== null} aria-busy={busy} onClick={() => void compare()}>{busy ? "Evaluating offers…" : includeProvisional ? "Compare conditional scenario" : "Compare my offers"}</button>
        <p className="text-sm leading-relaxed text-ink-faint">Evidence is recorded by you, never automatically certified. Work is saved in this browser; export a backup before moving devices or clearing browser storage. All amounts are whole USD.</p>
      </aside>
    </div>
  </Shell>;
}
