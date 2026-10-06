---
name: forge-plugin
description: Build a ttrpg-forge plugin — themes, art packs, sound packs, bundled rule packs, or UI contributed through slots (app.page, app.overlay, settings.section, library.action, builder.toolbar, sheet.panel). Use when the user wants a new screen, widget, theme or integration in the Forge web app rather than new rule data.
---

# Writing a Forge plugin

Read section 6 of `docs/authoring.md` first. Rule data alone belongs in a rule pack (see the `forge-content` skill), not a plugin.

## Where things are
- Contract: `packages/plugin-api/src/index.ts` (`Plugin`, `Contributions`, `PluginHost`).
- Host instance and the React-typed `AppPlugin`: `apps/web/src/app/host.ts`; slots render via `apps/web/src/app/slot.tsx`; `app.page` routes at `/p/<slot id>` (`apps/web/src/app/PluginPage.tsx`).
- Registration: `apps/web/src/plugins/index.ts` (`BUILTIN_PLUGINS`), loaded in `apps/web/src/main.tsx`; users toggle plugins in Settings → Plugins.
- Examples: `apps/web/src/plugins/themes.ts` (data only), `plugins/art/` (art pack), `plugins/workshop/` (full UI plugin with page, overlay, settings entry, toolbar buttons and `setup()` teardown).

## Rules
1. Only these contributions are wired: `rulePacks`, `themes`, `art`, `sounds`, `slots`. `locales`, `actionFx`, `diceRenderers`, `importers`, `exporters` and the host events `play:committed` / `dice:rolled` / `theme:changed` exist in the types but do nothing yet — if a feature needs one, wire it in the host (and update `docs/authoring.md`) instead of assuming it works.
2. A plugin must work disabled: everything it adds goes through contributions or the teardown returned by `setup()`. Never import plugin code from core features.
3. `sheet.panel` components receive `character`, `sheet`, `state`; change game state only by pushing play events through the sheet's `usePlay().push` — never mutate the build or log directly.
4. UI follows the app: Tailwind tokens (`text-ink`, `bg-surface`, `border-line`, `text-accent`…), components from `apps/web/src/ui/`, strings in `apps/web/src/locales/{zh,en}.ts`, phone-first (check at 375 px, touch targets ≥ 32 px).
5. Don't run prettier (no config; it rewrites whole files). Don't commit `apps/web/dist`, `tools/art/raw/` or PHB-generated data.

## Before you say it's done
```bash
pnpm typecheck && pnpm test
pnpm e2e        # add a Playwright test in apps/web/e2e/ for any new UI
```
Then check it in the browser preview at phone width, including with the plugin disabled in Settings → Plugins.
