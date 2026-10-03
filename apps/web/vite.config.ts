import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Forge · Adventurer's Workshop",
        short_name: "Forge",
        description: "D&D 5.5e character builder and table companion",
        theme_color: "#0e0f17",
        background_color: "#0e0f17",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // CJK display font is split into many unicode-range chunks: cache lazily instead of precaching all
        globIgnores: ["**/noto-serif-sc-*"],
        // the bundled rule packs (SRD + locally generated PHB) must be available offline at the table
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // the art pack is large: cache each picture the first time it is shown, never precache
            urlPattern: ({ url }) => url.pathname.startsWith("/art/"),
            handler: "CacheFirst",
            options: { cacheName: "art", expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes("noto-serif-sc-"),
            handler: "CacheFirst",
            options: { cacheName: "cjk-font", expiration: { maxEntries: 200 } },
          },
        ],
        navigateFallback: "/index.html",
      },
    }),
  ],
  server: { port: 5173, host: true },
});
