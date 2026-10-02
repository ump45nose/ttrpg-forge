import type { Ability, Activation, DamagePart, Entity, FeatEntity, Grant, LocalizedText, PackRegistry as Registry, RuleEntity, SpellEntity } from "@forge/core";
import { keepL, L, plain } from "./templates";

/* ───────────── spells ───────────── */

export const SCHOOLS = ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"] as const;

export const CAST_TEXT: Partial<Record<Activation, [string, string]>> = {
  action: ["Action", "动作"],
  bonus: ["Bonus Action", "附赠动作"],
  reaction: ["Reaction", "反应"],
  minute: ["1 minute", "1 分钟"],
  hour: ["1 hour", "1 小时"],
};

export interface SpellForm {
  id: string;
  name: string;
  summary: string;
  text: string;
  higherLevels: string;
  level: number;
  school: string;
  activation: Activation;
  castingTime: string;
  range: string;
  duration: string;
  v: boolean;
  s: boolean;
  m: boolean;
  material: string;
  concentration: boolean;
  ritual: boolean;
  /** Class spell-list tags. */
  lists: string[];
  /** Rules use: nothing, a spell attack, or a saving throw. */
  resolve: "none" | "attack" | "save";
  saveAbility: Ability;
  onSave: "half" | "none";
  damage: DamagePart[];
  heal: string;
  upcastDamage: string;
  cantripScaling: boolean;
}

const COMP_RE = /^\s*(V)?\s*,?\s*(S)?\s*,?\s*(M)?\s*(?:\((.*)\))?\s*$/;

export function parseComponents(c: string): Pick<SpellForm, "v" | "s" | "m" | "material"> {
  const m = COMP_RE.exec(c.replace(/\s+/g, " "));
  if (!m) return { v: /\bV\b/.test(c), s: /\bS\b/.test(c), m: /\bM\b/.test(c), material: /\((.*)\)/.exec(c)?.[1] ?? "" };
  return { v: !!m[1], s: !!m[2], m: !!m[3], material: m[4] ?? "" };
}

export const componentsText = (f: Pick<SpellForm, "v" | "s" | "m" | "material">) =>
  [f.v && "V", f.s && "S", f.m && (f.material.trim() ? `M (${f.material.trim()})` : "M")].filter(Boolean).join(", ");

/** Tags spells carry that aren't class lists. */
const NON_LIST = new Set<string>([...SCHOOLS, "concentration", "ritual", "homebrew"]);

export function spellToForm(e: SpellEntity | undefined, locale: "en" | "zh"): SpellForm {
  const a = e?.action;
  const act = e?.activation ?? "action";
  return {
    id: e?.id ?? "",
    name: plain(e?.name, locale),
    summary: plain(e?.summary, locale),
    text: plain(e?.text, locale),
    higherLevels: plain(e?.higherLevels, locale),
    level: e?.level ?? 1,
    school: e?.school ?? "evocation",
    activation: act,
    castingTime: e ? plain(e.castingTime, locale) : (CAST_TEXT[act]?.[locale === "en" ? 0 : 1] ?? ""),
    range: plain(e?.range, locale) || (locale === "en" ? "60 ft" : "60 尺"),
    duration: plain(e?.duration, locale) || (locale === "en" ? "Instantaneous" : "立即"),
    ...parseComponents(e?.components ?? "V, S"),
    concentration: !!e?.concentration,
    ritual: !!e?.ritual,
    lists: (e?.tags ?? []).filter((t) => !NON_LIST.has(t)),
    resolve: a?.attack ? "attack" : a?.save ? "save" : "none",
    saveAbility: a?.save?.ability ?? "dex",
    onSave: a?.save?.onSave === "none" ? "none" : "half",
    damage: a?.damage ?? [],
    heal: a?.heal?.dice ?? "",
    upcastDamage: e?.upcast?.damage ?? "",
    cantripScaling: !!e?.cantripScaling,
  };
}

export function formToSpell(f: SpellForm, base: SpellEntity | undefined, locale: "en" | "zh"): SpellEntity {
  const keptAction = { ...(base?.action ?? {}) };
  delete keptAction.attack;
  delete keptAction.save;
  delete keptAction.damage;
  delete keptAction.heal;
  const action: SpellEntity["action"] = { ...keptAction };
  if (f.resolve === "attack") action.attack = { bonus: 0, kind: "spell" };
  if (f.resolve === "save") action.save = { ability: f.saveAbility, dc: 0, onSave: f.onSave };
  const damage = f.damage.filter((d) => d.dice.trim());
  if (damage.length) action.damage = damage;
  if (f.heal.trim()) action.heal = { dice: f.heal.trim() };
  const upcast = { ...(base?.upcast ?? {}) };
  if (f.upcastDamage.trim()) upcast.damage = f.upcastDamage.trim();
  else delete upcast.damage;
  const castDefault = CAST_TEXT[f.activation];
  const castingTime = castDefault && (f.castingTime === castDefault[0] || f.castingTime === castDefault[1]) ? L2(castDefault) : (keepL(base?.castingTime, locale, f.castingTime) ?? L("—"));
  const extraTags = (base?.tags ?? []).filter((t) => NON_LIST.has(t) && !SCHOOLS.includes(t as never) && t !== "concentration" && t !== "ritual");
  return {
    ...(base ?? {}),
    id: f.id,
    type: "spell",
    name: keepL(base?.name, locale, f.name) ?? L("?"),
    summary: keepL(base?.summary, locale, f.summary),
    text: keepL(base?.text, locale, f.text),
    higherLevels: keepL(base?.higherLevels, locale, f.higherLevels),
    tags: [...new Set([...f.lists, f.school, ...(f.concentration ? ["concentration"] : []), ...(f.ritual ? ["ritual"] : []), ...extraTags])],
    level: f.level,
    school: f.school,
    activation: f.activation,
    castingTime,
    range: keepL(base?.range, locale, f.range) ?? L("—"),
    duration: keepL(base?.duration, locale, f.duration) ?? L("—"),
    components: componentsText(f),
    concentration: f.concentration || undefined,
    ritual: f.ritual || undefined,
    action: Object.keys(action).length ? action : undefined,
    upcast: Object.keys(upcast).length ? upcast : undefined,
    cantripScaling: (f.level === 0 && f.cantripScaling) || undefined,
  } as SpellEntity;
}

