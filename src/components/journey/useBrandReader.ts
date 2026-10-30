"use client";

import { useEffect } from "react";
import type { BrandProfile, ReadFailure } from "@/lib/campaign/types";
import { useJourney } from "./JourneyProvider";

/** Reads the product page whenever the journey asks for it, so the read runs while the user fills in details. */
export function useBrandReader() {
  const { state, dispatch } = useJourney();
  const { url, status } = state.reading;

  useEffect(() => {
    if (status !== "reading" || !url) return;
    const controller = new AbortController();

    fetch("/api/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { profile: BrandProfile }
          | { reason: ReadFailure; error: string }
          | null;
        if (response.ok && payload && "profile" in payload) {
          dispatch({ type: "readDone", url, profile: payload.profile });
        } else {
          dispatch({
            type: "readFailed",
            url,
            error:
              payload && "reason" in payload
                ? { reason: payload.reason, message: payload.error }
                : { reason: "unreachable", message: "Something went wrong while reading the page." },
          });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "readFailed",
          url,
          error: { reason: "unreachable", message: "We couldn't reach Reppl's reader. Check your connection." },
        });
      });

    return () => controller.abort();
  }, [url, status, dispatch]);
}
