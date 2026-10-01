import { PluginHost, type Plugin } from "@forge/plugin-api";
import { type ComponentType, useSyncExternalStore } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppComponent = ComponentType<any>;
export type AppPlugin = Plugin<AppComponent>;

/** The single plugin host for the app. Built-in features register here too. */
export const host = new PluginHost<AppComponent>();

const subscribe = (cb: () => void) => host.on("plugins:changed", cb);

/** Re-render when plugins are enabled/disabled or contribute. */
export function useHostRevision(): number {
  return useSyncExternalStore(subscribe, () => host.revision);
}
