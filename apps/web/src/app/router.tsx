import { createHashHistory, createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet, useRouterState } from "@tanstack/react-router";
import { motion, MotionConfig } from "motion/react";
import { useEffect } from "react";
import { DiceDock } from "../features/dice/DiceDock";
import { TermLayer } from "../features/terms/TermLayer";
import { FxLayer } from "../ui/Fx";
import { StudioHost } from "../features/media/StudioHost";
import { Library } from "../features/library/Library";
import { SheetPage } from "../features/sheet/SheetPage";
import { ConfirmHost } from "../ui/Confirm";
import { NotFound, RouteError, RoutePending } from "./RouteStates";
import { ToastViewport } from "../ui/Toast";
import { useSettings } from "./settings";
import { PluginPage } from "./PluginPage";
import { Slot } from "./slot";

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
      {/*
        Enter-only page transition. An exit animation would keep the old page mounted while its
        <Outlet/> already renders the new route, then swap in a fresh copy on the next render:
        the first tap on a new page (opening a dialog...) was lost to that remount.
      */}
      <motion.main key={pageKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
        <Outlet />
      </motion.main>
      <DiceDock />
      <TermLayer />
      <FxLayer />
      <Slot name="app.overlay" />
      <StudioHost />
      <ToastViewport />
      <ConfirmHost />
    </MotionConfig>
  );
}

const rootRoute = createRootRoute({ component: Root });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Library });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: lazyRouteComponent(() => import("../features/settings/SettingsPage"), "SettingsPage") });
export const buildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/c/$id/build",
  validateSearch: (s: Record<string, unknown>): { step?: string; focus?: string; from?: "sheet" } => ({
    step: typeof s.step === "string" ? s.step : undefined,
    // opened from the character sheet: "back" returns there
    from: s.from === "sheet" ? "sheet" : undefined,
    // an element to land on, e.g. a class's prepared-spells panel
    focus: typeof s.focus === "string" ? s.focus : undefined,
  }),
  // the builder is only needed between sessions: keep it out of the table-side bundle
  component: lazyRouteComponent(() => import("../features/builder/BuilderPage"), "BuilderPage"),
});
export const pluginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/p/$page", component: PluginPage });
export const sheetRoute = createRoute({ getParentRoute: () => rootRoute, path: "/c/$id", component: SheetPage });

const routeTree = rootRoute.addChildren([indexRoute, settingsRoute, pluginRoute, buildRoute, sheetRoute]);

const hashRouting = import.meta.env.VITE_ROUTER_MODE === "hash";

export const router = createRouter({
  routeTree,
  history: hashRouting ? createHashHistory() : undefined,
  basepath: hashRouting ? undefined : import.meta.env.BASE_URL,
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
  defaultPendingComponent: RoutePending,
  // only show the skeleton when loading is actually slow
  defaultPendingMs: 300,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
