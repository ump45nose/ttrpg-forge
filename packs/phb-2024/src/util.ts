import { DND5E_2024, type Ability, type Activation, type Entity, type Grant, type LocalizedText } from "@forge/core";

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** English from the SRD when we have it, otherwise the Chinese text stands in for both locales. */
export const bi = (en: string | undefined, zh: string): LocalizedText => ({ en: en ?? zh, zh });

export const enOf = (t: LocalizedText | undefined): string | undefined => (t === undefined ? undefined : typeof t === "string" ? t : t.en);

export const ABILITY_ZH: Record<string, Ability> = { 力量: "str", 敏捷: "dex", 体质: "con", 智力: "int", 感知: "wis", 魅力: "cha" };

export const SKILL_ZH: Record<string, string> = Object.fromEntries(
  Object.entries(DND5E_2024.skills).map(([k, v]) => [typeof v.name === "string" ? v.name : v.name.zh!, k]),
);

export const DAMAGE_ZH: Record<string, string> = {
  强酸: "acid", 钝击: "bludgeoning", 寒冷: "cold", 火焰: "fire", 力场: "force", 闪电: "lightning", 暗蚀: "necrotic", 黯蚀: "necrotic",
  穿刺: "piercing", 毒素: "poison", 心灵: "psychic", 光耀: "radiant", 挥砍: "slashing", 雷鸣: "thunder",
};

export const SCHOOL_ZH: Record<string, string> = {
  防护: "abjuration", 咒法: "conjuration", 预言: "divination", 惑控: "enchantment", 塑能: "evocation", 幻术: "illusion", 死灵: "necromancy", 变化: "transmutation",
};

/** Class spell list names -> list tags used by spellcasting choices. */
export const LIST_ZH: Record<string, string> = {
  吟游诗人: "bard", 牧师: "cleric", 德鲁伊: "druid", 圣武士: "paladin", 游侠: "ranger", 术士: "sorcerer", 魔契师: "warlock", 法师: "wizard",
};

export function activationOf(cast: string): Activation {
  if (/^附赠动作/.test(cast)) return "bonus";
  if (/^反应/.test(cast)) return "reaction";
  if (/^动作/.test(cast)) return "action";
  if (/分钟/.test(cast)) return "minute";
  if (/小时/.test(cast)) return "hour";
  return "special";
}

/** Rough English for spell header fields that only exist in Chinese. */
export function headerEn(zh: string): string {
  return zh
    .replace(/^附赠动作/, "Bonus Action")
    .replace(/^反应/, "Reaction")
    .replace(/^动作/, "Action")
    .replace(/或仪式/, " or Ritual")
    .replace(/专注，至多/, "Concentration, up to ")
    .replace(/(\d+)\s*尺/g, "$1 ft")
    .replace(/(\d+)\s*里/g, "$1 miles")
    .replace(/(\d+)\s*分钟/g, "$1 minute(s)")
    .replace(/(\d+)\s*小时/g, "$1 hour(s)")
    .replace(/(\d+)\s*天/g, "$1 day(s)")
    .replace(/^自身/, "Self")
    .replace(/^触及/, "Touch")
    .replace(/^立即/, "Instantaneous")
    .replace(/^视野/, "Sight")
    .replace(/^无限/, "Unlimited")
    .replace(/直到被解除/, "Until dispelled")
    .replace(/、/g, ", ");
}

/** Depth-first walk over grants, including feature children and choice options. */
export function walkGrants(grants: Grant[] | undefined, fn: (g: Grant, parent?: Grant) => void, parent?: Grant) {
  for (const g of grants ?? []) {
    fn(g, parent);
    if (g.type === "feature") walkGrants(g.grants, fn, g);
    if (g.type === "choice" && g.from.kind === "options") for (const o of g.from.options) walkGrants(o.grants, fn, g);
  }
}

export const clone = <T>(x: T): T => structuredClone(x);

export type Overlay = Partial<Entity> & { grants?: Grant[] };
