import { localize, type LocalizedText } from "@forge/core";
import i18n from "i18next";
import { useCallback } from "react";
import { initReactI18next, useTranslation } from "react-i18next";
import { en } from "../locales/en";
import { zh } from "../locales/zh";
import { useSettings } from "./settings";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: useSettings.getState().locale,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

useSettings.subscribe((s, prev) => {
  if (s.locale !== prev.locale) {
    void i18n.changeLanguage(s.locale);
    document.documentElement.lang = s.locale === "zh" ? "zh-CN" : "en";
  }
});
document.documentElement.lang = useSettings.getState().locale === "zh" ? "zh-CN" : "en";

export const useT = () => useTranslation().t;

/** Localize rules content; in bilingual mode shows "火焰箭 · Fire Bolt". */
export function useL() {
  const locale = useSettings((s) => s.locale);
  const bilingual = useSettings((s) => s.bilingual);
  return useCallback(
    (text: LocalizedText | undefined, opts: { mono?: boolean } = {}) => {
      const main = localize(text, locale);
      if (!bilingual || opts.mono || typeof text !== "object") return main;
      const other = localize(text, locale === "zh" ? "en" : "zh");
      return other && other !== main ? `${main} · ${other}` : main;
    },
    [locale, bilingual],
  );
}

export { i18n };
