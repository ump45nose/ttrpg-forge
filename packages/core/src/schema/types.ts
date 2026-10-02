import type { SystemConfig } from "../system/dnd5e";
import type { LocalizedText } from "../text";

/* ───────────────────────── primitives ───────────────────────── */

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

/** A number or a formula string (see formula/). */
export type Formula = string | number;

/* ───────────────────────── grants ─────────────────────────
 * A grant is "something an entity gives you". Entities (class levels, species,
 * feats, items, active effects...) are bags of grants; the engine collects all
 * grants reachable from the build and derives the sheet from them.
 */

/**
 * - add:      value is summed into the stat
 * - atLeast:  stat = max(stat, value)
 * - override: stat = value (highest override wins)
 * - base:     alternative base formula; the highest applicable candidate replaces the default base
 */
export type ModifierOp = "add" | "atLeast" | "override" | "base";

export interface ModifierGrant {
  type: "modifier";
  target: string;
  op?: ModifierOp;
  value: Formula;
  /** Condition formula; the modifier only applies while it evaluates truthy. */
  when?: string;
  label?: LocalizedText;
}

export type ProficiencyKind = "save" | "skill" | "armor" | "weapon" | "tool" | "language" | "mastery";
export type ProficiencyLevel = "half" | "proficient" | "expertise";

export interface ProficiencyGrant {
  type: "proficiency";
  kind: ProficiencyKind;
  key: string;
  level?: ProficiencyLevel;
}

export type RestKind = "short" | "long";

export interface Recovery {
  on: RestKind;
  /** "all" or how many uses come back. */
  amount: "all" | Formula;
}

export interface ResourceGrant {
  type: "resource";
  id: string;
  name: LocalizedText;
  max: Formula;
  recovery: Recovery[];
  icon?: string;
}

export interface ActionGrant {
  type: "action";
  action: ActionDef;
}

export interface FeatureGrant {
  type: "feature";
  id: string;
  name: LocalizedText;
  text?: LocalizedText;
  grants?: Grant[];
  /** Shown on the timeline / combat reminders. */
  tags?: string[];
  /** Character level at which this feature switches on (species traits like Draconic Flight). */
  minLevel?: number;
  /** Level in the granting class at which this switches on (options chosen early that grow later). */
  classLevel?: number;
}

export interface ChoiceOption {
  id: string;
  name: LocalizedText;
  text?: LocalizedText;
  grants: Grant[];
  prereq?: Prereq;
}

export type ChoiceSource =
  | {
      kind: "entity";
      entityType: EntityType;
      /** Explicit candidates; otherwise all entities of the type matching `tags`. */
      ids?: string[];
      /** Candidate must carry every tag listed. */
      tags?: string[];
      /** Candidate must carry at least one of these (spells from several class lists). */
      anyTags?: string[];
      /** Spell choices: candidates' level must be within these bounds. */
      minLevel?: Formula;
      maxLevel?: Formula;
      /** How chosen spells are cast when the choice is not inside a class (feats, species). */
      spell?: { ability?: Ability; alwaysPrepared?: boolean; free?: { max: Formula; recovery: Recovery[] } };
    }
  | { kind: "options"; options: ChoiceOption[] }
  | {
      kind: "proficiency";
      profKind: ProficiencyKind;
      keys: string[] | "any";
      level?: ProficiencyLevel;
      /** Expertise-style choices: candidate must already be proficient. */
      requireProficient?: boolean;
    }
  | {
      kind: "ability";
      abilities: Ability[];
      /** Allowed distributions, e.g. [[2,1],[1,1,1]] for 2024 backgrounds. */
      patterns: number[][];
      /** Score cap after increase (default 20). */
      cap?: number;
    };

export interface ChoiceGrant {
  type: "choice";
  id: string;
  name: LocalizedText;
  text?: LocalizedText;
  count: Formula;
  from: ChoiceSource;
}

/** Grants another entity wholesale (e.g. a background's origin feat). */
export interface EntityGrant {
  type: "grant";
  entity: string;
}

export type CasterProgression = "full" | "half" | "third" | "pact" | "none";

