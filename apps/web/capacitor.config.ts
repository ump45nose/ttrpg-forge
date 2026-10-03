import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The web build (apps/web/dist) is wrapped as a native app. The PWA service worker is
 * unnecessary here (assets ship inside the APK), but harmless if it registers.
 */
const config: CapacitorConfig = {
  appId: "io.forge.workshop",
  appName: "Forge",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
