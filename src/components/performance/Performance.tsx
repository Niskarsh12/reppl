"use client";

import { OfferOutcomes } from "../offers/OfferOutcomes";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { possessive } from "@/lib/campaign/catalog";
import { followUpNote, recommend } from "@/lib/campaign/plan";
import type { LinkStats } from "@/lib/campaign/types";
import { STATS_DAYS } from "@/lib/links/utm";
import { useJourney } from "../journey/JourneyProvider";
import { useCampaign } from "../journey/useCampaign";
import { CopyButton } from "../ui/CopyButton";
import { PageHeader, Shell } from "../ui/PageHeader";
import { Notice } from "../ui/Status";
import { ClickChart } from "./ClickChart";

const POLL_MS = 15_000;

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ago(iso: string | null, now: number) {
  if (!iso) return "—";
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface StatsState {
  links: LinkStats[] | null;
  checkedAt: string | null;
  error: string | null;
  loading: boolean;
}

export function Performance() {
  const { state, navigate } = useJourney();
  const campaign = useCampaign();
  const [stats, setStats] = useState<StatsState>({ links: null, checkedAt: null, error: null, loading: true });

  const load = useCallback(async () => {
    setStats((s) => ({ ...s, loading: true }));
    try {
      const response = await fetch(`/api/links?campaign=${encodeURIComponent(state.campaignId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { links?: LinkStats[]; checkedAt?: string } | null;
      if (!response.ok || !payload?.links) throw new Error();
      setStats({ links: payload.links, checkedAt: payload.checkedAt ?? new Date().toISOString(), error: null, loading: false });
    } catch {
      setStats((s) => ({ ...s, loading: false, error: "Couldn't load click counts." }));
    }
  }, [state.campaignId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (!campaign) return null;
  const current = new Set(state.links.map((l) => l.code));
  const links = (stats.links ?? []).filter((l) => current.has(l.code));
  const total = links.reduce((s, l) => s + l.clicks, 0);
  const daily = Array.from({ length: STATS_DAYS }, (_, i) => links.reduce((s, l) => s + (l.daily[i] ?? 0), 0));
  const leader = [...links].sort((a, b) => b.clicks - a.clicks)[0];
  const now = stats.checkedAt ? new Date(stats.checkedAt).getTime() : 0;
  const recs = stats.links ? recommend(links, campaign.plan, campaign.setup.goals, now) : [];
  const firstCreated = links.map((l) => l.createdAt).sort()[0];

  const subline = !stats.links
    ? stats.error
      ? "Click counts couldn't be loaded."
      : "Checking your links…"
    : total === 0
      ? `No clicks yet across ${links.length} ${links.length === 1 ? "link" : "links"}. Counts update here within seconds of someone opening one.`
      : links.length === 1
        ? `${total} ${total === 1 ? "click" : "clicks"} on your link to ${leader.label}.`
        : `${total} ${total === 1 ? "click" : "clicks"} across ${links.length} links. ${possessive(leader.label)} link has the most, with ${leader.clicks}.`;

  return (
    <Shell wide>
      <PageHeader
        title="Performance"
        subline={subline}
        actions={
          <div className="flex items-center gap-3 text-sm text-ink-faint">
            {stats.checkedAt && <span aria-live="polite">Updated {timeOf(stats.checkedAt)}</span>}
            <button type="button" className="btn btn-secondary h-10 px-4 text-sm" onClick={load} disabled={stats.loading} aria-busy={stats.loading}>
              <RefreshCw className={`size-4 ${stats.loading ? "anim-breathe" : ""}`} strokeWidth={1.75} aria-hidden />
              Refresh
            </button>
          </div>
        }
      />

      {state.offers.length > 0 && <OfferOutcomes offers={state.offers} onEdit={() => navigate("offers")} />}

      {stats.error && (
        <div className="mb-5">
          <Notice tone="error">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {stats.error} {stats.checkedAt ? `Showing counts from ${timeOf(stats.checkedAt)}.` : "Check your connection."}
              </span>
              <button type="button" onClick={load} className="btn btn-secondary h-9 bg-paper px-4 text-sm">
                Try again
              </button>
            </span>
          </Notice>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="card p-6 lg:col-span-8" aria-labelledby="clicks-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="clicks-title" className="text-base font-semibold">
              Clicks
            </h2>
            <span className="text-sm text-ink-faint">Last {STATS_DAYS} days</span>
          </div>
          {stats.links ? (
            <p className="mt-3">
              <span className="num text-[2rem] font-semibold leading-none tracking-[-0.03em]">{total}</span>
              <span className="ml-2 text-sm text-ink-faint">
                {firstCreated ? `since links were created on ${new Date(firstCreated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
              </span>
            </p>
          ) : (
            <div className="skeleton mt-3 h-8 w-20" aria-hidden />
          )}
          <div className="mt-5">
            {stats.links ? <ClickChart daily={daily} endDate={new Date(now)} /> : <div className="skeleton h-[200px]" aria-hidden />}
          </div>
        </section>

        <section className="card p-6 lg:col-span-4" aria-labelledby="next-title">
          <h2 id="next-title" className="text-base font-semibold">
            Next steps
          </h2>
          {!stats.links ? (
            <div className="mt-4 grid gap-3" aria-hidden>
              <span className="skeleton block h-4 w-3/4" />
              <span className="skeleton block h-4 w-full" />
              <span className="skeleton block h-4 w-2/3" />
            </div>
          ) : recs.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Nothing needs your attention right now. Check back once partners have posted.
            </p>
          ) : (
            <ul className="mt-3 grid gap-6">
              {recs.map((r) => {
                const action = r.action;
                const match = action?.kind === "follow-up" ? campaign.matches.find((m) => m.opportunity.id === action.opportunityId) : undefined;
                return (
                  <li key={r.id}>
                    <p className="text-[0.9375rem] font-medium">{r.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{r.detail}</p>
                    {action?.kind === "go" && (
                      <button type="button" className="btn btn-secondary mt-3 h-9 px-4 text-sm" onClick={() => navigate(action.stage)}>
                        {action.stage === "links" ? "Open links and pitches" : "Open the plan"}
                      </button>
                    )}
                    {match && (
                      <div className="mt-3">
                        <CopyButton
                          text={followUpNote(campaign.profile, match.opportunity)}
                          label="Copy follow-up note"
                          copiedLabel="Note copied"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-x-auto p-6 lg:col-span-12" aria-labelledby="partners-title">
          <h2 id="partners-title" className="text-base font-semibold">
            By partner
          </h2>
          <table className="mt-3 w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-ink-faint">
                <th scope="col" className="py-2 text-left font-normal">
                  Partner
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Clicks
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Share
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Last click
                </th>
              </tr>
            </thead>
            <tbody>
              {(stats.links ? links : campaign.matches.map(() => null)).map((l, i) =>
                l ? (
                  <tr key={l.code} className="border-t border-line/70">
                    <th scope="row" className="py-3 text-left font-normal">
                      <span className="text-ink">{l.label}</span>
                      <span className="num ml-2 text-ink-faint">/r/{l.code}</span>
                    </th>
                    <td className="num py-3 text-right text-ink">{l.clicks}</td>
                    <td className="num py-3 text-right text-ink-soft">{total ? `${((l.clicks / total) * 100).toFixed(0)}%` : "—"}</td>
                    <td className="py-3 text-right text-ink-soft">{ago(l.lastClickAt, now)}</td>
                  </tr>
                ) : (
                  <tr key={i} className="border-t border-line/70" aria-hidden>
                    <td className="py-3" colSpan={4}>
                      <span className="skeleton block h-4 w-full" />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-ink-faint">
            A click is counted when a person opens a tracked link; link previews from chat apps and crawlers are ignored. Purchases
            happen on your site: filter your analytics by utm_campaign={campaign.plan.slug}.
          </p>
        </section>
      </div>
    </Shell>
  );
}
