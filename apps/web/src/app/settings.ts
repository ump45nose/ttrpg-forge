import type { Locale } from "@forge/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  locale: Locale;
  /** Show "火焰箭 · Fire Bolt" style names. */
  bilingual: boolean;
  theme: string;
  motion: "system" | "full" | "reduced";
  /** Enter physical dice results instead of rolling digitally. */
  physicalDice: boolean;
  haptics: boolean;
  /** Recognise rules terms in prose and make them hoverable. */
  autoTerms: boolean;
  disabledPlugins: string[];
  set(patch: Partial<Omit<Settings, "set">>): void;
}

const defaultLocale = (): Locale => (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en");

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      locale: defaultLocale(),
      bilingual: false,
      theme: "arcane",
      motion: "system",
      physicalDice: false,
      haptics: true,
      autoTerms: true,
      disabledPlugins: [],
      set: (patch) => set(patch),
    }),
    { name: "forge.settings", version: 1 },
  ),
);

export function reducedMotion(): boolean {
  const m = useSettings.getState().motion;
  if (m === "reduced") return true;
  if (m === "full") return false;
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Light haptic tick where supported (Android; iOS Safari has no Vibration API). */
export function haptic(pattern: number | number[] = 8) {
  if (!useSettings.getState().haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
