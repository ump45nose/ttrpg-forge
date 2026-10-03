import type { Locale } from "@forge/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ImageConnection } from "./imageApi";

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
  /** Show illustrations (art packs). Off saves data on slow connections. */
  art: boolean;
  /** Dice and feedback sounds. */
  sound: boolean;
  /** Tumbling dice before the result lands. */
  diceAnim: boolean;
  /** Saved OpenAI-compatible image API connections. Keys stay on this device. */
  imageConnections: ImageConnection[];
  /** The connection used for generating. */
  imageConnectionId?: string;
  /** One-off tips the user has dismissed. */
  seenHints: string[];
  /** Last full backup (ms), for the "back up your data" nudge. */
  lastBackup?: number;
  /** Backup nudge hidden until this time. */
  backupSnoozed?: number;
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
      art: true,
      sound: false,
      diceAnim: true,
      imageConnections: [],
      seenHints: [],
      set: (patch) => set(patch),
    }),
    { name: "forge.settings", version: 2, migrate: (s) => ({ seenHints: [], ...(s as object) }) as unknown as Settings },
  ),
);

/** The connection images are generated with, if one is set up. */
export function activeConnection(s: Pick<Settings, "imageConnections" | "imageConnectionId">): ImageConnection | undefined {
  return s.imageConnections.find((c) => c.id === s.imageConnectionId) ?? s.imageConnections[0];
}

/** Settings as they go into a backup: everything but the personal image API keys. */
export function portableSettings(s: Settings): Partial<Settings> {
  const { set: _set, imageConnections, ...rest } = s;
  return { ...rest, imageConnections: imageConnections.map((c) => ({ ...c, key: "" })) };
}

/** Settings restored from a backup keep this device's own keys (matched by connection). */
export function keepLocalKey(incoming: Partial<Settings>, current: Settings): Partial<Settings> {
  if (!incoming.imageConnections) return incoming;
  const own = new Map(current.imageConnections.map((c) => [c.id, c.key]));
  return { ...incoming, imageConnections: incoming.imageConnections.map((c) => ({ ...c, key: own.get(c.id) ?? "" })) };
}

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
