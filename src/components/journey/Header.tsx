"use client";

import { Check } from "lucide-react";
import { domainOf } from "@/lib/campaign/infer";
import { Logo } from "../ui/Logo";
import { useJourney } from "./JourneyProvider";
import { STEPS, canEnter } from "./state";

export function Header() {
  const { state, navigate } = useJourney();
  const index = STEPS.findIndex((s) => s.stage === state.stage);
  const current = STEPS[index];
  const domain = state.profile?.domain ?? state.reading.profile?.domain ?? domainOf(state.draft.url);

  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-ivory">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("landing")}
            aria-label="Reppl home"
            className="rounded-md transition-transform duration-150 active:scale-[0.97]"
          >
            <Logo compact />
          </button>
          {domain && <span className="hidden truncate text-sm text-ink-faint sm:block">{domain}</span>}
        </div>

        <nav aria-label="Campaign steps" className="hidden lg:block">
          <ol className="flex items-center gap-1">
            {STEPS.map((step, i) => {
              const active = step.stage === state.stage;
              const enabled = canEnter(step.stage, state);
              const done = i < index && enabled;
              return (
                <li key={step.stage}>
                  <button
                    type="button"
                    disabled={!enabled}
                    aria-current={active ? "step" : undefined}
                    onClick={() => !active && navigate(step.stage)}
                    className={`flex h-9 items-center gap-2 rounded-full px-3 text-sm tracking-[-0.01em] transition-[color,background-color] duration-200 ${
                      active
                        ? "bg-lavender-soft font-medium text-forest-deep"
                        : enabled
                          ? "text-ink-soft hover:bg-ink/5 hover:text-ink"
                          : "text-ink-faint/70"
                    }`}
                  >
                    {done && <Check className="size-3.5 text-forest" strokeWidth={2.5} aria-hidden />}
                    {step.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {current && (
          <p className="text-sm text-ink-soft lg:hidden">
            <span className="text-ink-faint">
              Step {index + 1} of {STEPS.length}
            </span>{" "}
            <span className="font-medium text-ink">{current.label}</span>
          </p>
        )}
      </div>
      <div className="h-px bg-line">
        <div
          className="h-px origin-left bg-forest transition-transform duration-500 ease-out lg:hidden"
          style={{ transform: `scaleX(${current ? (index + 1) / STEPS.length : 0})` }}
        />
      </div>
    </header>
  );
}
