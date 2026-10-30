"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { withLink } from "@/lib/campaign/plan";
import type { TrackedLink } from "@/lib/campaign/types";
import { KIND_LABEL } from "@/lib/discovery/kinds";
import { shortLink } from "@/lib/links/utm";
import { useJourney } from "../journey/JourneyProvider";
import { useCampaign, type Campaign } from "../journey/useCampaign";
import { CopyButton } from "../ui/CopyButton";
import { PageHeader, Shell } from "../ui/PageHeader";
import { Notice, StatusLine } from "../ui/Status";

function utmSummary(destination: string) {
  try {
    const url = new URL(destination);
    return ["utm_source", "utm_medium", "utm_campaign"].map((k) => `${k}=${url.searchParams.get(k)}`).join(" · ");
  } catch {
    return destination;
  }
}

async function createLinks(campaignId: string, campaign: Campaign, signal: AbortSignal): Promise<TrackedLink[]> {
  const response = await fetch("/api/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      campaignId,
      campaignName: campaign.plan.name,
      destination: campaign.setup.url,
      items: campaign.matches.map((m) => ({ opportunityId: m.opportunity.id, label: m.opportunity.name, kind: m.opportunity.kind })),
    }),
  });
  const payload = (await response.json().catch(() => null)) as { links?: TrackedLink[]; error?: string } | null;
  if (!response.ok || !payload?.links) throw new Error(payload?.error ?? "The links couldn't be created.");
  return payload.links.map(({ code, opportunityId, label, destination, createdAt }) => ({ code, opportunityId, label, destination, createdAt }));
}

export function Links() {
  const { state, dispatch, navigate } = useJourney();
  const campaign = useCampaign();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const missing = campaign?.matches.filter((m) => !state.links.some((l) => l.opportunityId === m.opportunity.id)) ?? [];
  const missingKey = missing.map((m) => m.opportunity.id).join(",");
  const status = !missingKey ? "ready" : error ? "error" : "creating";

  useEffect(() => {
    if (!missingKey || !campaign) return;
    const controller = new AbortController();
    createLinks(state.campaignId, campaign, controller.signal)
      .then((links) => dispatch({ type: "linksCreated", links }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The links couldn't be created.");
      });
    return () => controller.abort();
    // Only re-run when the set of opportunities without a link changes, or on retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, attempt]);

  if (!campaign) return null;
  const rows = campaign.matches.map((m) => ({ match: m, link: state.links.find((l) => l.opportunityId === m.opportunity.id) }));

  return (
    <Shell>
      <PageHeader
        title="Tracked links"
        subline={`Each link sends people to ${campaign.profile.domain} with UTM tags and counts every click. Paste the pitch, link included, into your email or DMs.`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={status !== "ready"}
            onClick={() => status === "ready" && navigate("performance")}
          >
            View performance
          </button>
        }
      />

      <div aria-live="polite" className="mb-5">
        {status === "creating" && (
          <StatusLine tone="working">
            Creating {missing.length} tracked {missing.length === 1 ? "link" : "links"}…
          </StatusLine>
        )}
        {status === "error" && (
          <Notice tone="error">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>{error} Your pitches and plan are safe.</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAttempt((a) => a + 1);
                }}
                className="btn btn-secondary h-9 bg-paper px-4 text-sm"
              >
                Try again
              </button>
            </span>
          </Notice>
        )}
      </div>

      <ul className="grid gap-3">
        {rows.map(({ match, link }) => {
          const url = link ? shortLink(link.code) : null;
          const pitch = campaign.pitches[match.opportunity.id];
          return (
            <li key={match.opportunity.id} className="card min-w-0 p-5 sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="text-base font-semibold tracking-[-0.01em]">{match.opportunity.name}</span>
                    <span className="pill pill-neutral">{KIND_LABEL[match.opportunity.kind].one}</span>
                  </p>
                  {url ? (
                    <>
                      <p className="num mt-1.5 truncate text-[0.9375rem] text-forest">{url.replace(/^https?:\/\//, "")}</p>
                      <p className="mt-1 truncate text-sm text-ink-faint" title={link!.destination}>
                        {utmSummary(link!.destination)}
                      </p>
                    </>
                  ) : (
                    <div className="mt-2 grid gap-2" aria-hidden>
                      <span className="skeleton block h-4 w-56" />
                      <span className="skeleton block h-4 w-72 max-w-full" />
                    </div>
                  )}
                </div>
                {url && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <CopyButton text={url} label="Copy link" variant="quiet" />
                    <CopyButton text={`Subject: ${pitch.subject}\n\n${withLink(pitch.body, url)}`} label="Copy pitch" copiedLabel="Pitch copied" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener"
                      className="btn btn-quiet text-sm"
                      title="Opens the link in a new tab. This counts as a click."
                    >
                      <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />
                      Test
                      <span className="sr-only">(opens in a new tab and counts as a click)</span>
                    </a>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-ink-faint">
        Testing a link counts as a click. Previews generated by Slack, WhatsApp and similar apps don&rsquo;t. Nothing is sent to
        partners from here: you stay in control of every message.
      </p>
    </Shell>
  );
}
