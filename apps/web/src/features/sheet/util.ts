import { EXHAUSTION, type ActiveEffect, type Engine, type LocalizedText, type Sheet } from "@forge/core";

/** "1d20+5" / "1d20-1". */
export const d20 = (mod: number) => (mod >= 0 ? `1d20+${mod}` : `1d20-${-mod}`);

/** Advantage / Disadvantage from sheet tags: `adv:save.dex`, `adv:check.str`, `adv:skill.athletics`, `dis:...`. */
export function edge(sheet: Sheet, ...keys: string[]): { advantage: boolean; disadvantage: boolean } {
  const has = (p: string) => keys.some((k) => sheet.tags.includes(`${p}:${k}`));
  return { advantage: has("adv"), disadvantage: has("dis") };
}

/** Display name of an active effect: its entity, the spell/action it marks, or its free-form label. */
export function effectName(engine: Engine, sheet: Sheet, e: Pick<ActiveEffect, "effect" | "label" | "source">): LocalizedText {
  const ent = engine.reg.get(e.effect);
  if (ent) return ent.name;
  const action = sheet.actions.find((a) => a.id === e.effect || a.id === e.source);
  if (action) return action.name;
  return e.label ?? e.effect;
}

/** Effects grouped for display; Exhaustion stacks into one chip with a level. */
export function groupEffects(effects: ActiveEffect[]): { effect: ActiveEffect; count: number }[] {
  const out: { effect: ActiveEffect; count: number }[] = [];
  for (const e of effects) {
    const prev = e.effect === EXHAUSTION ? out.find((x) => x.effect.effect === EXHAUSTION) : undefined;
    if (prev) prev.count++;
    else out.push({ effect: e, count: 1 });
  }
  return out;
}
