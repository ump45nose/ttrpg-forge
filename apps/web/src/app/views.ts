import type { Character } from "@forge/core";
import { useMemo } from "react";
import { useEngine } from "./packs";

/** Builder view of a character (no play effects). */
export function useBuildView(c: Character | undefined) {
  const engine = useEngine();
  return useMemo(() => (c ? engine.evaluate(c.build) : undefined), [engine, c?.build]);
}

/** Table view: sheet with active effects + folded play state. */
export function usePlayView(c: Character | undefined) {
  const engine = useEngine();
  return useMemo(() => (c ? engine.play(c) : undefined), [engine, c?.build, c?.play]);
}
