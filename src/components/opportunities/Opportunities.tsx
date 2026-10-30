"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { optimizePortfolio, ineligibleReason, opportunityCost } from "@/lib/campaign/optimizer";
import { PortfolioBrief } from "./PortfolioBrief";
import { OfferComparison } from "../offers/OfferComparison";
import { money } from "@/lib/campaign/catalog";
import { KINDS, KIND_LABEL } from "@/lib/discovery/kinds";
import type { DiscoveryRequest, Match, OpportunityKind } from "@/lib/discovery/types";
import { EASE_DRAWER } from "@/lib/motion";
import { useJourney } from "../journey/JourneyProvider";
import { MAX_SELECTED, discoveryKey } from "../journey/state";
import { DemoBadge, QlooBadge } from "../ui/DemoBadge";
import { PageHeader, Shell } from "../ui/PageHeader";
import { Notice } from "../ui/Status";
import { IdeaCard, IdeaSkeleton } from "./IdeaCard";
import { MatchRow, SkeletonRow } from "./MatchRow";
import { AgentPanel, AudiencePanel, ContrastPanel } from "./Panels";
import { useDiscoveryStream } from "./useDiscoveryStream";

type Filter = "all" | OpportunityKind;

function Results({ request, streamKey }: { request: DiscoveryRequest; streamKey: string }) {
  const { state, dispatch, navigate } = useJourney();
  const cached = state.discovery?.key === streamKey ? state.discovery.result : null;
  const { view: streamedView, retry } = useDiscoveryStream(request, streamKey, cached);
  const view = cached && streamedView.status === "complete" ? { ...streamedView, matches: cached.matches, result: cached } : streamedView;
  const [filter, setFilter] = useState<Filter>("all");
  const [streamed] = useState(() => cached === null);

  const save = useEffectEvent(() => {
    if (view.result && state.discovery?.key !== streamKey) dispatch({ type: "discovered", key: streamKey, result: view.result });
  });
  useEffect(() => {
    if (view.status === "complete") save();
  }, [view.status]);

  const byKind = useMemo(() => {
    const groups = new Map<OpportunityKind, Match[]>();
    for (const m of view.matches) groups.set(m.opportunity.kind, [...(groups.get(m.opportunity.kind) ?? []), m]);
    return groups;
  }, [view.matches]);
  const kinds = KINDS.filter((k) => byKind.has(k));
  const byId = useMemo(() => new Map(view.matches.map((m) => [m.opportunity.id, m])), [view.matches]);

  const selected = view.matches.filter((m) => state.selected.includes(m.opportunity.id));
  const feeMin = selected.reduce((s, m) => s + m.opportunity.rate.min, 0);
  const feeMax = selected.reduce((s, m) => s + m.opportunity.rate.max, 0);
  const full = state.selected.length >= MAX_SELECTED;
  const portfolio = useMemo(() => view.result ? optimizePortfolio(view.result.matches, request) : null, [view.result, request]);
  const running = view.status === "running";
  const ready = view.status === "complete" && state.discovery?.key === streamKey;
  const budget = request.setup.budget;
  const qloo = view.source?.isDemo === false;
  const brand = request.brand.name;

  const subline =
    view.status === "complete"
      ? view.matches.length > 0
        ? `${view.matches.length} opportunities evaluated for ${brand}. A budget-feasible portfolio is selected; review the evidence or adjust your partners.`
        : `No close matches for ${brand} yet.`
      : view.status === "error"
        ? "The search stopped before it finished."
        : `Building a campaign for ${brand}. You can start picking as results arrive.`;

  const row = (m: Match) => {
    const checked = state.selected.includes(m.opportunity.id);
    return (
      <MatchRow
        key={m.opportunity.id}
        match={{ ...m, withinBudget: opportunityCost(m) !== null && opportunityCost(m)! <= budget }}
        checked={checked}
        locked={!checked && (full || !!ineligibleReason(m, request.setup) || (opportunityCost(m) ?? Infinity) > request.setup.budget - feeMax)}
        animate={streamed}
        markSamples={qloo}
        onToggle={() => dispatch({ type: "toggle", id: m.opportunity.id })}
      />
    );
  };

  return (
    <Shell wide>
      <PageHeader actions={<button className="btn btn-secondary" type="button" onClick={() => navigate("offers")}>Back to your offers</button>} title="Explore cultural leads" subline={subline} aside={view.source && (qloo ? <QlooBadge /> : <DemoBadge />)} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-12 lg:gap-10">
        <aside className="grid content-start gap-4 lg:sticky lg:top-28 lg:col-span-4 lg:self-start" aria-label="Search progress">
          <div aria-live="polite">
            <AgentPanel view={view} brand={brand} budget={budget} location={request.setup.location} />
          </div>
          {view.audience && <AudiencePanel audience={view.audience} brand={brand} animate={streamed} />}
        </aside>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-12 lg:col-span-8">
          {view.status === "error" && (
            <Notice tone="error">
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {view.error} {view.matches.length > 0 && "Results found so far are still below."}
                </span>
                <button type="button" onClick={retry} className="btn btn-secondary h-9 bg-paper px-4 text-sm">
                  Try again
                </button>
              </span>
            </Notice>
          )}

          {portfolio && <PortfolioBrief portfolio={portfolio} matches={view.matches} selectedIds={state.selected} onApply={() => dispatch({ type: "optimize" })} onCost={(id, amount) => dispatch({ type: "planningCost", id, amount })} />}

          {(view.contrast || view.ideas.length > 0 || running) && (
            <section aria-labelledby="ideas-title" className="grid gap-4">
              {view.contrast && <ContrastPanel contrast={view.contrast} brand={brand} />}
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="ideas-title" className="text-lg font-semibold tracking-[-0.015em]">
                  Campaign ideas
                </h2>
                <p className="text-sm text-ink-faint">Each one is built on partners listed below</p>
              </div>
              <div className="grid gap-3" aria-busy={running}>
                {view.ideas.map((idea, i) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    index={i}
                    anchors={idea.anchors.map((id) => byId.get(id)).filter((m): m is Match => !!m)}
                    budget={budget}
                    active={state.idea === idea.id}
                    animate={streamed}
                    onUse={() =>
                      state.idea === idea.id ? dispatch({ type: "dropIdea" }) : dispatch({ type: "useIdea", id: idea.id, anchors: idea.anchors })
                    }
                  />
                ))}
                {running && view.ideas.length === 0 && (
                  <>
                    <IdeaSkeleton />
                    <IdeaSkeleton />
                  </>
                )}
              </div>
            </section>
          )}

          <section aria-labelledby="results-title">
            <h2 id="results-title" className="mb-3 text-lg font-semibold tracking-[-0.015em]">
              Recommended partners
            </h2>
            {kinds.length > 1 && (
              <div
                role="tablist"
                aria-label="Filter partners"
                className="-mx-5 mb-5 flex gap-6 overflow-x-auto border-b border-line px-5 [scrollbar-width:none] sm:mx-0 sm:px-0"
              >
                {(["all", ...kinds] as Filter[]).map((f) => (
                  <button
                    key={f}
                    role="tab"
                    type="button"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={`relative -mb-px flex h-11 shrink-0 items-center gap-1.5 border-b-2 text-[0.9375rem] transition-colors duration-200 ${
                      filter === f ? "border-forest text-ink" : "border-transparent text-ink-soft hover:text-ink"
                    }`}
                  >
                    {f === "all" ? "All" : KIND_LABEL[f].many}
                    <span className="num text-ink-faint">{f === "all" ? view.matches.length : byKind.get(f)?.length}</span>
                  </button>
                ))}
              </div>
            )}

            {view.status === "complete" && view.matches.length === 0 ? (
              <div className="card grid place-items-start gap-4 p-8">
                <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                  Nothing shares these interests closely enough. Adding a broader interest usually helps.
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => navigate("brand")}>
                  Edit audience interests
                </button>
              </div>
            ) : filter === "all" || !byKind.has(filter) ? (
              <div className="grid gap-8" aria-busy={running}>
                {kinds.map((k) => (
                  <div key={k}>
                    {kinds.length > 1 && (
                      <h3 className="mb-3 text-sm font-medium text-ink-soft">
                        {KIND_LABEL[k].many} <span className="num font-normal text-ink-faint">{byKind.get(k)!.length}</span>
                      </h3>
                    )}
                    <ul className="grid gap-3">{byKind.get(k)!.map(row)}</ul>
                  </div>
                ))}
                {running && (
                  <ul className="grid gap-3">
                    <SkeletonRow />
                    {view.matches.length === 0 && <SkeletonRow />}
                  </ul>
                )}
              </div>
            ) : (
              <ul className="grid gap-3">{byKind.get(filter)!.map(row)}</ul>
            )}
          </section>
        </div>
      </div>

      <AnimatePresence>
        {view.matches.length > 0 && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-6 sm:pb-5"
            initial={{ transform: "translateY(110%)" }}
            animate={{ transform: "translateY(0%)" }}
            exit={{ transform: "translateY(110%)" }}
            transition={{ duration: 0.4, ease: EASE_DRAWER }}
          >
            <div className="mx-auto flex max-w-[1240px] flex-col gap-3 rounded-[1.25rem] bg-ink px-5 py-4 text-ivory shadow-[0_12px_32px_rgb(16_33_26/0.25)] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <p className="text-[0.9375rem]" aria-live="polite">
                <span className="num font-medium">
                  {state.selected.length} of {MAX_SELECTED}
                </span>{" "}
                selected
                {selected.length > 0 && (
                  <span className="text-ivory/70">
                    {" · "}fees <span className="num text-ivory">{money(feeMin)}–{money(feeMax)}</span>
                    {feeMax > budget ? <span className="text-lavender"> (more than your {money(budget)} budget)</span> : null}
                  </span>
                )}
                {selected.length === 0 && <span className="text-ivory/70"> · use an idea or pick a partner</span>}
              </p>
              <button
                type="button"
                aria-disabled={selected.length === 0 || feeMax > budget || !ready}
                onClick={() => {
                  if (selected.length === 0 || feeMax > budget || !ready) return;
                  navigate("plan");
                }}
                className="btn btn-lg h-12 bg-lavender text-forest-deep transition-[opacity,transform] aria-disabled:opacity-50"
              >
                {ready ? "Write pitches" : "Finishing search…"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function DiscoveryOpportunities() {
  const { state } = useJourney();
  const profile = state.profile!;
  const setup = state.setup!;
  const key = discoveryKey(profile, setup);
  const request = useMemo<DiscoveryRequest>(
    () => ({ brand: { name: profile.name, domain: profile.domain, category: profile.category, signals: profile.signals, audience: profile.audience, summary: profile.summary }, setup }),
    [profile.name, profile.domain, profile.category, profile.signals, profile.audience, profile.summary, setup],
  );
  return <Results key={key} request={request} streamKey={key} />;
}

export function Opportunities() {
  const { state } = useJourney();
  return state.offerMode === "offers" ? <OfferComparison /> : <DiscoveryOpportunities />;
}
