import type { Ability, CasterProgression, ClassEntity, Formula, Grant, SpellcastingGrant, SubclassEntity } from "@forge/core";
import { keepL, L, newLocalId, plain, type Kit } from "./templates";

/**
 * Class / subclass form <-> entity. The form owns the parts it can model (proficiencies,
 * kit, spellcasting tables, ASI levels, subclass level, per-level features); every other
 * grant stays in `levels` / `startingExtra` untouched, so official classes round-trip.
 */

export const slugOf = (id: string) => id.replace(/^[a-z-]+:/, "");
export const levelRef = (slug: string) => `@class.${slug}.level`;

const TABLE_RE = /^table\(\s*@class\.([\w-]+)\.level\s*,\s*([-\d\s,]+)\)$/;

/** Per-level values of a `table(@class.<slug>.level, …)` formula (padded to 20), or undefined if it's anything else. */
export function parseTable(f: Formula | undefined, slug: string): number[] | undefined {
  if (f === undefined) return undefined;
  if (typeof f === "number") return Array<number>(20).fill(f);
  if (/^\d+$/.test(f.trim())) return Array<number>(20).fill(Number(f));
  const m = TABLE_RE.exec(f.trim());
  if (!m || m[1] !== slug) return undefined;
  const vals = m[2]!.split(",").map((x) => Number(x.trim()));
  while (vals.length < 20) vals.push(vals.at(-1) ?? 0);
  return vals.slice(0, 20);
}

/** Inverse of parseTable: a constant collapses to a number, trailing repeats are dropped (table() clamps). */
export function tableFormula(slug: string, vals: readonly number[]): Formula {
  if (vals.every((v) => v === vals[0])) return vals[0] ?? 0;
  const out = [...vals];
  while (out.length > 1 && out.at(-1) === out.at(-2)) out.pop();
  return `table(${levelRef(slug)}, ${out.join(",")})`;
}

export const PRESET_TABLES = {
  fullCantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  fullPrepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  halfPrepared: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  thirdPrepared: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
  pactPrepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  none: Array<number>(20).fill(0),
} as const;

export interface CasterForm {
  /** Class level the spellcasting grant sits at (1 for most classes). */
  level: number;
  ability: Ability;
  progression: CasterProgression;
  mode: "prepared" | "known" | "spellbook";
  /** Spell-list tag. */
  list: string;
  cantrips?: Formula;
  prepared?: Formula;
  /** Generate cantrip / spell-known choices from the tables (Workshop-made classes). */
  auto: boolean;
}

export interface AsiAt {
  level: number;
  id: string;
}

export interface ClassForm {
  id: string;
  name: string;
  summary: string;
  text: string;
  accent?: string;
  hitDie: number;
  primary: Ability[];
  subclassLevel: number;
  /** Highest level this class defines content for (the builder's level cap). */
  maxLevel: number;
  saves: Ability[];
  armor: string[];
  weapons: string[];
  tools: string[];
  skillCount: number;
  /** Empty = any skill. */
  skills: string[];
  hasKit: boolean;
  kit: Kit[];
  kitGold: number;
  altGold: number;
  startingExtra: Grant[];
  multiclass: Grant[];
  caster: CasterForm | null;
  asi: AsiAt[];
  /** Per-level grants the form doesn't generate itself (features, other choices...). */
  levels: Record<string, Grant[]>;
  tags: string[];
}

export const DEFAULT_ASI = [4, 8, 12, 16, 19];
const GEN_PREFIX = "ws-";

const isSubclassChoice = (g: Grant) => g.type === "choice" && g.id === "subclass" && g.from.kind === "entity" && g.from.entityType === "subclass";
const isAsi = (g: Grant) => g.type === "choice" && g.from.kind === "entity" && g.from.entityType === "feat" && g.from.tags?.length === 1 && g.from.tags[0] === "general";

