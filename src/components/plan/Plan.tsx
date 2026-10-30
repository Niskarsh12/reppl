"use client";

import { PortfolioBrief } from "../opportunities/PortfolioBrief";
import { useState } from "react";
import { toast } from "sonner";
import { categoryLabel, money } from "@/lib/campaign/catalog";
import { LINK_TOKEN, withLink } from "@/lib/campaign/plan";
import { shortLink } from "@/lib/links/utm";
import { Field } from "../form/Field";
import { useJourney } from "../journey/JourneyProvider";
import { MAX_SELECTED } from "../journey/state";
import { useCampaign, type Campaign } from "../journey/useCampaign";
import { CopyButton } from "../ui/CopyButton";
import { DemoBadge } from "../ui/DemoBadge";
import { PageHeader, Shell } from "../ui/PageHeader";
import { Notice } from "../ui/Status";

function PitchCard({ campaign, id, index }: { campaign: Campaign; id: string; index: number }) {
  const { state, dispatch } = useJourney();
  const match = campaign.matches[index];
  const line = campaign.plan.lines[index];
  const pitch = campaign.pitches[id];
  const edited = id in state.pitches;
  const link = state.links.find((l) => l.opportunityId === id);
  const shortUrl = link ? shortLink(link.code) : undefined;
  const edit = (patch: Partial<typeof pitch>) => dispatch({ type: "editPitch", id, pitch: { ...pitch, ...patch } });

  return (
    <article className="card p-5 sm:p-6" aria-labelledby={`pitch-${id}-title`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`pitch-${id}-title`} className="text-base font-semibold tracking-[-0.01em]">
          To {match.opportunity.name}
        </h3>
        <p className="num text-sm text-ink-soft">
          {line.format} · <span className="text-ink">{money(line.amount)}</span>
        </p>
      </header>
      <p className="mt-0.5 text-sm text-ink-faint">{match.opportunity.detail}</p>

      <div className="mt-5 grid gap-5">
        <Field id={`pitch-${id}-subject`} label="Subject">
          <input id={`pitch-${id}-subject`} className="input" value={pitch.subject} onChange={(e) => edit({ subject: e.target.value })} />
        </Field>
        <Field id={`pitch-${id}-body`} label="Message">
          <textarea
            id={`pitch-${id}-body`}
            className="input min-h-[16rem] text-[0.9375rem] [field-sizing:content]"
            value={pitch.body}
            onChange={(e) => edit({ body: e.target.value })}
          />
        </Field>
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint">
          {shortUrl ? "Includes their tracked link." : <>&ldquo;{LINK_TOKEN}&rdquo; becomes their own link in the next step.</>}
        </p>
        <div className="flex flex-wrap gap-2">
          {edited && (
            <button
              type="button"
              className="btn btn-quiet text-sm"
              onClick={() => {
                const previous = pitch;
                dispatch({ type: "resetPitch", id });
                toast("Draft restored", { action: { label: "Undo", onClick: () => dispatch({ type: "editPitch", id, pitch: previous }) } });
              }}
            >
              Restore draft
            </button>
          )}
          <CopyButton text={`Subject: ${pitch.subject}\n\n${withLink(pitch.body, shortUrl)}`} label="Copy pitch" />
        </div>
      </footer>
    </article>
  );
}

