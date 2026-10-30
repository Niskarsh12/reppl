"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

export function CopyButton({
  text,
  label,
  copiedLabel = "Copied",
  variant = "secondary",
  className = "",
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  variant?: "secondary" | "quiet" | "primary";
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  const Icon = state === "copied" ? Check : Copy;
  return (
    <button type="button" onClick={copy} className={`btn btn-${variant} ${variant === "quiet" ? "" : "h-10 px-4"} text-sm ${className}`}>
      <span className="relative grid size-4 place-items-center" aria-hidden>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={state === "copied" ? "check" : "copy"}
            initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="grid place-items-center"
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </motion.span>
        </AnimatePresence>
      </span>
      <span aria-live="polite">{state === "copied" ? copiedLabel : state === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}
