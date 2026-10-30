"use client";

import { useRef, useState, type FormEvent } from "react";
import { domainOf } from "@/lib/campaign/infer";
import { normalizeUrl, urlError } from "@/lib/campaign/validate";
import { recordStage, useJourney } from "../journey/JourneyProvider";
import { Logo } from "../ui/Logo";

const ITINERARY: { heading: string; rows: [string, string][] }[] = [
  {
    heading: "First minute",
    rows: [
      ["Paste your product page", "You"],
      ["Budget, goals and city", "You"],
      ["Read your page", "Agent"],
    ],
  },
  {
    heading: "Next few minutes",
    rows: [
      ["Check what it understood", "You"],
      ["Map your audience's taste", "Qloo"],
      ["Find artists, creators and places", "Qloo"],
      ["Turn them into campaign ideas", "Agent"],
      ["Pick an idea or partners", "You"],
      ["Draft pitches and a plan", "Agent"],
    ],
  },
  {
    heading: "After you send",
    rows: [
      ["A tracked link per partner", "Agent"],
      ["Clicks and next steps", "Agent"],
    ],
  },
];

function Row({ what, who }: { what: string; who: string }) {
  return (
    <li className="flex items-baseline gap-3 py-1.5 text-base">
      <span>{what}</span>
      <span className="mb-[0.3em] min-w-6 flex-1 self-end border-b-[3px] border-dotted border-line-strong" aria-hidden />
      <span className="num text-ink-soft">{who}</span>
    </li>
  );
}

