"use client";

import Image from "next/image";
import { useState } from "react";
import type { Opportunity } from "@/lib/discovery/types";

const TONE: Record<Opportunity["kind"], string> = {
  artist: "bg-lavender text-lavender-deep",
  creator: "bg-lavender-soft text-lavender-deep",
  podcast: "bg-moss text-forest",
  venue: "bg-rust-soft text-rust",
  brand: "bg-forest text-ivory",
  event: "bg-ivory text-forest shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
};

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** A partner's picture from Qloo, or initials tinted by kind. People are round; places and brands are squares. */
export function PartnerAvatar({ opportunity, size = 44 }: { opportunity: Opportunity; size?: number }) {
  const [failed, setFailed] = useState(false);
  const person = opportunity.kind === "artist" || opportunity.kind === "creator";
  const shape = person ? "rounded-full" : "rounded-[30%]";

  if (opportunity.image && !failed) {
    return (
      <Image
        src={opportunity.image}
        alt=""
        width={size}
        height={size}
        unoptimized
        onError={() => setFailed(true)}
        className={`shrink-0 object-cover outline outline-1 -outline-offset-1 outline-black/10 ${shape}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-medium tracking-[-0.02em] ${shape} ${TONE[opportunity.kind]}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(opportunity.name)}
    </span>
  );
}
