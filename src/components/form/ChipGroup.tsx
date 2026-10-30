"use client";

import { Check } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

interface Option<T extends string> {
  id: T;
  label: string;
}

/** Single choice. Arrow keys move between options, like a native radio group. */
export function ChoiceChips<T extends string>({
  id,
  options,
  value,
  onChange,
  invalid,
  onBlur,
}: {
  id: string;
  options: Option<T>[];
  value: T | "";
  onChange: (value: T) => void;
  invalid?: boolean;
  onBlur?: () => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className="flex flex-wrap gap-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onBlur?.();
      }}
    >
      {options.map((o, i) => (
        <button
          key={o.id}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          tabIndex={i === activeIndex ? 0 : -1}
          className="chip"
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multiple choice, each chip a toggle button. At `max`, unselected chips are disabled until one is cleared. */
export function ToggleChips<T extends string>({
  id,
  options,
  value,
  onChange,
  invalid,
  onBlur,
  max,
  describedBy,
}: {
  id: string;
  options: Option<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  invalid?: boolean;
  onBlur?: () => void;
  max?: number;
  describedBy?: string;
}) {
  const full = max !== undefined && value.length >= max;
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={[describedBy, invalid && `${id}-error`].filter(Boolean).join(" ") || undefined}
      className="flex flex-wrap gap-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onBlur?.();
      }}
    >
      {options.map((o, i) => {
        const on = value.includes(o.id);
        const locked = full && !on;
        return (
          <button
            key={o.id}
            id={i === 0 ? id : undefined}
            type="button"
            aria-pressed={on}
            aria-disabled={locked || undefined}
            className="chip"
            onClick={() => {
              if (locked) return;
              onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id]);
            }}
          >
            <span
              className="grid size-4 place-items-center rounded-full transition-[background-color,box-shadow] duration-200"
              style={{
                background: on ? "var(--color-lavender)" : "transparent",
                boxShadow: on ? "none" : "inset 0 0 0 1px var(--color-line-strong)",
              }}
              aria-hidden
            >
              <Check
                className="size-2.5 text-forest transition-[opacity,transform] duration-200 ease-out"
                strokeWidth={3}
                style={{ opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(0.6)" }}
              />
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
