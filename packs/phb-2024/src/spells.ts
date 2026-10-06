import type { Entity, SpellEntity } from "@forge/core";
import type { PhbSpell } from "./data";
import { ABILITY_ZH, activationOf, bi, DAMAGE_ZH, enOf, headerEn, LIST_ZH, SCHOOL_ZH, slug } from "./util";

const DICE = String.raw`(\d+d\d+(?:\s*[+＋]\s*\d+)?)`;
const DMG_TYPES = Object.keys(DAMAGE_ZH).join("|");

/**
 * Best-effort mechanics from the Chinese prose for spells the SRD pack doesn't model:
 * attack vs save, first damage roll, healing, and per-slot scaling. The text is always
 * shown in full, so a miss here only loses the quick-roll buttons.
 */
export function guessMechanics(sp: PhbSpell): Pick<SpellEntity, "action" | "upcast" | "cantripScaling"> {
  const t = sp.text;
  const action: NonNullable<SpellEntity["action"]> = {};
  if (/(近战|远程)法术攻击/.test(t)) action.attack = { bonus: 0, kind: "spell" };
  const save = new RegExp(`(${Object.keys(ABILITY_ZH).join("|")})豁免`).exec(t);
  if (save && !action.attack) action.save = { ability: ABILITY_ZH[save[1]!]!, dc: 0, onSave: /一半|减半/.test(t) ? "half" : "none" };
  const dmg = new RegExp(`${DICE}\\s*点?\\s*(${DMG_TYPES})伤害`).exec(t);
  if (dmg) action.damage = [{ dice: dmg[1]!.replace(/\s|＋/g, (c) => (c === "＋" ? "+" : "")), type: DAMAGE_ZH[dmg[2]!]! }];
  const heal = new RegExp(`恢复(?:等同于|等于)?\\s*${DICE}\\s*[+＋]\\s*你(?:的)?施法属性调整值`).exec(t);
  if (heal) action.heal = { dice: `${heal[1]} + @spellmod` };

  const out: Pick<SpellEntity, "action" | "upcast" | "cantripScaling"> = {};
  if (Object.keys(action).length) out.action = action;
  if (sp.level === 0 && action.damage) out.cantripScaling = true;
  if (sp.level > 0 && sp.higher) {
    const inc = new RegExp(`(?:增加|提升|额外)\\s*${DICE}`).exec(sp.higher);
    if (inc && action.damage) out.upcast = { damage: inc[1] };
    else if (inc && action.heal) out.upcast = { heal: inc[1] };
  }
  return out;
}

/** Card blurb for PHB-only spells: the first sentence of the text, kept short. */
function blurb(text: string): string {
  const first = text.split(/(?<=。)/)[0]!.trim();
  return first.length > 70 ? `${first.slice(0, 68)}…` : first;
}

export function buildSpells(spells: PhbSpell[], base: Map<string, Entity>): Entity[] {
  return spells.map((sp): Entity => {
    const id = `spell:${slug(sp.en)}`;
    const prev = base.get(id) as SpellEntity | undefined;
    const lists = sp.lists.map((l) => LIST_ZH[l]).filter((x): x is string => !!x);
    const extraTags = (prev?.tags ?? []).filter((t) => !Object.values(LIST_ZH).includes(t));
    return {
      ...(prev ?? guessMechanics(sp)),
      id,
      type: "spell",
      name: bi(enOf(prev?.name) ?? sp.en, sp.zh),
      summary: prev?.summary ?? bi(undefined, blurb(sp.text)),
      level: sp.level,
      school: SCHOOL_ZH[sp.school] ?? prev?.school ?? sp.school,
      castingTime: bi(enOf(prev?.castingTime) ?? headerEn(sp.castingTime), sp.castingTime),
      activation: prev?.activation ?? activationOf(sp.castingTime),
      range: bi(enOf(prev?.range) ?? headerEn(sp.range), sp.range),
      components: headerEn(sp.components).replace(/（/g, " (").replace(/）/g, ")"),
      duration: bi(enOf(prev?.duration) ?? headerEn(sp.duration), sp.duration),
      concentration: sp.concentration || undefined,
      ritual: sp.ritual || undefined,
      // smites are cast after a weapon hit: riders on weapon attacks
      tags: [...new Set([...lists, ...extraTags, ...(/-smite$/.test(id) ? ["rider"] : [])])],
      // the higher-level paragraph is shown separately
      text: bi(enOf(prev?.text), sp.text.replace(/\n?(升环施法|戏法强化)[。.][^\n]*/, "").trim()),
      higherLevels: sp.higher ? bi(enOf(prev?.higherLevels), sp.higher) : prev?.higherLevels,
    } as SpellEntity;
  });
}