const L2 = ([en, zh]: [string, string]): LocalizedText => ({ en, zh });

/** Spell-list tags known to the registry, with the name of a class that casts from each. */
export function spellLists(reg: Registry): { id: string; name: LocalizedText }[] {
  const out = new Map<string, LocalizedText>();
  for (const c of reg.all("class")) {
    for (const gs of Object.values(c.levels)) for (const g of gs) if (g.type === "spellcasting" && !out.has(g.list)) out.set(g.list, c.name);
  }
  return [...out].map(([id, name]) => ({ id, name }));
}

/* ───────────── feats ───────────── */

export const FEAT_CATEGORIES = ["origin", "general", "fighting-style", "epic-boon"] as const;
type FeatCategory = (typeof FEAT_CATEGORIES)[number];

export interface FeatForm {
  id: string;
  name: string;
  summary: string;
  text: string;
  category: FeatCategory;
  repeatable: boolean;
  prereqLevel: number;
  prereqFormula: string;
  prereqText: string;
  /** "+1 to one of these" ability increase. */
  asi: Ability[];
  grants: Grant[];
  tags: string[];
}

const isFeatAsi = (g: Grant) => g.type === "choice" && g.id === "ability" && g.from.kind === "ability" && g.from.patterns.length === 1 && g.from.patterns[0]!.length === 1 && g.from.patterns[0]![0] === 1;

export function featToForm(e: FeatEntity | undefined, locale: "en" | "zh"): FeatForm {
  const f: FeatForm = {
    id: e?.id ?? "",
    name: plain(e?.name, locale),
    summary: plain(e?.summary, locale),
    text: plain(e?.text, locale),
    category: e?.category ?? "general",
    repeatable: !!e?.repeatable,
    prereqLevel: e?.prereq?.level ?? (e ? 0 : 4),
    prereqFormula: e?.prereq?.formula ?? "",
    prereqText: plain(e?.prereq?.text, locale),
    asi: [],
    grants: [],
    tags: (e?.tags ?? []).filter((t) => !FEAT_CATEGORIES.includes(t as FeatCategory)),
  };
  for (const g of e?.grants ?? []) {
    if (isFeatAsi(g) && g.type === "choice" && g.from.kind === "ability" && !f.asi.length) f.asi = [...g.from.abilities];
    else f.grants.push(g);
  }
  return f;
}

export function formToFeat(f: FeatForm, base: FeatEntity | undefined, locale: "en" | "zh"): FeatEntity {
  const grants: Grant[] = [];
  if (f.asi.length) grants.push({ type: "choice", id: "ability", name: { en: "Ability Score Increase", zh: "属性值提升" }, count: 1, from: { kind: "ability", abilities: f.asi, patterns: [[1]], cap: 20 } });
  grants.push(...f.grants);
  const prereq = f.prereqLevel > 0 || f.prereqFormula.trim() || f.prereqText.trim() ? { level: f.prereqLevel > 0 ? f.prereqLevel : undefined, formula: f.prereqFormula.trim() || undefined, text: keepL(base?.prereq?.text, locale, f.prereqText) } : undefined;
  return {
    ...(base ?? {}),
    id: f.id,
    type: "feat",
    category: f.category,
    name: keepL(base?.name, locale, f.name) ?? L("?"),
    summary: keepL(base?.summary, locale, f.summary),
    text: keepL(base?.text, locale, f.text),
    tags: [f.category, ...f.tags],
    repeatable: f.repeatable || undefined,
    prereq,
    grants,
  } as FeatEntity;
}

/* ───────────── glossary terms ───────────── */

export const TERM_CATEGORIES = ["term", "action", "area", "condition", "hazard", "attitude"] as const;

export interface RuleForm {
  id: string;
  name: string;
  aliases: string;
  category: string;
  text: string;
}

export const ruleToForm = (e: RuleEntity | undefined, locale: "en" | "zh"): RuleForm => ({
  id: e?.id ?? "",
  name: plain(e?.name, locale),
  aliases: (e?.aliases ?? []).join(", "),
  category: e?.category ?? "term",
  text: plain(e?.text, locale),
});

export const formToRule = (f: RuleForm, base: RuleEntity | undefined, locale: "en" | "zh"): RuleEntity => ({
  ...(base ?? {}),
  id: f.id,
  type: "rule",
  name: keepL(base?.name, locale, f.name) ?? L("?"),
  text: keepL(base?.text, locale, f.text),
  aliases: f.aliases.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
  category: f.category,
});

export type { Entity };
