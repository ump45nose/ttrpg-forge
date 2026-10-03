import { AnimatePresence, motion } from "motion/react";
import { create } from "zustand";
import { reducedMotion } from "../app/settings";

/** Full-screen, purely presentational feedback for big moments: going down, losing concentration, taking a hit. */
export type FxKind = "hurt" | "down" | "conc" | "heal";

interface FxState {
  fx: { id: number; kind: FxKind; text?: string } | null;
}

const useFx = create<FxState>()(() => ({ fx: null }));
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function flash(kind: FxKind, text?: string) {
  const id = ++seq;
  useFx.setState({ fx: { id, kind, text } });
  clearTimeout(timer);
  timer = setTimeout(() => useFx.setState((s) => (s.fx?.id === id ? { fx: null } : s)), text ? 1500 : 650);
}

const EDGE: Record<FxKind, string> = {
  hurt: "rgb(229 72 77 / 0.35)",
  down: "rgb(229 72 77 / 0.6)",
  conc: "color-mix(in oklab, var(--magic) 55%, transparent)",
  heal: "rgb(95 211 154 / 0.3)",
};

export function FxLayer() {
  const fx = useFx((s) => s.fx);
  const still = reducedMotion();
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      <AnimatePresence>
        {fx && (
          <motion.div
            key={fx.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, still ? 1 : 0.7] }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            transition={{ duration: 0.25 }}
            style={{ boxShadow: `inset 0 0 ${fx.kind === "hurt" ? 60 : 120}px ${fx.kind === "hurt" ? 10 : 30}px ${EDGE[fx.kind]}` }}
          >
            {fx.text && (
              <div className="flex h-full items-center justify-center px-6">
                <motion.div
                  initial={still ? { opacity: 0 } : { opacity: 0, scale: 1.4, letterSpacing: "0.4em" }}
                  animate={{ opacity: 1, scale: 1, letterSpacing: "0.12em" }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className="rounded-2xl bg-black/55 px-6 py-3 text-center font-display text-3xl text-white shadow-2xl backdrop-blur-sm"
                  style={{ textShadow: `0 0 24px ${EDGE[fx.kind]}` }}
                >
                  {fx.text}
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
