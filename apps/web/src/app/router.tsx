import { createRootRoute, createRoute, createRouter, Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect } from "react";
import { BuilderPage } from "../features/builder/BuilderPage";
import { DiceDock } from "../features/dice/DiceDock";
import { TermLayer } from "../features/terms/TermLayer";
import { Library } from "../features/library/Library";
import { SettingsPage } from "../features/settings/SettingsPage";
import { SheetPage } from "../features/sheet/SheetPage";
import { ToastViewport } from "../ui/Toast";
import { useSettings } from "./settings";

function Root() {
  const motionPref = useSettings((s) => s.motion);
  const path = useRouterState({ select: (s) => s.location.pathname });
  // top-level page key: builder sub-steps animate inside the page instead
  const pageKey = path.replace(/\/build.*$/, "/build");
  useEffect(() => {
    document.documentElement.dataset.motion = motionPref;
  }, [motionPref]);
  return (
    <MotionConfig reducedMotion={motionPref === "system" ? "user" : motionPref === "reduced" ? "always" : "never"}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={pageKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <DiceDock />
      <TermLayer />
      <ToastViewport />
    </MotionConfig>
  );
}

const rootRoute = createRootRoute({ component: Root });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Library });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });
export const buildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/c/$id/build",
  validateSearch: (s: Record<string, unknown>): { step?: string } => ({ step: typeof s.step === "string" ? s.step : undefined }),
  component: BuilderPage,
});
export const sheetRoute = createRoute({ getParentRoute: () => rootRoute, path: "/c/$id", component: SheetPage });

const routeTree = rootRoute.addChildren([indexRoute, settingsRoute, buildRoute, sheetRoute]);

export const router = createRouter({ routeTree, defaultPreload: "intent", scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
