"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BUDGET_PRESETS, GOALS, MAX_GOALS, ONLINE_ONLY, money } from "@/lib/campaign/catalog";
import {
  SETUP_FIELDS,
  normalizeUrl,
  parseBudget,
  setupFromDraft,
  validateSetup,
  type SetupDraft,
  type SetupErrors,
  type SetupField,
} from "@/lib/campaign/validate";
import { ToggleChips } from "../form/ChipGroup";
import { Field, describedBy } from "../form/Field";
import { recordStage, useJourney } from "../journey/JourneyProvider";
import { PageHeader, Shell } from "../ui/PageHeader";
import { ReadingStatus } from "./ReadingStatus";

export function Setup() {
  const { state, dispatch } = useJourney();
  const draft = state.draft;
  const [touched, setTouched] = useState<Partial<Record<SetupField, boolean>>>({});
  const [attempted, setAttempted] = useState(false);

  const errors = useMemo<SetupErrors>(() => {
    const all = validateSetup(draft);
    const visible: SetupErrors = {};
    for (const f of SETUP_FIELDS) if ((attempted || touched[f]) && all[f]) visible[f] = all[f];
    return visible;
  }, [draft, touched, attempted]);

  const update = (patch: Partial<SetupDraft>) => dispatch({ type: "draft", draft: { ...draft, ...patch } });
  const touch = (f: SetupField) => !touched[f] && setTouched((t) => ({ ...t, [f]: true }));
  const online = draft.location === ONLINE_ONLY;
  const budget = parseBudget(draft.budget);

  const rereadIfChanged = () => {
    touch("url");
    const url = normalizeUrl(draft.url);
    if (url && url !== state.reading.url) dispatch({ type: "read", url });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const all = validateSetup(draft);
    const first = SETUP_FIELDS.find((f) => all[f]);
    if (first) {
      setAttempted(true);
      document.getElementById(`setup-${first}`)?.focus();
      return;
    }
    const setup = setupFromDraft(draft);
    if (setup.url !== state.reading.url) dispatch({ type: "read", url: setup.url });
    recordStage("brand");
    dispatch({ type: "submitSetup", setup });
  };

  return (
    <Shell>
      <PageHeader
        title="Campaign details"
        subline="Three quick answers so the creators, events and budget split fit what you're trying to do."
      />

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <form noValidate onSubmit={onSubmit} className="grid gap-9 lg:col-span-7">
          <Field id="setup-url" label="Product page" error={errors.url}>
            <input
              id="setup-url"
              className="input"
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              autoCapitalize="none"
              value={draft.url}
              aria-invalid={!!errors.url || undefined}
              aria-describedby={describedBy("setup-url", { error: errors.url })}
              onChange={(e) => update({ url: e.target.value })}
              onBlur={rereadIfChanged}
            />
          </Field>

          <Field
            id="setup-budget"
            label="Total budget"
            hint="Creator fees and event sponsorships together, in US dollars. We'll suggest how to split it."
            error={errors.budget}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:w-56">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden>
                  $
                </span>
                <input
                  id="setup-budget"
                  className="input num pl-8"
                  inputMode="numeric"
                  placeholder="5,000"
                  value={draft.budget}
                  aria-invalid={!!errors.budget || undefined}
                  aria-describedby={describedBy("setup-budget", { hint: true, error: errors.budget })}
                  onChange={(e) => update({ budget: e.target.value.replace(/[^0-9,]/g, "") })}
                  onBlur={() => {
                    touch("budget");
                    if (Number.isFinite(budget) && budget > 0) update({ budget: budget.toLocaleString("en-US") });
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Common budgets">
                {BUDGET_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={budget === preset}
                    className="chip num"
                    onClick={() => {
                      update({ budget: preset.toLocaleString("en-US") });
                      touch("budget");
                    }}
                  >
                    {money(preset)}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field id="setup-goals" label="Goals" hint={`Pick up to ${MAX_GOALS === 2 ? "two" : MAX_GOALS}. The first one shapes the pitches most.`} error={errors.goals} group>
            <ToggleChips
              id="setup-goals"
              options={GOALS}
              value={draft.goals}
              max={MAX_GOALS}
              invalid={!!errors.goals}
              describedBy="setup-goals-hint"
              onChange={(goals) => {
                update({ goals });
                touch("goals");
              }}
            />
          </Field>

          <Field
            id="setup-location"
            label="Where should it happen?"
            hint="Events are searched near here. Creators work online either way."
            error={errors.location}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                id="setup-location"
                className="input sm:flex-1"
                autoComplete="address-level2"
                placeholder="London, UK"
                value={online ? "" : draft.location}
                disabled={online}
                aria-invalid={!!errors.location || undefined}
                aria-describedby={describedBy("setup-location", { hint: true, error: errors.location })}
                onChange={(e) => update({ location: e.target.value })}
                onBlur={() => touch("location")}
              />
              <button
                type="button"
                aria-pressed={online}
                className="chip self-start sm:self-auto"
                onClick={() => {
                  update({ location: online ? "" : ONLINE_ONLY });
                  touch("location");
                }}
              >
                {ONLINE_ONLY}
              </button>
            </div>
          </Field>

          <div className="flex flex-col-reverse items-start gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-faint" aria-live="polite">
              {Object.keys(errors).length > 0 && attempted
                ? `${Object.keys(errors).length === 1 ? "One answer needs" : `${Object.keys(errors).length} answers need`} a look.`
                : "You can change any of this later."}
            </p>
            <button type="submit" className="btn btn-primary btn-lg w-full sm:w-auto">
              Continue
            </button>
          </div>
        </form>

        <aside className="lg:col-span-5" aria-labelledby="agent-title">
          <div className="card p-6 lg:sticky lg:top-28">
            <h2 id="agent-title" className="text-base font-semibold">
              Meanwhile
            </h2>
            <p className="mt-1 text-sm text-ink-soft">The agent starts on your page while you answer.</p>
            <div className="mt-5">
              <ReadingStatus reading={state.reading} />
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
