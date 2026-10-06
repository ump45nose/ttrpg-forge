import type { Character, ConditionEntity, PackRegistry, Sheet } from "@forge/core";

export type QuickBuff = { effect: string; persistent?: boolean };

/** How many switches a suggestion fills at most; players add more themselves. */
const MAX_SUGGESTED = 6;

/** Buff effects players can switch on themselves (not weapon-mastery entries, not conditions). */
export function buffEffects(reg: PackRegistry): ConditionEntity[] {
  return (reg.all("effect") as unknown as ConditionEntity[]).filter((e) => e.tags?.includes("buff"));
}

/**
 * A character's first quick buffs: everyone's (Bless, Guidance), then each class's
 * favourites (`suggest:<class>` on the effect), then buffs matching spells they can cast.
 */
export function suggestedBuffs(reg: PackRegistry, sheet: Sheet): string[] {
  const buffs = buffEffects(reg);
  const by = (tag: string) => buffs.filter((e) => e.tags!.includes(tag)).map((e) => e.id);
  const classes = sheet.classes.map((c) => c.id.replace(/^class:/, ""));
  const spells = new Set(sheet.spells.map((s) => s.spellId.replace(/^spell:/, "")));
  const ids = [...classes.flatMap((c) => by(`suggest:${c}`)), ...by("suggest:all"), ...buffs.filter((e) => spells.has(e.id.replace(/^effect:/, ""))).map((e) => e.id)];
  return [...new Set(ids)].slice(0, MAX_SUGGESTED);
}

/** The switches shown on this character's sheet: their own list, or the suggestion. */
export function quickBuffs(character: Character, reg: PackRegistry, sheet: Sheet): QuickBuff[] {
  const own = character.meta.quickBuffs;
  return (own ?? suggestedBuffs(reg, sheet).map((effect) => ({ effect }))).filter((b) => reg.get(b.effect));
}
