import type { Ability, CasterProgression } from "../schema/types";
import type { LocalizedText } from "../text";

/**
 * Pure-data part of a ruleset: every number a house rule might change. Packs
 * override any of it through `RulePack.systemConfig` (deep-merged in load order).
 */
export interface GameSystemData {
  id: string;
  name: LocalizedText;
  abilities: readonly Ability[];
  skills: Record<string, { ability: Ability; name: LocalizedText }>;
  /** Proficiency bonus by character level (index 0 = level 1). */
  profTable: number[];
  /** Full-caster slots by caster level (index = caster level; entry index 0 = 1st-level slots). */
  slotTable: number[][];
  /** Warlock pact slots by warlock level (index 0 = level 1). */
  pactTable: { count: number; level: number }[];
  /** Character levels at which cantrip damage gains another die. */
  cantripSteps: number[];
  pointBuy: { budget: number; min: number; max: number; cost: Record<number, number> };
  standardArray: number[];
  maxLevel: number;
  abilityCap: number;
  hp: {
    /** Hit points gained at character level 1 ("max" = full hit die). */
    firstLevel: "max" | "average";
    /** Default per-level gain when not rolling. */
    levelUp: "average" | "max";
  };
}

/** Everything the engine asks of a ruleset. Built from data by `makeSystem`. */
export interface GameSystem extends GameSystemData {
  profBonus(level: number): number;
  /** Slots per spell level (index 0 = 1st level) for a combined caster level. */
  slots(casterLevel: number): number[];
  pactSlots(warlockLevel: number): { count: number; level: number };
  casterLevel(progression: CasterProgression, classLevel: number, multiclass: boolean): number;
  cantripTier(characterLevel: number): number;
}

type DeepPartial<T> = T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
/** House-rule overrides of a system; arrays replace, objects merge. */
export type SystemConfig = DeepPartial<Omit<GameSystemData, "id">>;

