"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, CATEGORY_AUDIENCE, CATEGORY_SCENES, ONLINE_ONLY, SCENE_LABELS, TONES, money } from "@/lib/campaign/catalog";
import { domainOf, inferProfile } from "@/lib/campaign/infer";
import type { BrandProfile } from "@/lib/campaign/types";
import { MAX_SIGNALS } from "@/lib/discovery/validate";
import { ChoiceChips, ToggleChips } from "../form/ChipGroup";
import { Field, describedBy } from "../form/Field";
import { recordStage, useJourney } from "../journey/JourneyProvider";
import { PageHeader, Shell } from "../ui/PageHeader";
import { Notice, StatusLine } from "../ui/Status";

function Source({ fromPage }: { fromPage: boolean }) {
  return fromPage ? <span className="pill pill-moss">From your page</span> : <span className="pill pill-neutral">Our guess</span>;
}

function Reading({ domain }: { domain: string }) {
  return (
    <Shell>
      <PageHeader title={`Reading ${domain}`} subline="This usually takes a few seconds." />
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12" aria-busy="true">
        <div className="grid gap-9 lg:col-span-7" aria-hidden>
          {[1, 2, 3].map((n) => (
            <div key={n}>
              <div className="skeleton h-4 w-28" />
              <div className={`skeleton mt-3 ${n === 2 ? "h-24" : "h-12"} rounded-[0.875rem]`} />
            </div>
          ))}
        </div>
        <div className="card p-6 lg:col-span-5" aria-live="polite">
          <StatusLine tone="working" detail="Title, description and headings tell us what you sell. Audience and interests are inferred from them.">
            Reading {domain}…
          </StatusLine>
        </div>
      </div>
    </Shell>
  );
}

function Manual({ url, message, onUse }: { url: string; message: string; onUse: (profile: BrandProfile) => void }) {
  const { dispatch, navigate } = useJourney();
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [attempted, setAttempted] = useState(false);
  const nameError = attempted && !name.trim() ? "Add your brand name." : undefined;
  const aboutError = attempted && about.trim().length < 12 ? "Describe what you sell in a sentence." : undefined;
  const domain = domainOf(url);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || about.trim().length < 12) {
      setAttempted(true);
      document.getElementById(!name.trim() ? "manual-name" : "manual-about")?.focus();
      return;
    }
    onUse(inferProfile({ url, siteName: name.trim(), description: about.trim(), bodyText: about }, "manual"));
  };

  return (
    <Shell>
      <PageHeader
        title={`We couldn't read ${domain}`}
        subline="Describe your brand in a sentence and we'll take it from there."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: "read", url })}>
              Try again
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => navigate("setup")}>
              Change the address
            </button>
          </>
        }
      />
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <form noValidate onSubmit={submit} className="grid gap-8 lg:col-span-7">
          <Notice tone="warning">{message}</Notice>
          <Field id="manual-name" label="Brand name" error={nameError}>
            <input
              id="manual-name"
              className="input"
              value={name}
              autoComplete="organization"
              aria-invalid={!!nameError || undefined}
              aria-describedby={describedBy("manual-name", { error: nameError })}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field id="manual-about" label="What you sell" hint="One or two sentences, as you'd say it to a friend." error={aboutError}>
            <textarea
              id="manual-about"
              rows={3}
              className="input"
              value={about}
              placeholder="Oat milk barista blends for specialty coffee shops and home espresso."
              aria-invalid={!!aboutError || undefined}
              aria-describedby={describedBy("manual-about", { hint: true, error: aboutError })}
              onChange={(e) => setAbout(e.target.value)}
            />
          </Field>
          <div>
            <button type="submit" className="btn btn-primary btn-lg w-full sm:w-auto">
              Use this description
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

