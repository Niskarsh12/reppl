"use client";

import { useEffect, useReducer } from "react";
import { ONLINE_ONLY } from "@/lib/campaign/catalog";
import { DiscoveryError, runDiscovery } from "@/lib/discovery/client";
import type {
  AudienceProfile,
  CampaignIdea,
  CategoryContrast,
  DataSource,
  DiscoveryEvent,
  DiscoveryRequest,
  DiscoveryResult,
  DiscoveryStep,
  Match,
} from "@/lib/discovery/types";

export interface DiscoveryView {
  status: "running" | "complete" | "error";
  source: DataSource | null;
  signals: string[];
  searchesEvents: boolean;
  steps: Partial<Record<DiscoveryStep, "active" | "done">>;
  details: Partial<Record<DiscoveryStep, string>>;
  audience: AudienceProfile | null;
  contrast: CategoryContrast | null;
  matches: Match[];
  ideas: CampaignIdea[];
  result: DiscoveryResult | null;
  error: string | null;
  attempt: number;
}

type Action =
  | { type: "event"; event: DiscoveryEvent }
  | { type: "complete"; result: DiscoveryResult }
  | { type: "error"; message: string }
  | { type: "retry" };

const initial: DiscoveryView = {
  status: "running",
  source: null,
  signals: [],
  searchesEvents: true,
  steps: {},
  details: {},
  audience: null,
  contrast: null,
  matches: [],
  ideas: [],
  result: null,
  error: null,
  attempt: 0,
};

function uniqueMatches(matches: Match[]): Match[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const id = match.opportunity.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function fromResult(result: DiscoveryResult, searchesEvents: boolean, details: DiscoveryView["details"] = {}): DiscoveryView {
  const matches = uniqueMatches(result.matches);
  const uniqueResult = matches.length === result.matches.length ? result : { ...result, matches };
  return {
    ...initial,
    searchesEvents,
    status: "complete",
    source: result.source,
    signals: result.signals,
    steps: { brand: "done", taste: "done", search: "done", events: "done", ideas: "done" },
    details,
    audience: result.audience,
    contrast: result.contrast ?? null,
    matches,
    ideas: uniqueResult.ideas,
    result: uniqueResult,
  };
}

function reducer(state: DiscoveryView, action: Action): DiscoveryView {
  switch (action.type) {
    case "retry":
      return { ...initial, attempt: state.attempt + 1 };
    case "error":
      return { ...state, status: "error", error: action.message };
    case "complete":
      return { ...fromResult(action.result, state.searchesEvents, state.details), attempt: state.attempt };
    case "event": {
      const e = action.event;
      switch (e.type) {
        case "source":
          return state.source && state.source.id !== e.source.id ? { ...initial, attempt: state.attempt, source: e.source } : { ...state, source: e.source };
        case "plan":
          return { ...state, signals: e.signals, searchesEvents: e.searchesEvents };
        case "step":
          return {
            ...state,
            steps: { ...state.steps, [e.step]: e.status },
            details: e.detail ? { ...state.details, [e.step]: e.detail } : state.details,
          };
        case "audience":
          return { ...state, audience: e.audience };
        case "contrast":
          return { ...state, contrast: e.contrast };
        case "match":
          return {
            ...state,
            matches: state.matches.some((match) => match.opportunity.id === e.match.opportunity.id)
              ? state.matches
              : [...state.matches, e.match],
          };
        case "conversation":
          return {
            ...state,
            matches: state.matches.map((m) =>
              m.opportunity.id === e.id ? { ...m, conversation: e.conversation, whyItFits: e.whyItFits } : m,
            ),
          };
        case "idea":
          return { ...state, ideas: [...state.ideas, e.idea] };
        default:
          return state;
      }
    }
  }
}

/** Streams a discovery run, or shows a previous result when `cached` is given. */
export function useDiscoveryStream(request: DiscoveryRequest, key: string, cached: DiscoveryResult | null) {
  const [view, dispatch] = useReducer(reducer, cached, (c) =>
    c ? fromResult(c, request.setup.location.toLowerCase() !== ONLINE_ONLY.toLowerCase()) : initial,
  );
  const skip = cached !== null && view.attempt === 0;

  useEffect(() => {
    if (skip) return;
    const controller = new AbortController();
    runDiscovery(request, (event) => dispatch({ type: "event", event }), controller.signal)
      .then((result) => dispatch({ type: "complete", result }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "error",
          message: error instanceof DiscoveryError ? error.message : "Something unexpected went wrong.",
        });
      });
    return () => controller.abort();
    // `key` captures every input in `request`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, view.attempt, skip]);

  return { view, retry: () => dispatch({ type: "retry" }) };
}
