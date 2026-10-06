import type { SourceRef } from "../build/collect";
import { parseDice } from "../dice";
import type { Ability, RollKind } from "../schema/types";
import { ABILITY_NAMES } from "../system/dnd5e";
import { localize, type LocalizedText } from "../text";
import type { ResolvedAction, Sheet } from "./sheet";

/**
 * One piece of a roll as said at the table: "1d20", "+3 Strength modifier", "+1d4 Bless".
 * Players who roll real dice read these instead of typing their result into the app.
 */
export interface RollPart {
  /** Dice to roll ("1d20", "1d12", "-1d4"); absent for a flat number. */
  dice?: string;
  value?: number;
  label: LocalizedText;
  damageType?: string;
  /** Comes from an effect or feat (Bless, Hunter's Mark, Great Weapon Master): the player may leave it out. */
  bonus?: boolean;
  /** Used up when added (Bardic Inspiration). */
  once?: boolean;
  source?: SourceRef;
}

const L = (en: string, zh: string): LocalizedText => ({ en, zh });
const D20 = L("d20", "d20");
const PROF = L("Proficiency bonus", "熟练加值");
const modLabel = (a: Ability) => L(`${ABILITY_NAMES[a].en} modifier`, `${ABILITY_NAMES[a].zh}调整值`);

/** The active modifiers behind a stat, as parts (a winning override / floor stands alone). */
function statParts(sheet: Sheet, stat: string): RollPart[] {
  const list = sheet.explain(stat).filter((c) => c.active && !c.superseded && c.value !== 0);
  const win = list.find((c) => c.op === "override" || c.op === "atLeast");
  return (win ? [win] : list).map((c) => ({ value: c.value, label: c.label, source: c.source }));
}

/** Flat parts add up to the known total; anything unaccounted for gets its own line. */
function reconcile(parts: RollPart[], total: number, label: LocalizedText): RollPart[] {
  const rest = total - flatTotal(parts);
  return rest ? [...parts, { value: rest, label }] : parts;
}

export function flatTotal(parts: RollPart[]): number {
  return parts.reduce((s, p) => s + (p.dice ? 0 : (p.value ?? 0)), 0);
}

/** Effect / feat dice for this kind of roll (Bless on attacks, Hunter's Mark on damage...). */
function bonusDice(sheet: Sheet, on: RollKind, kind?: "melee" | "ranged" | "spell", properties: string[] = []): RollPart[] {
  return sheet.dice
    .filter((d) => d.on.includes(on) && (!d.kinds || (kind && d.kinds.includes(kind))) && (!d.properties || d.properties.every((p) => properties.includes(p))))
    .map((d) => {
      const flat = /^-?\d+$/.test(d.dice);
      return { ...(flat ? { value: Number(d.dice) } : { dice: d.dice }), label: d.label, damageType: d.damageType, bonus: true, once: d.once, source: d.source };
    });
}

/** The attack roll: d20 + ability + proficiency + bonuses + effect dice. */
export function attackParts(sheet: Sheet, a: ResolvedAction): RollPart[] {
  if (!a.attack) return [];
  const d20: RollPart = { dice: "1d20", label: D20 };
  let parts: RollPart[] = [];
  const w = a.weapon;
  const ability = w?.ability ?? a.spell?.ability;
  if (ability) {
    const mod = w ? w.mod : sheet.abilities[ability].mod;
    if (mod) parts.push({ value: mod, label: modLabel(ability) });
    if (!w || w.proficient) parts.push({ value: sheet.prof, label: PROF });
    parts.push(...statParts(sheet, w ? `attack.${a.attack.kind}` : "spell.attack"));
  }
  parts = reconcile(parts, a.attack.bonus, ability ? L("Other bonuses", "其他加值") : L("Attack bonus", "命中加值"));
  return [d20, ...parts, ...bonusDice(sheet, "attack", a.attack.kind, w?.properties)];
}

