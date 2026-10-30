"use client";

import { OfferEvidence } from "../offers/OfferEvidence";
import { money } from "@/lib/campaign/catalog";
import type { PortfolioResult } from "@/lib/campaign/optimizer";
import type { Match } from "@/lib/discovery/types";

export function PortfolioBrief({ portfolio, matches, onApply, selectedIds, onCost, onConfirmCulture }: {
  portfolio: PortfolioResult; matches: Match[]; onApply?: () => void; selectedIds?: string[]; onCost?: (id: string, amount: number) => void; onConfirmCulture?: (id: string) => void;
}) {
  const name = (id: string) => matches.find(m => m.opportunity.id === id)?.opportunity.name ?? id;
  const { recommended: best, baseline } = portfolio;
  const differs = selectedIds && [...selectedIds].sort().join() !== [...best.ids].sort().join();
  return (
    <section className="card grid gap-4 p-6 sm:p-7" aria-label="Sponsorship decision brief">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-[-0.015em]">Recommended sponsorship portfolio</h2>
        {onApply && <button type="button" className="btn btn-secondary" onClick={onApply}>Use recommended portfolio</button>}
      </div>
      <p className="break-words text-sm leading-relaxed text-ink-soft">{best.ids.length ? best.ids.map(name).join(" · ") : "No portfolio was recommended under the current constraints and evidence. Review the alternatives and outstanding evidence."}</p>
      <p className="num text-sm">Estimated commitment {money(best.totalCost)} · Remaining budget {money(best.remaining)}</p>
      {differs && <p className="text-sm text-ink-soft">Your manual selection differs from the recommendation. Pitches use your feasible selection; the comparison below describes the recommendation.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left text-ink-soft">Same candidates, budget, costs, eligibility and six-partner limit</caption>
          <thead><tr className="border-b border-line"><th className="py-2 pr-3">Portfolio</th><th className="pr-3">Cost</th><th className="pr-3">Cultural segments</th><th>Decision score</th></tr></thead>
          <tbody>{[["Recommended", best], ["Individual ranking", baseline]].map(([label, value]) => {
            const p = value as typeof best;
            return <tr key={label as string} className="border-b border-line/70"><th className="py-2 pr-3 font-normal">{label as string}</th><td className="pr-3">{money(p.totalCost)}</td><td className="pr-3">{p.segments.length}</td><td>{p.score}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <p className="text-sm text-ink-soft">Baseline partners: {baseline.ids.map(name).join(", ") || "None"}. Cultural coverage: {best.segments.join(", ") || "No supported segments"}.</p>
      <p className="text-sm text-ink-soft">{portfolio.method}</p>
      {portfolio.redundancies.map(r => <p key={r.ids.join()} className="text-sm text-ink-soft">Potential redundancy: {r.ids.map(name).join(" / ")} share {r.segments.join(", ")}. This is a cultural proxy; audience overlap is unknown.</p>)}
      <ul className="grid gap-2 break-words text-sm leading-relaxed text-ink-soft">{portfolio.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
      <details className="border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-medium">Selection rationale, alternatives and evidence ({portfolio.decisions.length})</summary>
        <div className="mt-4 grid gap-4">
          {portfolio.decisions.map(d => {
            const o = matches.find(m => m.opportunity.id === d.id)?.opportunity;
            return <article key={d.id} className="border-b border-line/70 pb-4 text-sm leading-relaxed">
              <h3 className="break-words font-semibold">{name(d.id)} · {d.selected ? "Selected" : "Not selected"} · {o?.source === "sample" ? "Illustrative" : o?.source === "offer" ? "User-recorded offer" : "Qloo entity"}</h3>
              <p className="mt-1 text-ink-soft">{d.reason}</p>
              <p className="mt-1 text-ink-faint">{d.unknowns.join(" ")} Cost source: {o?.costEvidence?.source ?? "Catalogue range; confirm provenance and obtain a quote"}.</p>
              {onCost && o?.source === "qloo" && <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={e => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                onCost(d.id, Number(data.get("amount")));
              }}>
                <label className="grid gap-1">Planning cost (USD; your assumption, not a verified quote)
                  <input className="input" name="amount" type="number" min="1" max="100000000" step="1" required defaultValue={o.costEvidence?.status === "unknown" ? "" : o.rate.max} />
                </label>
                <button className="btn btn-secondary" type="submit">Save planning cost</button>
              </form>}
              {o?.commercial && <OfferEvidence offer={o.commercial.offer} warnings={o.commercial.warnings} />}
              {o?.source === "offer" && o.culturalEvidence && !o.culturalEvidence.identityConfirmed && <p className="mt-2 text-sm text-ink-soft">Qloo identity is unconfirmed; these tags and affinity do not affect the score. {onConfirmCulture && <button type="button" className="font-medium text-forest underline underline-offset-2" onClick={() => onConfirmCulture(d.id)}>Confirm this entity matches the partner</button>}</p>}
              {o?.culturalEvidence && <p className="mt-1 break-words text-ink-faint">Qloo evidence: {o.culturalEvidence.entityId} · {o.culturalEvidence.entityType} · raw affinity {o.culturalEvidence.affinity ?? "unavailable"}. Tags: {o.culturalEvidence.tags.map(t => `${t.name} (${t.id})`).join(", ") || "unavailable"}.</p>}
            </article>;
          })}
        </div>
      </details>
    </section>
  );
}
