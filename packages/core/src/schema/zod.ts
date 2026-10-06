import { z } from "zod";
import type { Character, Grant, RulePack } from "./types";

/**
 * Runtime validation for anything crossing a trust boundary: imported rule
 * packs, homebrew files, character backups. Mirrors types.ts.
 */

const text = z.union([z.string(), z.object({ en: z.string() }).catchall(z.string())]);
const formula = z.union([z.string(), z.number()]);
const ability = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const profKind = z.enum(["save", "skill", "armor", "weapon", "tool", "language", "mastery"]);
const profLevel = z.enum(["half", "proficient", "expertise"]);
const recovery = z.object({ on: z.enum(["short", "long"]), amount: z.union([z.literal("all"), formula]) });
const activation = z.enum(["action", "bonus", "reaction", "free", "special", "minute", "hour"]);
const prereq = z.object({ level: z.number().optional(), formula: z.string().optional(), text: text.optional() });

const cost = z.union([
  z.object({ resource: z.string(), amount: formula.optional() }),
  z.object({ slot: z.number().int().min(1).max(9) }),
  z.object({ economy: z.enum(["action", "bonus", "reaction"]) }),
  z.object({ item: z.string(), amount: z.number().optional() }),
]);

const applyEffect = z.object({
  effect: z.string(),
  target: z.enum(["self", "target"]),
  duration: z
    .object({ rounds: z.number().optional(), minutes: z.number().optional(), hours: z.number().optional(), untilRest: z.enum(["short", "long"]).optional(), text: text.optional() })
    .optional(),
});

const actionBody = {
  text: text.optional(),
  trigger: text.optional(),
  cost: z.array(cost).optional(),
  range: text.optional(),
  target: text.optional(),
  attack: z.object({ bonus: formula, kind: z.enum(["melee", "ranged", "spell"]) }).optional(),
  save: z.object({ ability, dc: formula, onSave: z.enum(["half", "none"]).optional() }).optional(),
  damage: z.array(z.object({ dice: z.string(), type: z.string() })).optional(),
  heal: z.object({ dice: z.string() }).optional(),
  applies: z.array(applyEffect).optional(),
  concentration: z.boolean().optional(),
  duration: text.optional(),
  when: z.string().optional(),
  category: z.enum(["attack", "spell", "feature", "basic", "item"]).optional(),
  tags: z.array(z.string()).optional(),
  sound: z.string().optional(),
};

export const ActionSchema = z.object({ id: z.string(), name: text, activation, ...actionBody });

export const GrantSchema: z.ZodType<Grant> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("modifier"), target: z.string(), op: z.enum(["add", "atLeast", "override", "base"]).optional(), value: formula, when: z.string().optional(), label: text.optional() }),
    z.object({ type: z.literal("proficiency"), kind: profKind, key: z.string(), level: profLevel.optional() }),
    z.object({ type: z.literal("resource"), id: z.string(), name: text, max: formula, recovery: z.array(recovery), icon: z.string().optional() }),
    z.object({ type: z.literal("action"), action: ActionSchema }),
    z.object({ type: z.literal("feature"), id: z.string(), name: text, text: text.optional(), grants: z.array(GrantSchema).optional(), tags: z.array(z.string()).optional(), minLevel: z.number().optional(), classLevel: z.number().optional() }),
    z.object({
      type: z.literal("choice"),
      id: z.string(),
      name: text,
      text: text.optional(),
      count: formula,
      from: z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("entity"),
          entityType: z.enum(["class", "subclass", "species", "background", "feat", "spell", "item", "condition", "effect"]),
          ids: z.array(z.string()).optional(),
          tags: z.array(z.string()).optional(),
          anyTags: z.array(z.string()).optional(),
          minLevel: formula.optional(),
          maxLevel: formula.optional(),
          spell: z.object({ ability: ability.optional(), alwaysPrepared: z.boolean().optional(), free: z.object({ max: formula, recovery: z.array(recovery) }).optional() }).optional(),
        }),
        z.object({ kind: z.literal("options"), options: z.array(z.object({ id: z.string(), name: text, text: text.optional(), grants: z.array(GrantSchema), prereq: prereq.optional() })) }),
        z.object({ kind: z.literal("proficiency"), profKind, keys: z.union([z.array(z.string()), z.literal("any")]), level: profLevel.optional(), requireProficient: z.boolean().optional() }),
        z.object({ kind: z.literal("ability"), abilities: z.array(ability), patterns: z.array(z.array(z.number())), cap: z.number().optional() }),
      ]),
    }),
    z.object({ type: z.literal("grant"), entity: z.string() }),
    z.object({
      type: z.literal("spellcasting"),
      classId: z.string(),
      ability,
      progression: z.enum(["full", "half", "third", "pact", "none"]),
      list: z.string(),
      mode: z.enum(["prepared", "spellbook", "known"]),
      cantrips: formula.optional(),
      prepared: formula.optional(),
    }),
    z.object({ type: z.literal("spell"), spell: z.string(), minLevel: z.number().optional(), classLevel: z.number().optional(), ability: ability.optional(), abilityFrom: z.string().optional(), alwaysPrepared: z.boolean().optional(), free: z.object({ max: formula, recovery: z.array(recovery) }).optional() }),
    z.object({ type: z.literal("item"), item: z.string(), qty: z.number().optional(), equipped: z.boolean().optional() }),
    z.object({ type: z.literal("tag"), tag: z.string(), label: text.optional() }),
    z.object({
      type: z.literal("dice"),
      on: z.array(z.enum(["attack", "damage", "save", "check"])),
      dice: z.string(),
      damageType: z.string().optional(),
      kinds: z.array(z.enum(["melee", "ranged", "spell"])).optional(),
      properties: z.array(z.string()).optional(),
      when: z.string().optional(),
      once: z.boolean().optional(),
      label: text.optional(),
    }),
  ]),
) as z.ZodType<Grant>;

