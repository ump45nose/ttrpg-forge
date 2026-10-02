import type { Grant, LocalizedText } from "@forge/core";
import { action, featChoice, t, tag } from "../helpers";

export const asi = (id = "feat"): Grant => featChoice(id, ["general"], t("Ability Score Improvement / Feat", "属性值提升 / 专长"));

export const subclassChoice = (cls: string): Grant => ({
  type: "choice",
  id: "subclass",
  name: t("Subclass", "子职业"),
  count: 1,
  from: { kind: "entity", entityType: "subclass", tags: [cls] },
});

export const LVL = (cls: string) => `@class.${cls}.level`;

export const SIMPLE_MELEE = ["club", "dagger", "greatclub", "handaxe", "javelin", "light-hammer", "mace", "quarterstaff", "sickle", "spear"].map((x) => `item:${x}`);
export const SIMPLE = [...SIMPLE_MELEE, ...["dart", "light-crossbow", "shortbow", "sling"].map((x) => `item:${x}`)];
export const MARTIAL_MELEE = ["battleaxe", "flail", "glaive", "greataxe", "greatsword", "halberd", "lance", "longsword", "maul", "morningstar", "pike", "rapier", "scimitar", "shortsword", "trident", "warhammer", "war-pick", "whip"].map((x) => `item:${x}`);

export const ARTISAN = ["alchemists-supplies", "brewers-supplies", "calligraphers-supplies", "carpenters-tools", "cartographers-tools", "cobblers-tools", "cooks-utensils", "glassblowers-tools", "jewelers-tools", "leatherworkers-tools", "masons-tools", "painters-supplies", "potters-tools", "smiths-tools", "tinkers-tools", "weavers-tools", "woodcarvers-tools"];
export const INSTRUMENTS = ["bagpipes", "drum", "dulcimer", "flute", "horn", "lute", "lyre", "pan-flute", "shawm", "viol"];
export const ALL_SKILLS = ["acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival"];

/** Spell slot level a full caster reaches at each class level (1-20). */
export const FULL_CASTER_MAX = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9];

/** Spells always prepared from a subclass/feature, optionally gated on the class level. */
export const alwaysPrepared = (classLevel: number | undefined, ...ids: string[]): Grant[] =>
  ids.map((id) => ({ type: "spell", spell: `spell:${id}`, alwaysPrepared: true, ...(classLevel ? { classLevel } : {}) }));

/** Elemental Fury (druid 7) / Blessed Strikes (cleric 7) share this shape: a damage rider or cantrip damage. */
export const furyChoice = (id: string, name: LocalizedText, cls: string, strike: { id: string; en: string; zh: string; dice: string; type: string; textEn: string; textZh: string }): Grant => ({
  type: "choice",
  id,
  name,
  count: 1,
  from: {
    kind: "options",
    options: [
      {
        id: "potent-spellcasting",
        name: t("Potent Spellcasting", "强力施法"),
        text: t(`Add your Wisdom modifier to the damage of your ${cls[0]!.toUpperCase()}${cls.slice(1)} cantrips.`, "你的戏法伤害加上感知调整值。"),
        grants: [tag(`potent-spellcasting:${cls}`)],
      },
      {
        id: strike.id,
        name: t(strike.en, strike.zh),
        text: t(strike.textEn, strike.textZh),
        grants: [action({ id: strike.id, name: t(strike.en, strike.zh), activation: "special", category: "feature", tags: ["rider", "once-per-turn"], trigger: t("You hit with a weapon attack", "你以武器攻击命中时"), damage: [{ dice: strike.dice, type: strike.type }] })],
      },
    ],
  },
});
