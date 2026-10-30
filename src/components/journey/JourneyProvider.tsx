"use client";

import { toast } from "sonner";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import {
  INITIAL_STATE,
  STAGES,
  canEnter,
  journeyReducer,
  type JourneyAction,
  type JourneyState,
  type Stage,
} from "./state";

const STORAGE_KEY = "reppl:campaign:v2";

interface JourneyContextValue {
  state: JourneyState;
  dispatch: (action: JourneyAction) => void;
  navigate: (stage: Stage, options?: { replace?: boolean }) => void;
}

const JourneyContext = createContext<JourneyContextValue | null>(null);

function stageFromHash(): Stage | null {
  const hash = window.location.hash.slice(1) as Stage;
  return STAGES.includes(hash) ? hash : null;
}

function writeHistory(stage: Stage, replace: boolean) {
  const url = stage === "landing" ? window.location.pathname : `#${stage}`;
  if (replace) window.history.replaceState({ stage }, "", url);
  else window.history.pushState({ stage }, "", url);
}

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(journeyReducer, INITIAL_STATE);
  const stateRef = useRef(state);
  const warnedStorage = useRef(false);

  useEffect(() => {
    stateRef.current = state;
    // Until hydration replaces the seed state, saving would overwrite the stored journey.
    if (state === INITIAL_STATE) return;
    let durable = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { durable = false; }
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* The current in-memory campaign remains usable. */ }
    if (!durable && !warnedStorage.current) {
      warnedStorage.current = true;
      toast.warning("This browser could not save your work permanently. Export your offers before leaving or clearing the session.");
    }
  }, [state]);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    let restored = INITIAL_STATE;
    try {
      let raw: string | null = null;
      try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* Try the session copy. */ }
      if (!raw) { try { raw = sessionStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem("reppl:campaign:v1"); } catch { /* Start with an empty campaign. */ } }
      if (raw) restored = journeyReducer(INITIAL_STATE, { type: "hydrate", state: JSON.parse(raw) as JourneyState });
    } catch {
      restored = INITIAL_STATE;
    }
    const requested = stageFromHash() ?? "landing";
    const stage = canEnter(requested, restored) ? requested : "landing";
    dispatch({ type: "hydrate", state: { ...restored, stage } });
    writeHistory(stage, true);

    const onPop = (event: PopStateEvent) => {
      const wanted = (event.state?.stage as Stage | undefined) ?? stageFromHash() ?? "landing";
      const stage = canEnter(wanted, stateRef.current) ? wanted : "landing";
      if (stage !== wanted) writeHistory(stage, true);
      dispatch({ type: "go", stage });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((stage: Stage, options?: { replace?: boolean }) => {
    writeHistory(stage, options?.replace ?? false);
    dispatch({ type: "go", stage });
  }, []);

  const value = useMemo(() => ({ state, dispatch, navigate }), [state, navigate]);
  return <JourneyContext value={value}>{children}</JourneyContext>;
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used inside <JourneyProvider>");
  return ctx;
}

/** Writes a history entry for a stage change that the reducer performs itself. */
export function recordStage(stage: Stage, replace = false) {
  writeHistory(stage, replace);
}