const grants = z.array(GrantSchema);
const levels = z.record(z.string(), grants);

const entityBase = {
  id: z.string().min(1),
  name: text,
  summary: text.optional(),
  text: text.optional(),
  aliases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  prereq: prereq.optional(),
  grants: grants.optional(),
  repeatable: z.boolean().optional(),
  art: z.string().optional(),
  sound: z.string().optional(),
  accent: z.string().optional(),
  source: z.string().optional(),
};

export const EntitySchema = z.discriminatedUnion("type", [
  z.object({ ...entityBase, type: z.literal("class"), hitDie: z.number(), primaryAbility: z.array(ability), starting: grants, multiclass: grants, levels, subclassLevel: z.number() }),
  z.object({ ...entityBase, type: z.literal("subclass"), classId: z.string(), levels }),
  z.object({ ...entityBase, type: z.literal("species"), size: text, speed: z.number() }),
  z.object({ ...entityBase, type: z.literal("background") }),
  z.object({ ...entityBase, type: z.literal("feat"), category: z.enum(["origin", "general", "fighting-style", "epic-boon"]) }),
  z.object({
    ...entityBase,
    type: z.literal("spell"),
    level: z.number().int().min(0).max(9),
    school: z.string(),
    castingTime: text,
    activation,
    range: text,
    components: z.string(),
    duration: text,
    concentration: z.boolean().optional(),
    ritual: z.boolean().optional(),
    action: z.object(actionBody).optional(),
    upcast: z.object({ damage: z.string().optional(), heal: z.string().optional(), text: text.optional() }).optional(),
    cantripScaling: z.boolean().optional(),
    higherLevels: text.optional(),
  }),
  z.object({
    ...entityBase,
    type: z.literal("item"),
    itemType: z.enum(["weapon", "armor", "gear", "tool", "pack", "focus"]),
    weapon: z
      .object({
        category: z.enum(["simple", "martial"]),
        kind: z.enum(["melee", "ranged"]),
        damage: z.string(),
        damageType: z.string(),
        properties: z.array(z.string()),
        versatile: z.string().optional(),
        range: z.string().optional(),
        mastery: z.string().optional(),
      })
      .optional(),
    armor: z
      .object({ category: z.enum(["light", "medium", "heavy", "shield"]), ac: z.number(), dexCap: z.number().optional(), strength: z.number().optional(), stealthDisadvantage: z.boolean().optional() })
      .optional(),
    cost: z.string().optional(),
    weight: z.number().optional(),
    contents: z.array(z.object({ item: z.string(), qty: z.number().optional() })).optional(),
    consumable: z.boolean().optional(),
    use: z.object({ activation, ...actionBody }).optional(),
  }),
  z.object({ ...entityBase, type: z.enum(["condition", "effect"]), icon: z.string().optional() }),
  z.object({ ...entityBase, type: z.literal("rule"), category: z.string().optional() }),
]);