export interface SpellcastingGrant {
  type: "spellcasting";
  classId: string;
  ability: Ability;
  progression: CasterProgression;
  /** Tag carried by spells on this class's list. */
  list: string;
  /** "prepared": choose daily from the class list (cleric); "spellbook": prepare from known (wizard). */
  mode: "prepared" | "spellbook" | "known";
  cantrips?: Formula;
  prepared?: Formula;
}

export interface SpellGrant {
  type: "spell";
  spell: string;
  /** Character level required (species/lineage spells at 3rd and 5th level). */
  minLevel?: number;
  /** Level in the granting class required (Circle of the Land spells at druid level 5, 7...). */
  classLevel?: number;
  /** Casting ability override (feats, species spells). */
  ability?: Ability;
  /**
   * Take the casting ability from a tag `spell-ability:<scope>:<ability>` granted elsewhere
   * (e.g. a lineage's "choose Int, Wis or Cha"). Ignored when `ability` is set.
   */
  abilityFrom?: string;
  alwaysPrepared?: boolean;
  /** Free casts without a slot, e.g. "once per long rest". */
  free?: { max: Formula; recovery: Recovery[] };
}

export interface ItemGrant {
  type: "item";
  item: string;
  qty?: number;
  equipped?: boolean;
}

/** Free-form flags: resistances, senses, "unarmored-defense"... Read in formulas as @tag.<name>. */
export interface TagGrant {
  type: "tag";
  tag: string;
  label?: LocalizedText;
}

export type Grant =
  | ModifierGrant
  | ProficiencyGrant
  | ResourceGrant
  | ActionGrant
  | FeatureGrant
  | ChoiceGrant
  | EntityGrant
  | SpellcastingGrant
  | SpellGrant
  | ItemGrant
  | TagGrant;

/* ───────────────────────── actions ───────────────────────── */

export type Activation = "action" | "bonus" | "reaction" | "free" | "special" | "minute" | "hour";

export type Cost =
  | { resource: string; amount?: Formula }
  | { slot: number }
  | { economy: "action" | "bonus" | "reaction" };

export interface DamagePart {
  /** Roll template, may contain @refs: "1d8 + @ability.str.mod". */
  dice: string;
  type: string;
}

export interface Duration {
  rounds?: number;
  minutes?: number;
  hours?: number;
  untilRest?: RestKind;
  text?: LocalizedText;
}

export interface ApplyEffect {
  /** Effect or condition entity id. */
  effect: string;
  target: "self" | "target";
  duration?: Duration;
}

export interface ActionDef {
  id: string;
  name: LocalizedText;
  text?: LocalizedText;
  activation: Activation;
  trigger?: LocalizedText;
  cost?: Cost[];
  range?: LocalizedText;
  target?: LocalizedText;
  attack?: { bonus: Formula; kind: "melee" | "ranged" | "spell" };
  save?: { ability: Ability; dc: Formula; onSave?: "half" | "none" };
  damage?: DamagePart[];
  heal?: { dice: string };
  applies?: ApplyEffect[];
  concentration?: boolean;
  duration?: LocalizedText;
  /** Availability formula, e.g. "@class.fighter.level >= 2". */
  when?: string;
  category?: "attack" | "spell" | "feature" | "basic" | "item";
  tags?: string[];
}

/* ───────────────────────── entities ───────────────────────── */

export type EntityType =
  | "class"
  | "subclass"
  | "species"
  | "background"
  | "feat"
  | "spell"
  | "item"
  | "condition"
  | "effect"
  | "rule";

export interface Prereq {
  /** Minimum character level. */
  level?: number;
  /** Formula that must be truthy, e.g. "@ability.str.score >= 13". */
  formula?: string;
  /** Human-readable version shown when unmet. */
  text?: LocalizedText;
}

export interface EntityBase {
  id: string;
  type: EntityType;
  name: LocalizedText;
  /** One-liner for cards. */
  summary?: LocalizedText;
  text?: LocalizedText;
  aliases?: string[];
  tags?: string[];
  prereq?: Prereq;
  grants?: Grant[];
  /** Can be taken more than once (2024 Magic Initiate, ...). */
  repeatable?: boolean;
  art?: string;
  /** Accent colour used by the builder showcase. */
  accent?: string;
  /** Id of the entity this one was cloned from (homebrew). */
  source?: string;
}