export function defaultClassForm(id = newLocalId("class")): ClassForm {
  return {
    id,
    name: "",
    summary: "",
    text: "",
    hitDie: 8,
    primary: ["str"],
    subclassLevel: 3,
    maxLevel: 20,
    saves: [],
    armor: [],
    weapons: ["simple"],
    tools: [],
    skillCount: 2,
    skills: [],
    hasKit: true,
    kit: [],
    kitGold: 0,
    altGold: 100,
    startingExtra: [],
    multiclass: [],
    caster: null,
    asi: DEFAULT_ASI.map((level) => ({ level, id: "feat" })),
    levels: {},
    tags: [],
  };
}

export function defaultCaster(slug: string, progression: CasterProgression = "full"): CasterForm {
  const prepared = progression === "half" ? PRESET_TABLES.halfPrepared : progression === "third" ? PRESET_TABLES.thirdPrepared : progression === "pact" ? PRESET_TABLES.pactPrepared : PRESET_TABLES.fullPrepared;
  return {
    level: progression === "third" ? 3 : 1,
    ability: "int",
    progression,
    mode: progression === "pact" || progression === "third" ? "known" : "prepared",
    list: slug,
    cantrips: progression === "half" ? 0 : tableFormula(slug, progression === "third" ? [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] : PRESET_TABLES.fullCantrips),
    prepared: tableFormula(slug, [...prepared]),
    auto: true,
  };
}

/* ───────────── kit (shared with backgrounds) ───────────── */

function parseKit(g: Grant): { kit: Kit[]; kitGold: number; altGold: number } | undefined {
  if (g.type !== "choice" || g.id !== "equipment" || g.from.kind !== "options") return undefined;
  const [a, b, ...rest] = g.from.options;
  if (!a || !b || rest.some((o) => o.id !== "custom")) return undefined;
  const onlyGold = b.grants.length === 1 && b.grants[0]!.type === "item" && b.grants[0]!.item === "item:gp";
  if (!onlyGold || a.grants.some((x) => x.type !== "item")) return undefined;
  const out = { kit: [] as Kit[], kitGold: 0, altGold: b.grants[0]!.type === "item" ? (b.grants[0]!.qty ?? 0) : 0 };
  for (const it of a.grants) {
    if (it.type !== "item") continue;
    if (it.item === "item:gp") out.kitGold += it.qty ?? 1;
    else out.kit.push({ item: it.item, qty: it.qty ?? 1, ...(it.equipped ? { equipped: true } : {}) });
  }
  return out;
}

export function kitGrant(kit: Kit[], kitGold: number, altGold: number): Grant {
  const items: Grant[] = [...kit.map((k): Grant => ({ type: "item", item: k.item, qty: k.qty, ...(k.equipped ? { equipped: true } : {}) })), ...(kitGold ? [{ type: "item", item: "item:gp", qty: kitGold } as Grant] : [])];
  return {
    type: "choice",
    id: "equipment",
    name: { en: "Starting Equipment", zh: "起始装备" },
    count: 1,
    from: {
      kind: "options",
      options: [
        { id: "a", name: { en: "Kit", zh: "装备包" }, grants: items },
        { id: "b", name: { en: `${altGold} GP`, zh: `${altGold} 金币` }, grants: [{ type: "item", item: "item:gp", qty: altGold }] },
        { id: "custom", name: { en: "Custom", zh: "自定义" }, text: { en: "Assemble your own gear under Equipment & Inventory.", zh: "在「装备与背包」中自行添加。" }, grants: [] },
      ],
    },
  };
}

/* ───────────── class ───────────── */