export function makeSystem(data: GameSystemData): GameSystem {
  const clampLevel = (lvl: number, len: number) => Math.min(len - 1, Math.max(0, lvl));
  return {
    ...data,
    profBonus: (level) => data.profTable[clampLevel(level - 1, data.profTable.length)] ?? 2,
    slots: (cl) => [...(data.slotTable[clampLevel(cl, data.slotTable.length)] ?? [])],
    pactSlots: (lvl) => (lvl < 1 ? { count: 0, level: 0 } : { ...(data.pactTable[clampLevel(lvl - 1, data.pactTable.length)] ?? { count: 0, level: 0 }) }),
    casterLevel: (prog, lvl, multiclass) => {
      switch (prog) {
        case "full":
          return lvl;
        case "half":
          return Math.ceil(lvl / 2);
        case "third":
          return lvl < 3 ? 0 : multiclass ? Math.floor(lvl / 3) : Math.ceil(lvl / 3);
        default:
          return 0;
      }
    },
    cantripTier: (lvl) => 1 + data.cantripSteps.filter((s) => lvl >= s).length,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch) || !isPlainObject(base)) return (patch === undefined ? base : (patch as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

/** Apply pack overrides on top of a base system. */
export function configureSystem(base: GameSystem, configs: (SystemConfig | undefined)[]): GameSystem {
  const live = configs.filter((c): c is SystemConfig => !!c && Object.keys(c).length > 0);
  if (!live.length) return base;
  const data = live.reduce<GameSystemData>((acc, c) => deepMerge(acc, c), dataOf(base));
  return makeSystem(data);
}

function dataOf(s: GameSystem): GameSystemData {
  const { profBonus: _a, slots: _b, pactSlots: _c, casterLevel: _d, cantripTier: _e, ...data } = s;
  return data;
}

const FULL_CASTER: number[][] = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export const ABILITY_NAMES: Record<Ability, { en: string; zh: string; abbr: { en: string; zh: string } }> = {
  str: { en: "Strength", zh: "力量", abbr: { en: "STR", zh: "力" } },
  dex: { en: "Dexterity", zh: "敏捷", abbr: { en: "DEX", zh: "敏" } },
  con: { en: "Constitution", zh: "体质", abbr: { en: "CON", zh: "体" } },
  int: { en: "Intelligence", zh: "智力", abbr: { en: "INT", zh: "智" } },
  wis: { en: "Wisdom", zh: "感知", abbr: { en: "WIS", zh: "感" } },
  cha: { en: "Charisma", zh: "魅力", abbr: { en: "CHA", zh: "魅" } },
};

export const SKILLS_5E: GameSystem["skills"] = {
  acrobatics: { ability: "dex", name: { en: "Acrobatics", zh: "特技" } },
  "animal-handling": { ability: "wis", name: { en: "Animal Handling", zh: "驯兽" } },
  arcana: { ability: "int", name: { en: "Arcana", zh: "奥秘" } },
  athletics: { ability: "str", name: { en: "Athletics", zh: "运动" } },
  deception: { ability: "cha", name: { en: "Deception", zh: "欺瞒" } },
  history: { ability: "int", name: { en: "History", zh: "历史" } },
  insight: { ability: "wis", name: { en: "Insight", zh: "洞悉" } },
  intimidation: { ability: "cha", name: { en: "Intimidation", zh: "威吓" } },
  investigation: { ability: "int", name: { en: "Investigation", zh: "调查" } },
  medicine: { ability: "wis", name: { en: "Medicine", zh: "医药" } },
  nature: { ability: "int", name: { en: "Nature", zh: "自然" } },
  perception: { ability: "wis", name: { en: "Perception", zh: "察觉" } },
  performance: { ability: "cha", name: { en: "Performance", zh: "表演" } },
  persuasion: { ability: "cha", name: { en: "Persuasion", zh: "游说" } },
  religion: { ability: "int", name: { en: "Religion", zh: "宗教" } },
  "sleight-of-hand": { ability: "dex", name: { en: "Sleight of Hand", zh: "巧手" } },
  stealth: { ability: "dex", name: { en: "Stealth", zh: "隐匿" } },
  survival: { ability: "wis", name: { en: "Survival", zh: "求生" } },
};

export const DND5E_2024: GameSystem = makeSystem({
  id: "dnd5e-2024",
  name: { en: "D&D 5e (2024)", zh: "D&D 5.5e（2024）" },
  abilities: ["str", "dex", "con", "int", "wis", "cha"],
  skills: SKILLS_5E,
  profTable: Array.from({ length: 20 }, (_, i) => 2 + Math.floor(i / 4)),
  slotTable: FULL_CASTER,
  pactTable: Array.from({ length: 20 }, (_, i) => {
    const lvl = i + 1;
    return { count: lvl >= 17 ? 4 : lvl >= 11 ? 3 : lvl >= 2 ? 2 : 1, level: Math.min(5, Math.ceil(lvl / 2)) };
  }),
  cantripSteps: [5, 11, 17],
  pointBuy: { budget: 27, min: 8, max: 15, cost: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 } },
  standardArray: [15, 14, 13, 12, 10, 8],
  maxLevel: 20,
  abilityCap: 20,
  hp: { firstLevel: "max", levelUp: "average" },
});

export const SYSTEMS: Record<string, GameSystem> = { [DND5E_2024.id]: DND5E_2024 };

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

export function pointBuyCost(scores: Record<Ability, number>, sys: GameSystem = DND5E_2024): number | null {
  let total = 0;
  for (const a of sys.abilities) {
    const c = sys.pointBuy.cost[scores[a]];
    if (c === undefined) return null;
    total += c;
  }
  return total;
}

export const LANGUAGES_5E: Record<string, { name: { en: string; zh: string }; rare?: boolean }> = {
  common: { name: { en: "Common", zh: "通用语" } },
  "common-sign": { name: { en: "Common Sign Language", zh: "通用手语" } },
  draconic: { name: { en: "Draconic", zh: "龙语" } },
  dwarvish: { name: { en: "Dwarvish", zh: "矮人语" } },
  elvish: { name: { en: "Elvish", zh: "精灵语" } },
  giant: { name: { en: "Giant", zh: "巨人语" } },
  gnomish: { name: { en: "Gnomish", zh: "侏儒语" } },
  goblin: { name: { en: "Goblin", zh: "地精语" } },
  halfling: { name: { en: "Halfling", zh: "半身人语" } },
  orc: { name: { en: "Orc", zh: "兽人语" } },
  abyssal: { name: { en: "Abyssal", zh: "深渊语" }, rare: true },
  celestial: { name: { en: "Celestial", zh: "天界语" }, rare: true },
  "deep-speech": { name: { en: "Deep Speech", zh: "深潜语" }, rare: true },
  druidic: { name: { en: "Druidic", zh: "德鲁伊语" }, rare: true },
  infernal: { name: { en: "Infernal", zh: "炼狱语" }, rare: true },
  primordial: { name: { en: "Primordial", zh: "原初语" }, rare: true },
  sylvan: { name: { en: "Sylvan", zh: "木族语" }, rare: true },
  "thieves-cant": { name: { en: "Thieves' Cant", zh: "盗贼黑话" }, rare: true },
  undercommon: { name: { en: "Undercommon", zh: "地底通用语" }, rare: true },
};
