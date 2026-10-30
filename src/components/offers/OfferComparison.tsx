"use client";
import { money } from "@/lib/campaign/catalog";
import { opportunityCost } from "@/lib/campaign/optimizer";
import { useJourney } from "../journey/JourneyProvider";
import { PortfolioBrief } from "../opportunities/PortfolioBrief";
import { PageHeader, Shell } from "../ui/PageHeader";
import { Notice } from "../ui/Status";
import { useCampaign } from "../journey/useCampaign";

export function OfferComparison() {
  const { state, dispatch, navigate } = useJourney();
  const campaign = useCampaign();
  if (!campaign || state.discovery?.result.scope !== "offers") return <Shell><PageHeader title="Compare your offers" subline="Add or update your offers, then run a comparison." actions={<button type="button" className="btn btn-primary" onClick={() => navigate("offers")}>Go to offers</button>} /></Shell>;
  const result = state.discovery.result;
  const total = campaign.matches.reduce((s,m) => s + (opportunityCost(m) ?? 0), 0);
  const conditional = result.source.id === "offers-conditional";
  return <Shell wide>
    <PageHeader title={conditional ? "Conditional offer scenario" : "Compare your offers"} subline="A portfolio built from your recorded packages, costs and evidence. Review the assumptions before approaching partners." actions={<button type="button" className="btn btn-secondary" onClick={() => navigate("offers")}>Edit offers / recheck evidence</button>} />
    {conditional && <div className="mb-6"><Notice tone="warning">This scenario may include unconfirmed availability, estimates or stale evidence. It is a planning exercise; confirm the flagged facts before committing.</Notice></div>}
    <p className="mb-4 text-sm text-ink-soft">Commercial evidence rechecked as of {campaign.asOf}. <button type="button" className="font-medium text-forest underline underline-offset-2" onClick={() => navigate("offers")}>Review evidence and record actual results</button></p>
    <details className="mb-6 text-sm leading-relaxed text-ink-soft"><summary className="cursor-pointer font-medium">Evidence policy and evaluation notes</summary><div className="mt-3 grid gap-2">{result.notes.map(note => <p key={note}>{note}</p>)}</div></details>
    <PortfolioBrief portfolio={campaign.portfolio} matches={campaign.allMatches} selectedIds={state.selected} onApply={() => dispatch({ type: "optimize" })} onConfirmCulture={id => dispatch({ type: "confirmOfferEntity", id })} />
    <section className="mt-8 grid gap-4" aria-label="Choose from your offers">
      <h2 className="text-lg font-semibold">Adjust your shortlist</h2>
      {campaign.allMatches.map(m => {
        const selected = state.selected.includes(m.opportunity.id);
        const cost = opportunityCost(m);
        const blocked = !!m.opportunity.eligibility?.reason || m.opportunity.eligibility?.available === false;
        const disabled = !selected && (blocked || cost === null || cost > campaign.setup.budget - total || state.selected.length >= 6);
        return <label key={m.opportunity.id} className={`card flex items-start gap-4 p-5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <input type="checkbox" className="mt-1 accent-forest" checked={selected} disabled={disabled} onChange={() => dispatch({ type: "toggle", id: m.opportunity.id })} />
          <span className="grid min-w-0 flex-1 gap-2"><span className="break-words font-semibold">{m.opportunity.name} · {m.opportunity.detail}</span><span className="text-sm text-ink-soft">{m.opportunity.formats.join(" · ")}</span><span className="text-sm text-ink-faint">{m.opportunity.eligibility?.reason ?? (cost !== null && cost > campaign.setup.budget ? "Total cost exceeds the campaign budget." : m.opportunity.commercial?.provisional ? "Provisional evidence; confirmation required." : "Current user-recorded commercial evidence.")}</span></span><span className="num shrink-0 text-sm">{cost === null ? "Cost unknown" : money(cost)}</span>
        </label>;
      })}
    </section>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"><p className="num text-sm">{campaign.matches.length} selected · {money(total)} committed · {money(campaign.setup.budget - total)} left</p><button type="button" className="btn btn-primary" disabled={!campaign.matches.length} onClick={() => navigate("plan")}>Build decision brief and pitches</button></div>
  </Shell>;
}