export function classToForm(e: ClassEntity, locale: "en" | "zh"): ClassForm {
  const f: ClassForm = {
    ...defaultClassForm(e.id),
    name: plain(e.name, locale),
    summary: plain(e.summary, locale),
    text: plain(e.text, locale),
    accent: e.accent,
    hitDie: e.hitDie,
    primary: [...e.primaryAbility],
    subclassLevel: e.subclassLevel,
    maxLevel: Math.max(1, ...Object.keys(e.levels).map(Number)),
    weapons: [],
    skillCount: 0,
    hasKit: false,
    altGold: 0,
    multiclass: e.multiclass,
    asi: [],
    tags: e.tags ?? [],
  };
  for (const g of e.starting) {
    const kit = parseKit(g);
    if (g.type === "proficiency" && g.kind === "save" && !g.level) f.saves.push(g.key as Ability);
    else if (g.type === "proficiency" && g.kind === "armor") f.armor.push(g.key);
    else if (g.type === "proficiency" && g.kind === "weapon") f.weapons.push(g.key);
    else if (g.type === "proficiency" && g.kind === "tool") f.tools.push(g.key);
    else if (g.type === "choice" && g.id === "skills" && g.from.kind === "proficiency" && g.from.profKind === "skill" && typeof g.count === "number" && !f.skillCount) {
      f.skillCount = g.count;
      f.skills = g.from.keys === "any" ? [] : [...g.from.keys];
    } else if (kit && !f.hasKit) Object.assign(f, kit, { hasKit: true });
    else f.startingExtra.push(g);
  }
  for (const [lvl, grants] of Object.entries(e.levels)) {
    const level = Number(lvl);
    const rest: Grant[] = [];
    for (const g of grants) {
      if (g.type === "spellcasting" && g.classId === e.id && !f.caster) f.caster = { level, ability: g.ability, progression: g.progression, mode: g.mode, list: g.list, cantrips: g.cantrips, prepared: g.prepared, auto: false };
      else if (isSubclassChoice(g)) continue;
      else if (isAsi(g) && g.type === "choice") f.asi.push({ level, id: g.id });
      else if (g.type === "choice" && g.id.startsWith(GEN_PREFIX)) {
        if (f.caster) f.caster.auto = true;
      } else rest.push(g);
    }
    if (rest.length) f.levels[lvl] = rest;
  }
  // generated choices may sit at levels before the spellcasting grant was seen
  if (f.caster && !f.caster.auto) f.caster.auto = Object.values(e.levels).some((gs) => gs.some((g) => g.type === "choice" && g.id.startsWith(GEN_PREFIX)));
  return f;
}

function spellChoiceAt(id: string, name: [string, string], count: number, list: string, min: Formula, max: Formula): Grant {
  return { type: "choice", id, name: { en: name[0], zh: name[1] }, count, from: { kind: "entity", entityType: "spell", tags: [list], minLevel: min, maxLevel: max } };
}

/** Cantrip / spell-known choices for each level where the table grows. */
export function generatedSpellChoices(slug: string, c: CasterForm): Record<number, Grant[]> {
  const out: Record<number, Grant[]> = {};
  const push = (lvl: number, g: Grant) => (out[lvl] ??= []).push(g);
  const cantrips = parseTable(c.cantrips, slug);
  const known = c.mode === "prepared" ? undefined : parseTable(c.prepared, slug);
  for (let lvl = 1; lvl <= 20; lvl++) {
    const dc = (cantrips?.[lvl - 1] ?? 0) - (lvl > 1 ? (cantrips?.[lvl - 2] ?? 0) : 0);
    if (dc > 0) push(lvl, spellChoiceAt(`${GEN_PREFIX}cantrips-${lvl}`, ["Cantrips", "戏法"], dc, c.list, 0, 0));
    const dk = (known?.[lvl - 1] ?? 0) - (lvl > 1 ? (known?.[lvl - 2] ?? 0) : 0);
    if (dk > 0) push(lvl, spellChoiceAt(`${GEN_PREFIX}spells-${lvl}`, ["Spells", "法术"], dk, c.list, 1, `@spell.${slug}.max-level`));
  }
  return out;
}

