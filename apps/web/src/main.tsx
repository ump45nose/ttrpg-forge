import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useCharacters } from "./app/characters";
import { host } from "./app/host";
import { i18n } from "./app/i18n";
import { loadBasePacks, usePacks } from "./app/packs";
import { clearStaleChunkFlag, reloadForStaleChunk } from "./app/RouteStates";
import { router } from "./app/router";
import { loadCueSounds } from "./app/sound";
import { useSettings } from "./app/settings";
import { BUILTIN_PLUGINS } from "./plugins";
import { applyTheme } from "./plugins/themes";
import "./styles/index.css";
import { toast } from "./ui/Toast";

// built-in features are plugins too
const disabled = new Set(useSettings.getState().disabledPlugins);
for (const p of BUILTIN_PLUGINS) host.register(p, !disabled.has(p.manifest.id));

const syncTheme = () => applyTheme(host.get("themes").find((t) => t.id === useSettings.getState().theme) ?? host.get("themes")[0]);
syncTheme();
useSettings.subscribe((s, prev) => s.theme !== prev.theme && syncTheme());
host.on("plugins:changed", syncTheme);

// a tab left open across a deploy: its old code chunks are gone, so load the new version (once)
window.addEventListener("vite:preloadError", (e) => {
  if (reloadForStaleChunk()) e.preventDefault();
});

const root = createRoot(document.getElementById("root")!);

async function boot() {
  try {
    await Promise.all([useCharacters.getState().load(), usePacks.getState().load(), loadBasePacks(), loadCueSounds().catch(() => undefined)]);
  } catch (e) {
    // private mode, blocked storage...: say so instead of a blank page
    console.error(e);
    root.render(<BootError onRetry={() => void boot()} />);
    return;
  }
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  clearStaleChunkFlag();
}
await boot();

if (import.meta.env.PROD && "serviceWorker" in navigator) void registerServiceWorker();

/** A new version waits until the user says so, instead of swapping code under an open sheet. */
async function registerServiceWorker() {
  const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
  if (!reg) return;
  const offer = (waiting: ServiceWorker) =>
    toast({ content: i18n.t("app.updateReady"), tone: "accent", action: { label: i18n.t("app.updateNow"), run: () => waiting.postMessage({ type: "SKIP_WAITING" }) } }, 10 * 60_000);
  // the first install has nothing to replace; later ones do
  if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const next = reg.installing;
    next?.addEventListener("statechange", () => {
      if (next.state === "installed" && navigator.serviceWorker.controller) offer(next);
    });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

function BootError({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: "var(--ink)" }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>{i18n.t("app.bootFailed")}</h1>
        <p style={{ marginTop: 8, color: "var(--ink-2)", fontSize: 14 }}>{i18n.t("app.bootFailedHint")}</p>
        <button type="button" onClick={onRetry} style={{ marginTop: 20, padding: "10px 20px", borderRadius: 12, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 600 }}>
          {i18n.t("app.retry")}
        </button>
      </div>
    </div>
  );
}
