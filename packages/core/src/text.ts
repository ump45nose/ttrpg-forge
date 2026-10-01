/**
 * Localized text. Content packs store every user-facing string as either a
 * plain string (language-neutral, e.g. "1d8") or a per-locale map.
 * Entity identity never depends on these strings.
 */
export type Locale = "en" | "zh";

export type LocalizedText = string | ({ en: string } & Partial<Record<Locale, string>>);

export const LOCALES: readonly Locale[] = ["en", "zh"];

export function localize(text: LocalizedText | undefined, locale: Locale): string {
  if (text === undefined) return "";
  if (typeof text === "string") return text;
  return text[locale] ?? text.en;
}

/** All locale variants of a text, used for bilingual search. */
export function allVariants(text: LocalizedText | undefined): string[] {
  if (text === undefined) return [];
  if (typeof text === "string") return [text];
  return Object.values(text).filter((v): v is string => typeof v === "string");
}