/** Flat part of a dice expression ("1d8+3" → 3). */
const flatOf = (expr: string) => parseDice(expr).reduce((s, t) => s + (t.kind === "const" ? t.sign * t.value : 0), 0);

function diceOf(expr: string, label: LocalizedText, damageType?: string): RollPart[] {
  return parseDice(expr).flatMap((t) => (t.kind === "dice" ? [{ dice: `${t.sign < 0 ? "-" : ""}${t.count}d${t.sides}`, label, damageType }] : []));
}

/**
 * The damage roll: weapon die + ability + bonuses (Rage, Dueling...) + effect dice on a hit.
 * `upcast` is the extra dice from a higher slot.
 */
export function damageParts(sheet: Sheet, a: ResolvedAction, opts: { versatile?: boolean; upcast?: string } = {}): RollPart[] {
  if (!a.damage?.length) return [];
  const w = a.weapon;
  let parts: RollPart[];
  if (w) {
    const type = a.damage[0]!.type;
    const die = (opts.versatile && w.versatileDie) || w.die;
    const flat: RollPart[] = [];
    if (w.mod) flat.push({ value: w.mod, label: modLabel(w.ability) });
    flat.push(...statParts(sheet, `damage.${a.attack?.kind ?? "melee"}`));
    const expr = opts.versatile && w.versatile ? w.versatile : a.damage[0]!.dice;
    parts = [...diceOf(die, L("Weapon damage die", "武器伤害骰"), type), ...reconcile(flat, flatOf(expr), L("Other bonuses", "其他加值"))];
  } else {
    const spellMod = a.spell?.ability ? sheet.abilities[a.spell.ability].mod : undefined;
    parts = a.damage.flatMap((d) => {
      const flat = flatOf(d.dice);
      const label = flat === spellMod && a.spell?.ability ? modLabel(a.spell.ability) : L("Bonus", "加值");
      return [...diceOf(d.dice, L("Damage dice", "伤害骰"), d.type), ...(flat ? [{ value: flat, label }] : [])];
    });
  }
  if (opts.upcast) parts.push(...diceOf(opts.upcast, L("Higher-level slot", "升环"), a.damage[0]!.type));
  // effect dice ride on hits: only for attacks
  if (a.attack) parts.push(...bonusDice(sheet, "damage", a.attack.kind, w?.properties));
  return parts;
}

/** A d20 test from a stat: "save.dex", "skill.stealth", "ability.str.mod" (a plain check), "initiative". */
export function testParts(sheet: Sheet, stat: string, roll: "check" | "save"): RollPart[] {
  const parts = reconcile(statParts(sheet, stat), sheet.stats.get(stat), L("Other bonuses", "其他加值"));
  return [{ dice: "1d20", label: D20 }, ...parts, ...bonusDice(sheet, roll)];
}

/** "1d20 + 1d4 + 5" — the parts as one expression the dice roller understands. */
export function partsExpr(parts: RollPart[]): string {
  const dice = parts.filter((p) => p.dice).map((p) => p.dice!);
  const flat = flatTotal(parts);
  const expr = [...dice, ...(flat || !dice.length ? [String(flat)] : [])].join("+");
  return expr.replace(/\+-/g, "-");
}

/**
 * What can still be added once this attack hits: Sneak Attack, smite spells, Colossus Slayer...
 * Riders are actions tagged `rider`; those triggered by something else (Turn Undead) are left out.
 */
export function ridersFor(sheet: Sheet, a: ResolvedAction): ResolvedAction[] {
  if (!a.attack) return [];
  const weapon = !!a.weapon;
  return sheet.actions.filter((r) => {
    if (r.id === a.id || !r.tags.includes("rider") || !r.available) return false;
    if (r.category === "spell") return weapon; // smites: "after hitting with a melee weapon"
    const trigger = localize(r.trigger, "en");
    if (!/\bhit/i.test(trigger)) return false;
    return weapon || !/weapon|unarmed/i.test(trigger);
  });
}
