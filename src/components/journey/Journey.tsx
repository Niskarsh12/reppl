"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { EASE_OUT } from "@/lib/motion";
import { BrandReview } from "../brand/BrandReview";
import { Landing } from "../landing/Landing";
import { Links } from "../links/Links";
import { Offers } from "../offers/Offers";
import { Opportunities } from "../opportunities/Opportunities";
import { Performance } from "../performance/Performance";
import { Plan } from "../plan/Plan";
import { Setup } from "../setup/Setup";
import { Header } from "./Header";
import { JourneyProvider, useJourney } from "./JourneyProvider";
import { useBrandReader } from "./useBrandReader";

function Stages() {
  const { state } = useJourney();
  const reduce = useReducedMotion();
  const previous = useRef(state.stage);
  useBrandReader();

  // Both variants share `animate` so server-rendered styles match either preference.
  const page = reduce
    ? {
        initial: { opacity: 0, transform: "translateY(0px)" },
        animate: { opacity: 1, transform: "translateY(0px)" },
        exit: { opacity: 0, transition: { duration: 0.12 } },
      }
    : {
        initial: { opacity: 0, transform: "translateY(8px)" },
        animate: { opacity: 1, transform: "translateY(0px)" },
        exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } },
      };

  const onEntered = () => {
    if (previous.current === state.stage) return;
    previous.current = state.stage;
    if (state.stage !== "landing") document.getElementById("stage-title")?.focus({ preventScroll: true });
  };

  useEffect(() => {
    document.title =
      state.stage === "landing" ? "Reppl: sponsor the culture your customers love" : `${titles[state.stage]} · Reppl`;
  }, [state.stage]);

  return (
    <>
      {state.stage !== "landing" && <Header />}
      <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
        <motion.main
          key={state.stage}
          {...page}
          transition={{ duration: 0.28, ease: EASE_OUT }}
          onAnimationComplete={onEntered}
        >
          {state.stage === "landing" && <Landing />}
          {state.stage === "setup" && <Setup />}
          {state.stage === "brand" && <BrandReview />}
          {state.stage === "offers" && <Offers />}
          {state.stage === "opportunities" && <Opportunities />}
          {state.stage === "plan" && <Plan />}
          {state.stage === "links" && <Links />}
          {state.stage === "performance" && <Performance />}
        </motion.main>
      </AnimatePresence>
    </>
  );
}

const titles = {
  landing: "",
  setup: "Campaign details",
  brand: "Your brand",
  offers: "Your sponsorship offers",
  opportunities: "Compare sponsorship offers",
  plan: "Pitches and plan",
  links: "Tracked links",
  performance: "Performance",
} as const;

export function Journey() {
  return (
    <JourneyProvider>
      <MotionConfig reducedMotion="user">
        <Stages />
      </MotionConfig>
      <Toaster
        position="bottom-center"
        offset={28}
        toastOptions={{
          style: {
            background: "var(--color-ink)",
            color: "var(--color-ivory)",
            border: "none",
            borderRadius: "16px",
            fontFamily: "var(--font-sans)",
            letterSpacing: "-0.01em",
          },
          actionButtonStyle: {
            background: "var(--color-lavender)",
            color: "var(--color-ink)",
            borderRadius: "999px",
            fontWeight: 500,
          },
        }}
      />
    </JourneyProvider>
  );
}