function PlanSummary({ campaign }: { campaign: Campaign }) {
  const { state, navigate } = useJourney();
  const { plan } = campaign;
  const sum = plan.lines.reduce((s, l) => s + l.amount, 0) + plan.reserve + plan.unallocated;
  return (
    <div className="grid gap-4 lg:sticky lg:top-28">
      <section className="card p-6" aria-labelledby="budget-title">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="budget-title" className="text-base font-semibold">
            Suggested budget
          </h2>
          <span className="num text-sm text-ink-faint">{money(plan.total)}</span>
        </div>
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Suggested split of your budget</caption>
          <tbody>
            {plan.lines.map((l) => (
              <tr key={l.id} className="border-b border-line/70">
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  <span className="block text-ink">{l.name}</span>
                  <span className="block text-ink-faint">{l.format}</span>
                </th>
                <td className="num py-2.5 text-right align-top">{money(l.amount)}</td>
              </tr>
            ))}
            <tr className="border-b border-line/70">
              <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                <span className="block text-ink">Reserve</span>
                <span className="block text-ink-faint">{state.discovery?.result.scope === "offers" ? "Contingency or future activity" : "Product, shipping, a second post"}</span>
              </th>
              <td className="num py-2.5 text-right align-top">{money(plan.reserve)}</td>
            </tr>
            {plan.unallocated > 0 && (
              <tr className="border-b border-line/70">
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  <span className="block text-ink">Not yet allocated</span>
                  <span className="block text-ink-faint">{state.discovery?.result.scope === "offers" ? "Budget remaining after these packages" : "More than these partners usually charge"}</span>
                </th>
                <td className="num py-2.5 text-right align-top">{money(plan.unallocated)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="pt-3 text-left font-semibold">
                Total
              </th>
              <td className="num pt-3 text-right font-semibold">{money(sum)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          {state.discovery?.result.scope === "offers" ? "The budget uses recorded package prices plus declared extra costs. Sources, checked dates and availability are recorded by you; confirm final terms before booking." : "The budget reserves upper cost estimates. Catalogue fees and audiences are illustrative; Qloo entities need quotes. Confirm terms before committing."}
        </p>
        {plan.floor > plan.total && (
          <div className="mt-4">
            <Notice tone="warning">
              These partners&rsquo; lowest typical fees add up to <span className="num">{money(plan.floor)}</span>, more than your{" "}
              <span className="num">{money(plan.total)}</span> budget. Pitch fewer partners, or offer product instead of a fee.
            </Notice>
          </div>
        )}
        {plan.unallocated > 0 && (
          <div className="mt-4">
            <Notice>
              The chosen portfolio leaves <span className="num">{money(plan.unallocated)}</span> unallocated.{" "}
              {campaign.matches.length < MAX_SELECTED ? (
                <>
                  <button type="button" className="font-medium text-forest underline underline-offset-2" onClick={() => navigate(state.discovery?.result.scope === "offers" ? "offers" : "opportunities")}>
                    Add partners
                  </button>{" "}
                  or keep it for a second round.
                </>
              ) : (
                "Keep it for a second round with whoever performs best."
              )}
            </Notice>
          </div>
        )}
      </section>

      <section className="card p-6" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="text-base font-semibold">
          Timeline
        </h2>
        <dl className="mt-3 grid text-sm">
          {plan.timeline.map((t, i) => (
            <div key={`${t.when}-${i}`} className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-line/70 py-2.5 last:border-0">
              <dt className="text-ink-faint">{t.when}</dt>
              <dd>{t.what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card p-6" aria-labelledby="measure-title">
        <h2 id="measure-title" className="text-base font-semibold">
          How you&rsquo;ll know it worked
        </h2>
        <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-ink-soft">
          {plan.measures.map((m) => (
            <li key={m} className="flex gap-2.5">
              <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-forest" aria-hidden />
              {m}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Plan() {
  const { state, navigate } = useJourney();
  const campaign = useCampaign();
  const [exporting, setExporting] = useState(false);
  if (!campaign) return null;

  const download = async () => {
    setExporting(true);
    // Let the button's busy state paint; rendering the PDF blocks the main thread.
    await new Promise((resolve) => setTimeout(resolve, 220));
    try {
      const { exportPlanPdf } = await import("./exportPlanPdf");
      await exportPlanPdf(campaign, state.links, window.location.origin);
      toast("Plan downloaded");
    } catch (error) {
      console.error(error);
      toast("The PDF couldn't be created. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Shell wide>
      <PageHeader
        title="Pitches and plan"
        aside={campaign.isDemo && <DemoBadge />}
        subline={
          <>
            {campaign.plan.objective} Drafts are written for {campaign.profile.name} as a {categoryLabel(campaign.profile.category).toLowerCase()} brand;
            edit anything before you send.
          </>
        }
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={download} disabled={exporting} aria-busy={exporting}>
              {exporting ? "Preparing PDF…" : "Download plan"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate("links")}>
              Create tracked links
            </button>
          </>
        }
      />

      {state.discovery?.result.source.id === "offers-conditional" && <div className="mb-6"><Notice tone="warning">Conditional scenario: selected offers may still need availability confirmation, refreshed evidence or final pricing. Review each offer before booking.</Notice></div>}
      <div className="mb-8"><PortfolioBrief portfolio={campaign.portfolio} matches={campaign.allMatches} selectedIds={state.selected} /></div>

      {campaign.plan.idea && (
        <section className="card mb-8 bg-lavender-soft/45 p-6 sm:p-7" aria-labelledby="idea-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <p className="text-sm font-medium text-lavender-deep">Campaign idea · {campaign.plan.idea.format}</p>
            <button type="button" className="text-sm font-medium text-forest underline underline-offset-2" onClick={() => navigate(state.discovery?.result.scope === "offers" ? "offers" : "opportunities")}>
              Change idea
            </button>
          </div>
          <h2 id="idea-title" className="mt-2 font-serif text-[1.875rem] leading-[1.05] tracking-[-0.015em] sm:text-[2.25rem]">
            {campaign.plan.idea.title}
          </h2>
          <p className="mt-3 max-w-[68ch] text-[0.9375rem] leading-relaxed text-ink-soft">{campaign.plan.idea.pitch}</p>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <section className="grid min-w-0 content-start gap-4 lg:col-span-7" aria-label="Pitches">
          {campaign.matches.map((m, i) => (
            <PitchCard key={m.opportunity.id} campaign={campaign} id={m.opportunity.id} index={i} />
          ))}
        </section>
        <aside className="lg:col-span-5" aria-label="Campaign plan">
          <PlanSummary campaign={campaign} />
        </aside>
      </div>
    </Shell>
  );
}