function Review({ initial }: { initial: BrandProfile }) {
  const { state, dispatch } = useJourney();
  const [profile, setProfile] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const setup = state.setup!;
  const update = (patch: Partial<BrandProfile>) => setProfile((p) => ({ ...p, ...patch }));

  const errors = {
    name: attempted && !profile.name.trim() ? "Add your brand name." : undefined,
    summary: attempted && profile.summary.trim().length < 12 ? "Describe what you sell in a sentence. Pitches quote it." : undefined,
    signals: attempted && profile.signals.length === 0 ? "Pick at least one interest. They drive the search." : undefined,
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const first = (["name", "summary", "signals"] as const).find((k) =>
      k === "name" ? !profile.name.trim() : k === "summary" ? profile.summary.trim().length < 12 : profile.signals.length === 0,
    );
    if (first) {
      setAttempted(true);
      document.getElementById(`brand-${first}`)?.focus();
      return;
    }
    recordStage("offers");
    dispatch({ type: "confirmBrand", profile: { ...profile, name: profile.name.trim(), summary: profile.summary.trim() } });
  };

  const suggested = CATEGORY_SCENES[profile.category];
  const orderedScenes = [...profile.signals, ...suggested, ...SCENE_LABELS].filter((s, i, all) => all.indexOf(s) === i);
  const where = setup.location === ONLINE_ONLY ? "online" : `online and around ${setup.location}`;

  return (
    <Shell>
      <PageHeader
        title="Your brand"
        subline={
          profile.origin === "page"
            ? `Read from ${profile.domain}. Correct anything that's off; it shapes who we look for and how the pitches sound.`
            : "Built from your description. Check the guesses below; they shape who we look for."
        }
      />

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <form noValidate onSubmit={submit} className="grid gap-9 lg:col-span-7">
          <Field id="brand-name" label="Name" error={errors.name} aside={profile.origin === "page" && <Source fromPage={profile.fromPage.name} />}>
            <input
              id="brand-name"
              className="input"
              value={profile.name}
              aria-invalid={!!errors.name || undefined}
              aria-describedby={describedBy("brand-name", { error: errors.name })}
              onChange={(e) => update({ name: e.target.value })}
            />
          </Field>

          <Field id="brand-summary" label="What you sell" error={errors.summary} aside={profile.origin === "page" && <Source fromPage={profile.fromPage.summary} />}>
            <textarea
              id="brand-summary"
              rows={3}
              className="input"
              value={profile.summary}
              placeholder="Say what you make and who buys it, in a sentence."
              aria-invalid={!!errors.summary || undefined}
              aria-describedby={describedBy("brand-summary", { error: errors.summary })}
              onChange={(e) => update({ summary: e.target.value })}
            />
          </Field>

          <Field id="brand-category" label="Category" group aside={<Source fromPage={false} />}>
            <ChoiceChips
              id="brand-category"
              options={CATEGORIES}
              value={profile.category}
              onChange={(category) =>
                update({
                  category,
                  audience: profile.audience === CATEGORY_AUDIENCE[profile.category] ? CATEGORY_AUDIENCE[category] : profile.audience,
                })
              }
            />
          </Field>

          <Field id="brand-audience" label="Who it's for" aside={<Source fromPage={false} />}>
            <input id="brand-audience" className="input" value={profile.audience} onChange={(e) => update({ audience: e.target.value })} />
          </Field>

          <Field id="brand-tone" label="How you sound" hint="Up to two. Pitches are written in this voice." group aside={<Source fromPage={false} />}>
            <ToggleChips id="brand-tone" options={TONES} value={profile.tone} max={2} describedBy="brand-tone-hint" onChange={(tone) => update({ tone })} />
          </Field>

          <Field
            id="brand-signals"
            label="Audience interests"
            hint={`Up to ${MAX_SIGNALS}. These seed the taste search, alongside your brand itself.`}
            error={errors.signals}
            group
            aside={<Source fromPage={false} />}
          >
            <ToggleChips
              id="brand-signals"
              options={orderedScenes.map((s) => ({ id: s, label: s }))}
              value={profile.signals}
              max={MAX_SIGNALS}
              invalid={!!errors.signals}
              describedBy="brand-signals-hint"
              onChange={(signals) => update({ signals })}
            />
          </Field>

          <div>
            <button type="submit" className="btn btn-primary btn-lg w-full sm:w-auto">
              Add sponsorship offers
            </button>
          </div>
        </form>

        <aside className="lg:col-span-5" aria-labelledby="search-title">
          <div className="card p-6 lg:sticky lg:top-28">
            <h2 id="search-title" className="text-base font-semibold">
              What you&rsquo;ll compare
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft" aria-live="polite">
              Add actual sponsorship offers {where}, then compare their evidence, deliverables and cultural fit with{" "}
              <span className="text-ink">
                {profile.signals.length ? profile.signals.map((s) => s.toLowerCase()).join(", ") : "the interests you pick"}
              </span>
              , within a <span className="num text-ink">{money(setup.budget)}</span> budget.
            </p>
            <dl className="mt-6 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Pitches will sound</dt>
                <dd className="text-right">{profile.tone.map((t) => TONES.find((x) => x.id === t)?.label).join(" and ") || "Neutral"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Links will point to</dt>
                <dd className="truncate text-right">{domainOf(setup.url)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

export function BrandReview() {
  const { state } = useJourney();
  const [manual, setManual] = useState<BrandProfile | null>(null);
  const { reading, setup } = state;
  const url = setup?.url ?? reading.url;

  // A profile confirmed earlier wins, so going back never loses edits. Reading a new page clears it.
  const initial = manual ?? state.profile ?? (reading.status === "done" ? reading.profile : null);

  if (initial) return <Review key={`${initial.origin}-${initial.url}`} initial={initial} />;
  if (reading.status === "error" && reading.error) return <Manual url={url} message={reading.error.message} onUse={setManual} />;
  return <Reading domain={domainOf(url)} />;
}