const grantMatcher = z.object({ type: z.string().optional(), id: z.string().optional(), key: z.string().optional(), target: z.string().optional() });
const grantEdits = z.object({ add: grants.optional(), remove: z.array(grantMatcher).optional() });
const entityPatch = z.object({
  target: z.string().min(1),
  set: z.record(z.string(), z.unknown()).optional(),
  grants: grantEdits.optional(),
  levels: z.record(z.string(), grantEdits).optional(),
  starting: grantEdits.optional(),
});

/** System overrides: known numeric fields are checked, the rest passes through for forward compatibility. */
const systemConfig = z
  .object({
    profTable: z.array(z.number()).optional(),
    slotTable: z.array(z.array(z.number())).optional(),
    pactTable: z.array(z.object({ count: z.number(), level: z.number() })).optional(),
    cantripSteps: z.array(z.number()).optional(),
    pointBuy: z.object({ budget: z.number().optional(), min: z.number().optional(), max: z.number().optional(), cost: z.record(z.string(), z.number()).optional() }).optional(),
    standardArray: z.array(z.number()).optional(),
    maxLevel: z.number().int().min(1).max(30).optional(),
    abilityCap: z.number().optional(),
    hp: z.object({ firstLevel: z.enum(["max", "average"]).optional(), levelUp: z.enum(["average", "max"]).optional() }).optional(),
  })
  .passthrough();

export const RulePackSchema = z.object({
  id: z.string().min(1),
  version: z.string(),
  system: z.string(),
  name: text,
  license: z.string().optional(),
  attribution: text.optional(),
  requires: z.array(z.string()).optional(),
  globalGrants: grants.optional(),
  entities: z.array(EntitySchema),
  systemConfig: systemConfig.optional(),
  patches: z.array(entityPatch).optional(),
  samples: z
    .array(
      z.object({
        id: z.string(),
        name: text,
        text,
        level: z.number().int().min(1),
        classId: z.string(),
        speciesId: z.string(),
        backgroundId: z.string(),
        abilities: z.object({ str: z.number(), dex: z.number(), con: z.number(), int: z.number(), wis: z.number(), cha: z.number() }),
        choices: z.record(z.string(), z.array(z.string())).optional(),
        prepared: z.record(z.string(), z.array(z.string())).optional(),
      }),
    )
    .optional(),
});

const buildSchema = z.object({
  startLevel: z.number().int().min(1).max(30).optional(),
  currency: z.object({ cp: z.number().optional(), sp: z.number().optional(), ep: z.number().optional(), gp: z.number().optional(), pp: z.number().optional() }).optional(),
  abilityMethod: z.enum(["standard", "pointbuy", "roll", "manual"]),
  baseAbilities: z.object({ str: z.number(), dex: z.number(), con: z.number(), int: z.number(), wis: z.number(), cha: z.number() }),
  speciesId: z.string().optional(),
  backgroundId: z.string().optional(),
  levels: z.array(z.object({ classId: z.string(), hp: z.number().optional() })),
  hpMethod: z.enum(["average", "max", "rolled"]),
  choices: z.record(z.string(), z.array(z.string())),
  prepared: z.record(z.string(), z.array(z.string())),
  inventory: z.array(z.object({ key: z.string(), item: z.string(), qty: z.number(), equipped: z.boolean().optional(), notes: z.string().optional() })),
  equipped: z.record(z.string(), z.boolean()),
});

export const CharacterSchema = z.object({
  schema: z.literal(1),
  id: z.string(),
  name: z.string(),
  system: z.string(),
  packs: z.array(z.object({ id: z.string(), version: z.string() })),
  meta: z.object({ quickBuffs: z.array(z.object({ effect: z.string(), persistent: z.boolean().optional() })).optional() }).catchall(z.string().optional()),
  build: buildSchema,
  play: z.array(z.object({ id: z.string(), at: z.number(), type: z.string() }).passthrough()),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function toResult<T>(r: { success: boolean; data?: unknown; error?: z.ZodError }): ParseResult<T> {
  if (r.success) return { ok: true, value: r.data as T };
  return { ok: false, errors: r.error!.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
}

export const parseRulePack = (data: unknown): ParseResult<RulePack> => toResult(RulePackSchema.safeParse(data));
export const parseCharacter = (data: unknown): ParseResult<Character> => toResult(CharacterSchema.safeParse(data));