export function formToClass(f: ClassForm, base?: ClassEntity, locale: "en" | "zh" = "zh"): ClassEntity {
  const slug = slugOf(f.id);
  const starting: Grant[] = [
    ...f.saves.map((key): Grant => ({ type: "proficiency", kind: "save", key })),
    ...f.armor.map((key): Grant => ({ type: "proficiency", kind: "armor", key })),
    ...f.weapons.map((key): Grant => ({ type: "proficiency", kind: "weapon", key })),
    ...f.tools.map((key): Grant => ({ type: "proficiency", kind: "tool", key })),
  ];
  if (f.skillCount > 0) starting.push({ type: "choice", id: "skills", name: { en: "Skills", zh: "技能" }, count: f.skillCount, from: { kind: "proficiency", profKind: "skill", keys: f.skills.length ? f.skills : "any" } });
  if (f.hasKit) starting.push(kitGrant(f.kit, f.kitGold, f.altGold));
  starting.push(...f.startingExtra);

  const gen = f.caster?.auto ? generatedSpellChoices(slug, f.caster) : {};
  const top = Math.max(f.maxLevel, ...Object.keys(f.levels).map(Number));
  const levels: Record<string, Grant[]> = {};
  for (let lvl = 1; lvl <= top; lvl++) {
    const out: Grant[] = [];
    if (f.caster && f.caster.level === lvl) {
      const sc: SpellcastingGrant = { type: "spellcasting", classId: f.id, ability: f.caster.ability, progression: f.caster.progression, list: f.caster.list || slug, mode: f.caster.mode };
      if (f.caster.cantrips !== undefined && f.caster.cantrips !== 0) sc.cantrips = f.caster.cantrips;
      if (f.caster.prepared !== undefined) sc.prepared = f.caster.prepared;
      out.push(sc);
    }
    out.push(...(f.levels[String(lvl)] ?? []));
    if (lvl === f.subclassLevel) out.push({ type: "choice", id: "subclass", name: { en: "Subclass", zh: "子职业" }, count: 1, from: { kind: "entity", entityType: "subclass", tags: [slug] } });
    for (const a of f.asi.filter((x) => x.level === lvl))
      out.push({ type: "choice", id: a.id, name: { en: "Ability Score Improvement / Feat", zh: "属性值提升 / 专长" }, count: 1, from: { kind: "entity", entityType: "feat", tags: ["general"] } });
    out.push(...(gen[lvl] ?? []));
    levels[String(lvl)] = out;
  }
  return {
    ...(base ?? {}),
    id: f.id,
    type: "class",
    name: keepL(base?.name, locale, f.name) ?? L("?"),
    summary: keepL(base?.summary, locale, f.summary),
    text: keepL(base?.text, locale, f.text),
    accent: f.accent,
    hitDie: f.hitDie,
    primaryAbility: f.primary.length ? f.primary : ["str"],
    subclassLevel: f.subclassLevel,
    starting,
    multiclass: f.multiclass,
    levels,
    tags: f.tags,
  } as ClassEntity;
}

/* ───────────── subclass ───────────── */

export interface SubclassForm {
  id: string;
  name: string;
  summary: string;
  text: string;
  accent?: string;
  classId: string;
  levels: Record<string, Grant[]>;
  tags: string[];
}

export function subclassToForm(e: SubclassEntity, locale: "en" | "zh"): SubclassForm {
  return { id: e.id, name: plain(e.name, locale), summary: plain(e.summary, locale), text: plain(e.text, locale), accent: e.accent, classId: e.classId, levels: { ...e.levels }, tags: e.tags ?? [] };
}

export function formToSubclass(f: SubclassForm, base?: SubclassEntity, locale: "en" | "zh" = "zh"): SubclassEntity {
  const cls = slugOf(f.classId);
  const oldCls = base ? slugOf(base.classId) : undefined;
  // the parent-class tag is what the class's subclass choice filters on
  const tags = [cls, ...f.tags.filter((t) => t !== cls && t !== oldCls)];
  const levels = Object.fromEntries(Object.entries(f.levels).filter(([, g]) => g.length));
  return {
    ...(base ?? {}),
    id: f.id,
    type: "subclass",
    classId: f.classId,
    name: keepL(base?.name, locale, f.name) ?? L("?"),
    summary: keepL(base?.summary, locale, f.summary),
    text: keepL(base?.text, locale, f.text),
    accent: f.accent,
    tags,
    levels,
  } as SubclassEntity;
}

/** A fresh feature grant for a level row. */
export const newFeature = (name = ""): Grant => ({ type: "feature", id: `f-${Math.random().toString(36).slice(2, 8)}`, name: L(name || "?"), grants: [] });