export interface ClassEntity extends EntityBase {
  type: "class";
  hitDie: number;
  primaryAbility: Ability[];
  /** Granted only when this is the character's first class. */
  starting: Grant[];
  /** Granted instead of `starting` when multiclassing into this class. */
  multiclass: Grant[];
  levels: Record<string, Grant[]>;
  subclassLevel: number;
}

export interface SubclassEntity extends EntityBase {
  type: "subclass";
  classId: string;
  levels: Record<string, Grant[]>;
}

export interface SpeciesEntity extends EntityBase {
  type: "species";
  size: LocalizedText;
  speed: number;
}

export interface BackgroundEntity extends EntityBase {
  type: "background";
}

export interface FeatEntity extends EntityBase {
  type: "feat";
  category: "origin" | "general" | "fighting-style" | "epic-boon";
}

export interface SpellEntity extends EntityBase {
  type: "spell";
  level: number;
  school: string;
  castingTime: LocalizedText;
  activation: Activation;
  range: LocalizedText;
  components: string;
  duration: LocalizedText;
  concentration?: boolean;
  ritual?: boolean;
  /** Mechanical use; `damage`/`heal` may scale via `upcast` / `cantripScaling`. */
  action?: Omit<ActionDef, "id" | "name" | "activation">;
  upcast?: { damage?: string; heal?: string; text?: LocalizedText };
  /** Cantrip dice multiply at character levels 5/11/17. */
  cantripScaling?: boolean;
  higherLevels?: LocalizedText;
}

export interface WeaponProps {
  category: "simple" | "martial";
  kind: "melee" | "ranged";
  damage: string;
  damageType: string;
  properties: string[];
  versatile?: string;
  range?: string;
  mastery?: string;
}

export interface ArmorProps {
  category: "light" | "medium" | "heavy" | "shield";
  ac: number;
  dexCap?: number;
  strength?: number;
  stealthDisadvantage?: boolean;
}

export interface ItemEntity extends EntityBase {
  type: "item";
  itemType: "weapon" | "armor" | "gear" | "tool" | "pack" | "focus";
  weapon?: WeaponProps;
  armor?: ArmorProps;
  cost?: string;
  weight?: number;
  /** Pack contents. */
  contents?: { item: string; qty?: number }[];
}

export interface ConditionEntity extends EntityBase {
  type: "condition" | "effect";
  icon?: string;
}

/** Glossary term (Advantage, Bonus Action, Cone...). Text may link other terms with {{id}}. */
export interface RuleEntity extends EntityBase {
  type: "rule";
  /** Grouping for the tooltip header: "action", "area", "condition", "hazard", "attitude", "term"... */
  category?: string;
}

export type Entity =
  | RuleEntity
  | ClassEntity
  | SubclassEntity
  | SpeciesEntity
  | BackgroundEntity
  | FeatEntity
  | SpellEntity
  | ItemEntity
  | ConditionEntity;

export type EntityOf<T extends EntityType> = Extract<Entity, { type: T }>;

/* ───────────────────────── packs ───────────────────────── */

export interface RulePack {
  id: string;
  version: string;
  system: string;
  name: LocalizedText;
  license?: string;
  attribution?: LocalizedText;
  /** Packs this pack builds on (homebrew overrides etc.). */
  requires?: string[];
  /** Grants every character of this system receives (basic actions, unarmed strike...). */
  globalGrants?: Grant[];
  entities: Entity[];
  /** House-rule overrides of system numbers (point buy, level cap, tables...). */
  systemConfig?: SystemConfig;
  /** House-rule edits of entities defined by earlier packs. */
  patches?: EntityPatch[];
}

/** Matches grants for removal: every field given must match. */
export interface GrantMatcher {
  type?: Grant["type"];
  /** Feature/choice/resource id, action id, spell/item/entity id or tag. */
  id?: string;
  /** Proficiency key. */
  key?: string;
  /** Modifier target. */
  target?: string;
}

