"use client";

import { domainOf } from "@/lib/campaign/infer";
import { StatusLine } from "../ui/Status";
import type { ReadingState } from "../journey/state";

/** What the agent is doing with the product page while the user answers questions. */
export function ReadingStatus({ reading }: { reading: ReadingState }) {
  const domain = domainOf(reading.url);
  return (
    <div aria-live="polite">
      {reading.status === "reading" && (
        <StatusLine tone="working" detail="Looking at the title, description and headings to work out what you sell and who it's for.">
          Reading {domain}…
        </StatusLine>
      )}
      {reading.status === "done" && reading.profile && (
        <StatusLine
          tone="done"
          detail={
            <>
              Found <span className="text-ink">{reading.profile.name}</span>
              {reading.profile.summary ? <>: &ldquo;{reading.profile.summary}&rdquo;</> : "."} You can check and edit this next.
            </>
          }
        >
          Read {domain}
        </StatusLine>
      )}
      {reading.status === "error" && reading.error && (
        <StatusLine tone="error" detail={`${reading.error.message} You can describe your brand in a sentence on the next step instead.`}>
          Couldn&rsquo;t read {domain}
        </StatusLine>
      )}
      {reading.status === "idle" && <StatusLine tone="pending">Waiting for a product page</StatusLine>}
    </div>
  );
}
