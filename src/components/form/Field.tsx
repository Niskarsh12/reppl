"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "@/lib/motion";

export function Field({
  id,
  label,
  hint,
  optional,
  error,
  aside,
  group = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  aside?: ReactNode;
  /** Groups are named via aria-labelledby, so the label must not point at a single control. */
  group?: boolean;
  children: ReactNode;
}) {
  const Label = group ? "p" : "label";
  return (
    <div className="group/field">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <Label
          htmlFor={group ? undefined : id}
          id={`${id}-label`}
          className="text-[0.9375rem] font-medium tracking-[-0.01em] text-ink"
        >
          {label}
          {optional && <span className="ml-2 font-normal text-ink-faint">Optional</span>}
        </Label>
        {aside}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mb-3 text-sm leading-relaxed text-ink-faint">
          {hint}
        </p>
      )}
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden text-sm text-rust"
          >
            <span className="block pt-2.5">{error}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function describedBy(id: string, opts: { hint?: boolean; error?: string }) {
  return [opts.hint && `${id}-hint`, opts.error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}
