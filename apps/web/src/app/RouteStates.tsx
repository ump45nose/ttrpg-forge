import { useNavigate, type ErrorComponentProps } from "@tanstack/react-router";
import { Compass, RotateCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { useT } from "./i18n";

const RELOADED = "forge.chunkReload";

/** A tab left open across a deploy asks for code chunks that no longer exist: loading the new version fixes it. */
export const isStaleChunk = (e: unknown) => /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(String((e as Error)?.message ?? e));

/** Reload once per session for a stale chunk; false when that was already tried. */
export function reloadForStaleChunk(): boolean {
  if (sessionStorage.getItem(RELOADED)) return false;
  sessionStorage.setItem(RELOADED, "1");
  location.reload();
  return true;
}
/** After a successful start, a later deploy may reload again. */
export const clearStaleChunkFlag = () => setTimeout(() => sessionStorage.removeItem(RELOADED), 10_000);

function Panel({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="safe-t mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-accent">{icon}</div>
      <h1 className="font-display text-xl text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-2">{hint}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

export function NotFound() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <Panel icon={<Compass size={26} />} title={t("app.notFound")} hint={t("app.notFoundHint")}>
      <Button variant="primary" onClick={() => void navigate({ to: "/" })}>
        {t("app.home")}
      </Button>
    </Panel>
  );
}

export function RouteError({ error }: ErrorComponentProps) {
  const t = useT();
  const navigate = useNavigate();
  if (isStaleChunk(error) && reloadForStaleChunk()) return null;
  return (
    <Panel icon={<TriangleAlert size={26} />} title={t("app.crashed")} hint={t("app.crashedHint")}>
      <Button variant="primary" onClick={() => location.reload()}>
        <RotateCw size={16} /> {t("app.reload")}
      </Button>
      <Button variant="secondary" onClick={() => void navigate({ to: "/" })}>
        {t("app.home")}
      </Button>
    </Panel>
  );
}

/** While a page's code is still loading: a quiet skeleton instead of a blank screen. */
export function RoutePending() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 pt-[calc(env(safe-area-inset-top)+1rem)]" aria-busy="true">
      <div className="h-10 w-1/2 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}