export interface GrantEdits {
  add?: Grant[];
  remove?: GrantMatcher[];
}

/** Partial edit of an existing entity (applied in pack order). */
export interface EntityPatch {
  target: string;
  /** Shallow-merged onto the entity (name, text, hitDie, speed...). */
  set?: Record<string, unknown>;
  grants?: GrantEdits;
  /** Class/subclass level grants, keyed by level. */
  levels?: Record<string, GrantEdits>;
  /** Class starting grants. */
  starting?: GrantEdits;
}

/* ───────────────────────── character ───────────────────────── */

export type AbilityScores = Record<Ability, number>;

export interface InventoryEntry {
  /** Stable instance key. */
  key: string;
  item: string;
  qty: number;
  equipped?: boolean;
  notes?: string;
}

export interface Currency {
  cp?: number;
  sp?: number;
  ep?: number;
  gp?: number;
  pp?: number;
}

export interface Build {
  /** Level the character starts at; the first class pick creates this many levels. */
  startLevel?: number;
  /** Coins added/removed by the player on top of granted gold. */
  currency?: Currency;
  abilityMethod: "standard" | "pointbuy" | "roll" | "manual";
  baseAbilities: AbilityScores;
  speciesId?: string;
  backgroundId?: string;
  /** One entry per character level, in the order they were taken. */
  levels: { classId: string; hp?: number }[];
  hpMethod: "average" | "rolled";
  /** Choice path -> selected ids / tokens. */
  choices: Record<string, string[]>;
  /** classId -> prepared spell ids. */
  prepared: Record<string, string[]>;
  /** Items added by the player (in addition to granted ones). */
  inventory: InventoryEntry[];
  /** Item instance key -> equipped override. */
  equipped: Record<string, boolean>;
}

export interface CharacterMeta {
  portrait?: string;
  pronouns?: string;
  alignment?: string;
  appearance?: string;
  backstory?: string;
  notes?: string;
  player?: string;
}

export interface Character {
  schema: 1;
  id: string;
  name: string;
  system: string;
  packs: { id: string; version: string }[];
  meta: CharacterMeta;
  build: Build;
  play: PlayEvent[];
  createdAt: number;
  updatedAt: number;
}

/* ───────────────────────── play events ───────────────────────── */

type Ev<T extends string, P = {}> = { id: string; at: number; type: T } & P;

export interface EffectStart {
  /** Effect / condition entity id, or a free-form label for ad-hoc effects. */
  effect: string;
  label?: string;
  source?: string;
  rounds?: number;
  concentration?: boolean;
}

export type PlayEvent =
  | Ev<"hp.damage", { amount: number; damageType?: string }>
  | Ev<"hp.heal", { amount: number }>
  | Ev<"hp.temp", { amount: number }>
  | Ev<"hp.set", { current: number }>
  | Ev<"resource.spend", { resource: string; amount: number }>
  | Ev<"resource.restore", { resource: string; amount: number | "all" }>
  | Ev<"slot.spend", { level: number }>
  | Ev<"slot.restore", { level: number }>
  | Ev<"hitdie.spend", { die: number; roll?: number }>
  | Ev<"economy.use", { slot: "action" | "bonus" | "reaction" }>
  | Ev<
      "action.use",
      {
        action: string;
        slotLevel?: number;
        costs: Cost[];
        /** Effects started by this use (self buffs, concentration spells). */
        effects?: EffectStart[];
        concentration?: boolean;
        note?: string;
      }
    >
  | Ev<"effect.add", EffectStart>
  | Ev<"effect.remove", { effect: string }>
  | Ev<"concentration.end">
  /** Start of this character's turn: refreshes action economy and ticks durations. */
  | Ev<"turn.start">
  | Ev<"combat.start">
  | Ev<"combat.end">
  | Ev<"rest", { kind: RestKind }>
  | Ev<"deathsave", { result: "success" | "failure" | "reset" }>
  | Ev<"roll", { label?: string; expr: string; total: number; detail?: string }>
  | Ev<"note", { text: string }>
  | Ev<"revert", { target: string }>;

export type PlayEventType = PlayEvent["type"];
