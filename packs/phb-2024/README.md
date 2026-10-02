# @forge/pack-phb2024

Player's Handbook 2024 content, built **locally** from the DND5eChm community translation
(<https://github.com/DND5eChm/DND5e_chm>, folder `玩家手册2024/`).

The translation is GPL-3.0, but the underlying text is © Wizards of the Coast. So:

- `scripts/build_phb.py` downloads the pages and writes `src/generated/phb.json`.
  Both the download cache and the generated file are git-ignored. **Never commit them, and never
  deploy a build that contains them to a public host.**
- Everything committed here is code and mechanics (ids, grants, overlays). It contains no PHB prose.
- Without the generated file the pack is simply absent, and the app runs on the SRD alone.

```bash
pnpm --filter @forge/pack-phb2024 generate            # uses the cache
pnpm --filter @forge/pack-phb2024 generate --refresh  # re-download latest
```

Entities reuse the SRD pack's ids and mechanics where they exist, and take their names and text from
the PHB. PHB-only content gets mechanics either from overlays in `src/*.ts` or, for spells, from a
best-effort reading of the prose. The full text is always shown.
