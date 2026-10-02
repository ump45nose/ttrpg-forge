/** Shape of src/generated/phb.json, produced by scripts/build_phb.py. */

export interface PhbNamed {
  en: string;
  zh: string;
}

export interface PhbBenefit {
  zh: string;
  en: string | null;
  text: string;
}

export interface PhbTable {
  title: string;
  rows: string[][];
}

export interface PhbSpell extends PhbNamed {
  anchor: string;
  level: number;
  school: string;
  lists: string[];
  castingTime: string;
  ritual: boolean;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  text: string;
  higher: string | null;
}

export interface PhbFeat extends PhbNamed {
  category: "origin" | "general" | "fighting-style" | "epic-boon";
  prereq: string | null;
  text: string;
  repeatable: boolean;
  asi: string | null;
  benefits: PhbBenefit[];
}

export interface PhbBackground extends PhbNamed {
  text: string;
  abilities: string[];
  feat: string;
  featNote: string | null;
  skills: string[];
  tool: string;
  kit: string[];
  altGold: number;
  equipment: string;
}

export interface PhbSpecies extends PhbNamed {
  text: string;
  creatureType: string | null;
  size: string;
  speed: number;
  traits: PhbBenefit[];
  tables: PhbTable[];
}

export interface PhbItemBase extends PhbNamed {
  cost: string | null;
  weight: number | null;
}

export type PhbItem =
  | (PhbItemBase & {
      kind: "weapon";
      category: "simple" | "martial";
      range: "melee" | "ranged";
      damage: string;
      damageType: string;
      properties: string[];
      propertiesText: string;
      rangeText: string | null;
      versatile: string | null;
      mastery: string | null;
    })
  | (PhbItemBase & { kind: "armor"; category: "light" | "medium" | "heavy" | "shield"; ac: number; strength: number | null; stealthDisadvantage: boolean })
  | (PhbItemBase & { kind: "gear" | "tool"; text: string; variants?: { zh: string; cost: string | null }[]; tables: PhbTable[] });

export interface PhbFeature extends PhbBenefit {
  level: number;
  /** "<b>名Name。</b>" sub-entries inside the feature (Rage rules, Monk's Focus options...). */
  items: PhbBenefit[];
}

export interface PhbOptionList {
  zh: string;
  en: string | null;
  intro: string;
  items: PhbBenefit[];
}

export interface PhbSubclass {
  en: string;
  zh: string;
  summary: string | null;
  text: string;
  features: PhbFeature[];
  options: PhbOptionList[];
}

export interface PhbClass extends PhbNamed {
  summary: string | null;
  text: string;
  /** Core traits table: 主要属性 / 生命值骰 / 豁免熟练 / 技能熟练 / 武器熟练 / 护甲受训 / 起始装备. */
  core: Record<string, string>;
  /** Class features table, header row first. */
  table: string[][];
  features: PhbFeature[];
  options: PhbOptionList[];
  subclasses: PhbSubclass[];
  /** Whole-page option lists (Metamagic, Eldritch Invocations). */
  extras: PhbOptionList[];
}

export interface PhbData {
  source: { repo: string; path: string; commit: string; generatedAt: string };
  spells: PhbSpell[];
  feats: PhbFeat[];
  backgrounds: PhbBackground[];
  species: PhbSpecies[];
  items: PhbItem[];
  masteries?: PhbBenefit[];
  classes?: PhbClass[];
}
