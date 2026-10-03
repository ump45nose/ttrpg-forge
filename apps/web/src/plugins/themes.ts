import type { ThemeDef } from "@forge/plugin-api";
import type { AppPlugin } from "../app/host";

/**
 * Built-in themes. A theme is just a token map, so new looks (including
 * community ones) are plain data plugins.
 */
export const THEMES: ThemeDef[] = [
  {
    id: "arcane",
    name: { en: "Arcane Night", zh: "奥术之夜" },
    scheme: "dark",
    swatch: ["#0e0f17", "#1b1e2e", "#d6a85c", "#a78bfa"],
    tokens: {
      "--bg": "#0e0f17",
      "--bg-glow-1": "rgb(124 92 214 / 0.2)",
      "--bg-glow-2": "rgb(214 168 92 / 0.1)",
      "--surface": "#151724",
      "--surface-2": "#1b1e2e",
      "--surface-3": "#252a3e",
      "--line": "rgb(255 255 255 / 0.08)",
      "--line-strong": "rgb(255 255 255 / 0.16)",
      "--ink": "#ece8f4",
      "--ink-2": "#a9a4bd",
      "--ink-3": "#8b879e",
      "--accent": "#d6a85c",
      "--accent-2": "#f3d79a",
      "--accent-ink": "#1a1408",
      "--good": "#5fd39a",
      "--bad": "#f06f6f",
      "--warn": "#f2b75b",
      "--info": "#79a8ff",
      "--hp": "#e5484d",
      "--temp": "#5aa9e6",
      "--magic": "#a78bfa",
      "--shadow-lg": "0 24px 60px -24px rgb(0 0 0 / 0.7)",
      "--shadow-md": "0 10px 30px -12px rgb(0 0 0 / 0.6)",
      "--inner-hi": "inset 0 1px 0 rgb(255 255 255 / 0.05)",
      "--art-shadow": "0 1px 2px rgb(0 0 0 / 0.55), 0 0 14px rgb(0 0 0 / 0.45)",
    },
  },
  {
    id: "ember",
    name: { en: "Ember Forge", zh: "余烬熔炉" },
    scheme: "dark",
    swatch: ["#140d0b", "#24171299", "#ff8a3d", "#f05d5e"],
    tokens: {
      "--bg": "#120c0a",
      "--bg-glow-1": "rgb(255 110 40 / 0.16)",
      "--bg-glow-2": "rgb(200 40 40 / 0.12)",
      "--surface": "#1a1210",
      "--surface-2": "#221714",
      "--surface-3": "#33231d",
      "--line": "rgb(255 220 200 / 0.08)",
      "--line-strong": "rgb(255 220 200 / 0.16)",
      "--ink": "#f6ebe4",
      "--ink-2": "#bfa79a",
      "--ink-3": "#958074",
      "--accent": "#ff8a3d",
      "--accent-2": "#ffc178",
      "--accent-ink": "#1d0d03",
      "--good": "#7bd389",
      "--bad": "#ff6b6b",
      "--warn": "#ffb454",
      "--info": "#7fb0ff",
      "--hp": "#ff5a4e",
      "--temp": "#69b4f0",
      "--magic": "#c49bff",
      "--shadow-lg": "0 24px 60px -24px rgb(0 0 0 / 0.75)",
      "--shadow-md": "0 10px 30px -12px rgb(0 0 0 / 0.65)",
      "--inner-hi": "inset 0 1px 0 rgb(255 230 210 / 0.05)",
      "--art-shadow": "0 1px 2px rgb(0 0 0 / 0.55), 0 0 14px rgb(0 0 0 / 0.45)",
    },
  },
  {
    id: "parchment",
    name: { en: "Parchment", zh: "羊皮卷" },
    scheme: "light",
    swatch: ["#f3ece0", "#fbf7f0", "#9b3b2f", "#6d4fc2"],
    tokens: {
      "--bg": "#f1e9db",
      "--bg-glow-1": "rgb(190 130 60 / 0.16)",
      "--bg-glow-2": "rgb(155 59 47 / 0.08)",
      "--surface": "#fbf7ef",
      "--surface-2": "#fffdf8",
      "--surface-3": "#ebe0cd",
      "--line": "rgb(70 45 20 / 0.12)",
      "--line-strong": "rgb(70 45 20 / 0.24)",
      "--ink": "#2a1f16",
      "--ink-2": "#6b5a48",
      "--ink-3": "#837261",
      "--accent": "#9b3b2f",
      "--accent-2": "#c0573f",
      "--accent-ink": "#fff7ee",
      "--good": "#2f8f5b",
      "--bad": "#b8322b",
      "--warn": "#b7791f",
      "--info": "#2f6db3",
      "--hp": "#c53030",
      "--temp": "#2b7bb9",
      "--magic": "#6d4fc2",
      "--shadow-lg": "0 24px 50px -24px rgb(80 50 20 / 0.35)",
      "--shadow-md": "0 8px 24px -12px rgb(80 50 20 / 0.3)",
      "--inner-hi": "inset 0 1px 0 rgb(255 255 255 / 0.7)",
      "--art-shadow": "0 0 2px rgb(255 252 245 / 0.9), 0 0 14px rgb(255 252 245 / 0.75)",
    },
  },
];

export const themesPlugin: AppPlugin = {
  manifest: { id: "builtin.themes", version: "1.0.0", name: { en: "Themes", zh: "主题" }, engine: "^0.1.0", kind: "presentation", builtin: true },
  contributes: { themes: THEMES },
};

export function applyTheme(theme: ThemeDef | undefined) {
  const root = document.documentElement;
  if (!theme) return;
  for (const [k, v] of Object.entries(theme.tokens)) root.style.setProperty(k, v);
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.tokens["--bg"] ?? "#0e0f17");
  // dark text in the status bar on light themes
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute("content", theme.scheme === "light" ? "default" : "black-translucent");
  // remembered for index.html, which paints the next launch in this theme before any code loads
  try {
    localStorage.setItem("forge.theme", JSON.stringify({ id: theme.id, scheme: theme.scheme, tokens: theme.tokens }));
  } catch {
    // storage blocked: the next launch starts in the default theme, then switches
  }
}