export function Landing() {
  const { state, dispatch, navigate } = useJourney();
  const [url, setUrl] = useState(state.draft.url ? domainOf(state.draft.url) : "");
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const resumable = state.setup !== null && state.campaignId !== "";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const problem = urlError(url);
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    recordStage("setup");
    dispatch({
      type: "start",
      url: normalizeUrl(url)!,
      campaignId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
    });
  };

  const focusStart = () => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    inputRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <section className="mx-auto flex max-w-[1440px] flex-col px-5 pb-14 pt-5 sm:px-8 lg:min-h-[100svh] lg:px-10 lg:pb-10">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <nav aria-label="Page" className="flex items-center gap-1 text-[0.9375rem] text-ink-soft">
            <a href="#how" className="btn btn-quiet">
              How it works
            </a>
            <a href="#real" className="btn btn-quiet max-sm:hidden">
              What&rsquo;s real
            </a>
          </nav>
        </div>

        <h1 className="type-display mt-[9svh] lg:mt-[14svh]">
          <span className="anim-fade-up block">Sponsor the culture</span>
          <span className="anim-fade-up block" style={{ animationDelay: "70ms" }}>
            your customers love.
          </span>
        </h1>

        <div className="mt-auto grid gap-8 pt-10 sm:pt-14 lg:grid-cols-12 lg:items-end lg:gap-8">
          <p
            className="anim-fade-up max-w-[34ch] text-[1.125rem] leading-[1.45] sm:text-[1.25rem] tracking-[-0.015em] text-ink-soft lg:col-span-5 lg:text-[1.375rem]"
            style={{ animationDelay: "140ms" }}
          >
            Paste your product page. Reppl maps your audience&rsquo;s taste with Qloo, turns it into campaign ideas with
            the artists, creators and places they love, then drafts the pitches and tracks every link.
          </p>

          <form
            id="start"
            noValidate
            onSubmit={onSubmit}
            className="lg:col-span-6 lg:col-start-7"
          >
            <label htmlFor="landing-url" className="mb-2 block text-[0.9375rem] font-medium">
              Your product page
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-0 sm:rounded-full sm:bg-paper sm:p-1.5 sm:shadow-[inset_0_0_0_1px_var(--color-line-strong)] sm:focus-within:shadow-[inset_0_0_0_1.5px_var(--color-forest)]">
              <input
                ref={inputRef}
                id="landing-url"
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                autoCapitalize="none"
                placeholder="yourbrand.com/product"
                value={url}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "landing-url-error" : "landing-url-hint"}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(undefined);
                }}
                className="input h-14 rounded-full px-5 text-[1.0625rem] sm:h-12 sm:flex-1 sm:bg-transparent sm:shadow-none sm:focus:shadow-none"
              />
              <button type="submit" className="btn btn-primary btn-lg sm:h-12">
                Read my brand
              </button>
            </div>
            <p
              id={error ? "landing-url-error" : "landing-url-hint"}
              role={error ? "alert" : undefined}
              className={`mt-3 text-sm ${error ? "text-rust" : "text-ink-faint"}`}
            >
              {error ?? "No account needed. Nothing is published or sent without you."}
            </p>
            {resumable && (
              <p className="mt-2 text-sm text-ink-soft">
                <button
                  type="button"
                  onClick={() => navigate(state.links.length ? "performance" : state.profile ? "opportunities" : "brand")}
                  className="underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink hover:decoration-ink"
                >
                  Continue your campaign for {state.profile?.domain ?? domainOf(state.setup!.url)}
                </button>
              </p>
            )}
          </form>
        </div>
      </section>

      <section id="how" aria-labelledby="how-title" className="bg-forest-deep text-ivory">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:px-10 lg:py-32">
          <div className="lg:col-span-5">
            <h2 id="how-title" className="type-section">
              What happens after you paste
            </h2>
            <p className="mt-6 max-w-[32ch] text-lg leading-relaxed text-ivory/75">
              You make four decisions. The agent does the reading, searching and drafting in between, and shows its work as
              it goes.
            </p>
            <div className="mt-12 max-w-[26rem] border-t border-ivory/15 pt-8">
              <p className="text-sm text-ivory/55">A category search for a shoe brand</p>
              <p className="mt-2 text-xl leading-snug tracking-[-0.02em] text-ivory/70">Fashion and sneaker podcasts</p>
              <div className="land-turn mt-8">
                <p className="text-sm text-ivory/55">The same brand, through taste</p>
                <p className="mt-2 font-serif text-[1.5rem] leading-[1.2] tracking-[-0.02em]">
                  Folk, a listening night, a room they already go to
                </p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-7">
            <div
              className="max-w-[30rem] bg-paper px-6 pb-7 pt-7 text-ink sm:px-8"
              style={{
                clipPath:
                  "polygon(0 0, 100% 0, 100% calc(100% - 10px), 95% 100%, 90% calc(100% - 10px), 85% 100%, 80% calc(100% - 10px), 75% 100%, 70% calc(100% - 10px), 65% 100%, 60% calc(100% - 10px), 55% 100%, 50% calc(100% - 10px), 45% 100%, 40% calc(100% - 10px), 35% 100%, 30% calc(100% - 10px), 25% 100%, 20% calc(100% - 10px), 15% 100%, 10% calc(100% - 10px), 5% 100%, 0 calc(100% - 10px))",
              }}
            >
              {ITINERARY.map((group, i) => (
                <div key={group.heading} className={i === 0 ? "" : "mt-7"}>
                  <h3 className="text-base font-semibold">{group.heading}</h3>
                  <ul className="mt-1.5">
                    {group.rows.map(([what, who]) => (
                      <Row key={what} what={what} who={who} />
                    ))}
                  </ul>
                </div>
              ))}
              <p className="-mx-6 mt-8 flex h-11 items-center justify-between bg-ink px-6 text-[0.9375rem] text-ivory sm:-mx-8 sm:px-8">
                <span>A campaign ready to send</span>
                <span className="num">About 5 minutes</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="real" aria-labelledby="real-title" className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <h2 id="real-title" className="type-section lg:col-span-5">
            What&rsquo;s real, and what isn&rsquo;t yet
          </h2>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="max-w-[30ch] text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.3] tracking-[-0.02em]">
              Your page is really read, your links really redirect, and every click is really counted.
            </p>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink-soft">
              Audience taste and partner recommendations come from Qloo&rsquo;s taste graph. Without a Qloo key, the app runs on
              fictional examples labelled as illustrative. Events are sample listings for now, fees are estimates until you
              agree them, and nothing is sent on your behalf.
            </p>
          </div>
        </div>
      </section>

      <a
        href="#start"
        onClick={(e) => {
          e.preventDefault();
          focusStart();
        }}
        className="land-start group relative flex min-h-[46svh] flex-col justify-between overflow-hidden bg-forest px-5 pb-6 pt-8 text-ivory hover:bg-lavender hover:text-forest-deep focus-visible:bg-lavender focus-visible:text-forest-deep focus-visible:outline-none sm:px-8 lg:min-h-[60svh] lg:px-10"
      >
        <span className="flex items-start justify-between gap-6">
          <span className="max-w-[26ch] text-[1.0625rem] leading-snug sm:text-xl">
            Paste your product page and see who your customers already follow.
          </span>
          <svg viewBox="0 0 48 48" className="land-arrow size-8 shrink-0 sm:size-12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M14 34 34 14M18 14h16v16" />
          </svg>
        </span>
        <span className="block text-[clamp(6rem,27vw,26rem)] font-semibold leading-[0.78] tracking-[-0.07em]">Start</span>
      </a>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <Logo />
        <p>Taste data by Qloo when connected. Events are sample listings.</p>
        <p className="num">2026</p>
      </footer>
    </>
  );
}
