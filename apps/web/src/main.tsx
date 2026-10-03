import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useCharacters } from "./app/characters";
import { host } from "./app/host";
import "./app/i18n";
import { loadBasePacks, usePacks } from "./app/packs";
import { router } from "./app/router";
import { loadCueSounds } from "./app/sound";
import { useSettings } from "./app/settings";
import { BUILTIN_PLUGINS } from "./plugins";
import { applyTheme } from "./plugins/themes";
import "./styles/index.css";

// built-in features are plugins too
const disabled = new Set(useSettings.getState().disabledPlugins);
for (const p of BUILTIN_PLUGINS) host.register(p, !disabled.has(p.manifest.id));

const syncTheme = () => applyTheme(host.get("themes").find((t) => t.id === useSettings.getState().theme) ?? host.get("themes")[0]);
syncTheme();
useSettings.subscribe((s, prev) => s.theme !== prev.theme && syncTheme());
host.on("plugins:changed", syncTheme);

await Promise.all([useCharacters.getState().load(), usePacks.getState().load(), loadBasePacks(), loadCueSounds().catch(() => undefined)]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
