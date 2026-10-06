---
name: forge-content
description: Write or change ttrpg-forge rule content — a rule-pack JSON (house rules, feats, items, species, backgrounds, classes, subclasses, spells, patches, point-buy and other systemConfig), or built-in SRD content in packs/srd-5.2.1. Use when the user asks to add/modify D&D rules, homebrew, items for the shop, or to fix a pack that fails validation.
---

# Writing rule content for Forge

Read `docs/authoring.md` first — it is the authoritative guide (pack shape, entity fields, grants, tags, formula references, patches, recipes). Copy `docs/examples/house-rules.json` as a starting point.

## Where things are
- Types: `packages/core/src/schema/types.ts`; import validation: `packages/core/src/schema/zod.ts`.
- Formula language and allowed `@refs`: `packages/core/src/formula/index.ts`, stat definitions in `packages/core/src/derive/sheet.ts` (search `stats.define`).
- Real examples to imitate: `packs/srd-5.2.1/src/` (`feats.ts`, `items.ts`, `species.ts`, `backgrounds.ts`, `classes/*.ts`, `spells.ts`), helpers in `helpers.ts`.
- Pack checker: `packages/core/src/pack/check.ts`; its tests `packs/srd-5.2.1/test/pack-check.test.ts`.

## Rules
1. Ids are `<type>:<name>`; use a `house-` (or the table's) prefix for homebrew so it never collides with official ids. Same id in a later pack **replaces** the whole entity — prefer `patches` for small edits.
2. Every `LocalizedText` needs `en`; give `zh` too (the app is Chinese-first).
3. Things players must remember at the table (riders, once-per-turn) get tags `rider` / `once-per-turn`; shop goods get `shop:<general|smith|apothecary|arcane|crafts>` and a `cost` like `"10 GP"`.
4. Never commit PHB-derived text: nothing from `packs/phb-2024/src/generated/` or the DND5eChm translation may be copied into tracked files. Built-in content in `packs/srd-5.2.1` must come from SRD 5.2.1 (CC-BY-4.0) only.
5. Mechanics the engine cannot express (situational advantage, conditions' side effects) go in `text` plus a `feature` with tags — don't fake them with always-on modifiers.

## Before you say it's done
```bash
pnpm validate:pack path/to/pack.json   # must print ✓ with no errors; read every warning
pnpm test                               # when you touched packs/srd-5.2.1 or packages/core
```
`validate:pack` reports unknown `@refs` as warnings (they silently evaluate to 0 in the app) — treat them as bugs. For built-in classes/species, add or extend a test in `packs/srd-5.2.1/test/`.
