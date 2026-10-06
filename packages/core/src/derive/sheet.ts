import { collect, type ChoiceInstance, type Collected, type CollectResult, type Issue, type SourceRef } from "../build/collect";
import { parseDice, formatDice } from "../dice";
import { resolveTemplate } from "../formula";
import type { PackRegistry } from "../pack/registry";
import {
  ABILITIES,
  type Ability,
  type ActionDef,
  type Activation,
  type ApplyEffect,
  type Build,
  type Cost,
  type EntityOf,
  type FeatureGrant,
  type ModifierGrant,
  type ProficiencyGrant,
  type ProficiencyKind,
  type ProficiencyLevel,
  type Recovery,
  type RollKind,
  type ResourceGrant,
  type SpellcastingGrant,
} from "../schema/types";
import { ABILITY_NAMES, abilityMod } from "../system/dnd5e";
import type { LocalizedText } from "../text";
import { StatEngine, type Contribution } from "./stats";

/* ───────────────────────── sheet types ───────────────────────── */

export interface AbilityView {
  score: number;
  mod: number;
  save: number;
  saveProf: boolean;
}

export interface SkillView {
  ability: Ability;
  value: number;
  prof: ProficiencyLevel | null;
  passive: number;
}

export interface ProficiencyView {
  kind: ProficiencyKind;
  key: string;
  level: ProficiencyLevel;
  sources: SourceRef[];
}

export interface FeatureView {
  id: string;
  name: LocalizedText;
  text?: LocalizedText;
  tags?: string[];
  source: SourceRef;
}

export interface ResourceView {
  id: string;
  name: LocalizedText;
  max: number;
  recovery: { on: Recovery["on"]; amount: number | "all" }[];
  icon?: string;
  source?: SourceRef;
  kind: "feature" | "hitdie" | "spell-free";
}

export interface SpellcastingView {
  classId: string;
  ability: Ability;
  mod: number;
  dc: number;
  attack: number;
  mode: SpellcastingGrant["mode"];
  list: string;
  cantripsMax: number;
  preparedMax: number;
  maxSpellLevel: number;
}

export interface SpellView {
  spellId: string;
  name: LocalizedText;
  path: string;
  level: number;
  classId?: string;
  ability: Ability;
  dc: number;
  attack: number;
  /** In the spellbook / known list. */
  known: boolean;
  /** Castable today. */
  prepared: boolean;
  alwaysPrepared: boolean;
  freeResource?: string;
  source: SourceRef;
}

export interface ResolvedAction {
  /** Unique within the sheet. */
  id: string;
  name: LocalizedText;
  text?: LocalizedText;
  activation: Activation;
  trigger?: LocalizedText;
  range?: LocalizedText;
  target?: LocalizedText;
  duration?: LocalizedText;
  concentration?: boolean;
  category: NonNullable<ActionDef["category"]>;
  tags: string[];
  source: SourceRef;
  attack?: { bonus: number; kind: "melee" | "ranged" | "spell" };
  save?: { ability: Ability; dc: number; onSave?: "half" | "none" };
  damage?: { dice: string; type: string }[];
  heal?: { dice: string };
  costs: Cost[];
  applies?: ApplyEffect[];
  spell?: { id: string; level: number; upcastDamage?: string; upcastHeal?: string; ritual?: boolean; ability?: Ability };
  /** `mod`: the ability modifier the attack uses (Graze damage, Topple DC...). */
  weapon?: {
    itemKey: string;
    properties: string[];
    mastery?: string;
    versatile?: string;
    range?: string;
    equipped: boolean;
    mod: number;
    /** Which ability `mod` is, the damage die before modifiers (after Martial Arts), and proficiency: for roll breakdowns. */
    ability: "str" | "dex";
    die: string;
    versatileDie?: string;
    proficient: boolean;
  };
  /** Usable inventory item behind the action. */
  item?: { key: string; entityId: string; qty: number; consumable: boolean };
  /** Static availability (formula `when`); resource availability is a play-state concern. */
  available: boolean;
  /** Sound of the action itself (the spell's / item's own sound is looked up by id). */
  sound?: string;
}

export interface ItemView {
  key: string;
  item: string;
  entity?: EntityOf<"item">;
  qty: number;
  equipped: boolean;
  granted: boolean;
}

export interface ChoiceView extends ChoiceInstance {
  count: number;
  remaining: number;
}

export interface Sheet {
  level: number;
  prof: number;
  classes: { id: string; level: number; hitDie: number; subclass?: string }[];
  speciesId?: string;
  backgroundId?: string;
  size?: LocalizedText;
  abilities: Record<Ability, AbilityView>;
  skills: Record<string, SkillView>;
  ac: number;
  initiative: number;
  /** Lowest natural d20 that crits (20, or 19 for Champions...). */
  critRange: number;
  speed: Record<"walk" | "fly" | "swim" | "climb", number>;
  hpMax: number;
  senses: Record<string, number>;
  /** Extra dice on attacks, damage, saves or checks from effects and features. */
  dice: DiceBonusView[];
  proficiencies: ProficiencyView[];
  tags: string[];
  features: FeatureView[];
  resources: ResourceView[];
  spellcasting: SpellcastingView[];
  slots: number[];
  pact?: { count: number; level: number };
  spells: SpellView[];
  actions: ResolvedAction[];
  items: ItemView[];
  choices: ChoiceView[];
  pendingCount: number;
  issues: Issue[];
  warnings: string[];
  /** Raw collection, for option listing & validation. */
  collected: CollectResult;
  stats: StatEngine;
  explain(stat: string): Contribution[];
  /** Is the character proficient (any level) — used by validation & UI. */
  proficiency(kind: ProficiencyKind, key: string): ProficiencyLevel | null;
}

/** An extra die on some rolls (Bless, Guidance, Hunter's Mark), resolved for this character. */
export interface DiceBonusView {
  on: RollKind[];
  /** Plain dice, e.g. "1d4" or "-1d4". */
  dice: string;
  damageType?: string;
  kinds?: ("melee" | "ranged" | "spell")[];
  properties?: string[];
  once?: boolean;
  label: LocalizedText;
  source: SourceRef;
}

export interface DeriveOptions {
  /** Effects / conditions currently active in play; their grants apply. */
  activeEffects?: string[];
}

const PROF_MULT: Record<ProficiencyLevel, number> = { half: 0.5, proficient: 1, expertise: 2 };
const PROF_RANK: Record<ProficiencyLevel, number> = { half: 1, proficient: 2, expertise: 3 };

const L = (en: string, zh: string): LocalizedText => ({ en, zh });

/**
 * Hit Die points one level after the first adds (Con not included): the table's
 * max rule, else the build's method — a recorded roll, the die's maximum, or the average.
 */
export function levelHp(reg: PackRegistry, build: Build, index: number): number {
  const l = build.levels[index];
  const die = reg.getOf("class", l?.classId)?.hitDie ?? 8;
  const avg = Math.floor(die / 2) + 1;
  if (reg.system.hp.levelUp === "max" || build.hpMethod === "max") return die;
  if (build.hpMethod === "rolled" && l?.hp) return l.hp;
  return avg;
}

/* ───────────────────────── derive ───────────────────────── */

export function derive(reg: PackRegistry, build: Build, opts: DeriveOptions = {}): Sheet {
  const sys = reg.system;
  const col = collect(reg, build, opts.activeEffects);
  const level = build.levels.length;
  const tags = new Set<string>();
  const issues: Issue[] = [...col.issues];

  // proficiencies: best level per kind:key
  const profMap = new Map<string, ProficiencyView>();
  for (const c of col.grants) {
    if (c.grant.type === "tag") tags.add(c.grant.tag);
    if (c.grant.type !== "proficiency") continue;
    const g = c.grant as ProficiencyGrant;
    const k = `${g.kind}:${g.key}`;
    const lvl = g.level ?? "proficient";
    const cur = profMap.get(k);
    if (!cur) profMap.set(k, { kind: g.kind, key: g.key, level: lvl, sources: [c.source] });
    else {
      cur.sources.push(c.source);
      if (PROF_RANK[lvl] > PROF_RANK[cur.level]) cur.level = lvl;
    }
  }
  const proficiency = (kind: ProficiencyKind, key: string) => profMap.get(`${kind}:${key}`)?.level ?? null;

  // inventory & equipment
  const items: ItemView[] = col.items.map((i) => ({
    key: i.key,
    item: i.item,
    entity: reg.getOf("item", i.item),
    qty: i.qty,
    equipped: i.equipped,
    granted: !!i.source,
  }));
  const armor = items.find((i) => i.equipped && i.entity?.armor && i.entity.armor.category !== "shield");
  const shield = items.find((i) => i.equipped && i.entity?.armor?.category === "shield");

  const flags: Record<string, number> = {
    "equipped.armor": armor ? 1 : 0,
    "equipped.shield": shield ? 1 : 0,
    "armor.light": armor?.entity?.armor?.category === "light" ? 1 : 0,
    "armor.medium": armor?.entity?.armor?.category === "medium" ? 1 : 0,
    "armor.heavy": armor?.entity?.armor?.category === "heavy" ? 1 : 0,
  };

  const stats = new StatEngine((path) => {
    if (path in flags) return flags[path];
    if (path.startsWith("tag.")) return tags.has(path.slice(4)) ? 1 : 0;
    if (path.startsWith("class.") && path.endsWith(".level")) return 0; // classes not taken
    if (path.startsWith("prof.")) {
      const [, kind, ...rest] = path.split(".");
      const lvl = proficiency(kind as ProficiencyKind, rest.join("."));
      return lvl ? PROF_MULT[lvl] : 0;
    }
    return undefined;
  });

  /* core stats */
  stats.define("level", () => level, L("Character level", "角色等级"));
  stats.define("prof", () => sys.profBonus(level), L("Proficiency bonus by level", "等级对应熟练加值"));
  for (const [classId, n] of col.classLevels) {
    stats.define(`class.${classId.replace(/^class:/, "")}.level`, () => n, L("Class level", "职业等级"));
  }
  /** "Strength modifier" — named, so roll breakdowns read "+3 Strength modifier". */
  const modLabel = (a: Ability) => L(`${ABILITY_NAMES[a].en} modifier`, `${ABILITY_NAMES[a].zh}调整值`);
  for (const a of ABILITIES) {
    stats.define(`ability.${a}.score`, () => build.baseAbilities[a], L("Base score", "基础值"));
    stats.define(`ability.${a}.mod`, () => abilityMod(stats.get(`ability.${a}.score`)), modLabel(a));
    stats.define(`save.${a}`, () => {
      const mod = stats.get(`ability.${a}.mod`);
      const p = proficiency("save", a);
      const pb = p ? Math.floor(stats.get("prof") * PROF_MULT[p]) : 0;
      return { value: mod + pb, parts: [{ label: modLabel(a), value: mod }, ...(pb ? [{ label: L("Proficiency", "熟练"), value: pb }] : [])] };
    });
  }
  for (const [skill, def] of Object.entries(sys.skills)) {
    stats.define(`skill.${skill}`, () => {
      const mod = stats.get(`ability.${def.ability}.mod`);
      const p = proficiency("skill", skill);
      const pb = p ? Math.floor(stats.get("prof") * PROF_MULT[p]) : 0;
      return { value: mod + pb, parts: [{ label: modLabel(def.ability), value: mod }, ...(pb ? [{ label: p === "expertise" ? L("Expertise", "专精") : L("Proficiency", "熟练"), value: pb }] : [])] };
    });
    stats.define(`passive.${skill}`, () => 10 + stats.get(`skill.${skill}`), L("10 + skill", "10 + 技能"));
  }
  stats.define("initiative", () => stats.get("ability.dex.mod"), L("Dexterity modifier", "敏捷调整值"));

  const species = reg.getOf("species", build.speciesId);
  stats.define("speed.walk", () => species?.speed ?? 30, species?.name ?? L("Base speed", "基础速度"));
  for (const s of ["fly", "swim", "climb"]) stats.define(`speed.${s}`, () => 0);
  stats.define("sense.darkvision", () => 0);

  stats.define("ac", () => {
    const dex = stats.get("ability.dex.mod");
    const a = armor?.entity?.armor;
    if (!a) return { value: 10 + dex, parts: [{ label: L("Unarmored", "无甲"), value: 10 }, { label: L("Dexterity", "敏捷"), value: dex }] };
    const dexPart = a.category === "heavy" ? 0 : a.category === "medium" ? Math.min(dex, a.dexCap ?? 2) : dex;
    return {
      value: a.ac + dexPart,
      parts: [{ label: armor!.entity!.name, value: a.ac }, ...(a.category !== "heavy" ? [{ label: L("Dexterity", "敏捷"), value: dexPart }] : [])],
    };
  });
  // 2024 rules: a shield's AC needs training; heavy armor below its Strength score slows you
  const shieldTrained = !shield || !!proficiency("armor", "shield");
  if (shield?.entity?.armor && !shieldTrained) {
    issues.push({ severity: "warning", code: "shield-proficiency", path: shield.key, message: L("No shield training: the shield adds no AC", "未受训使用盾牌：盾牌不提供 AC 加值") });
  }
  const strNeed = armor?.entity?.armor?.strength;
  if (strNeed) {
    stats.addModifier({
      grant: { type: "modifier", target: "speed.walk", op: "add", value: -10, when: `@ability.str.score < ${strNeed}`, label: L(`Strength below ${strNeed}`, `力量低于 ${strNeed}`) },
      source: { path: `item:${armor!.key}`, kind: "item", name: armor!.entity!.name, entityId: armor!.item },
    });
  }
  if (shield?.entity?.armor && shieldTrained) {
    stats.addModifier({
      grant: { type: "modifier", target: "ac", op: "add", value: shield.entity.armor.ac },
      source: { path: `item:${shield.key}`, kind: "item", name: shield.entity.name, entityId: shield.item },
    });
  }

  // hit points: max die at level 1, then rolled or average
  stats.define("hp.max", () => {
    const con = stats.get("ability.con.mod");
    let dice = 0;
    build.levels.forEach((l, i) => {
      const die = reg.getOf("class", l.classId)?.hitDie ?? 8;
      const avg = Math.floor(die / 2) + 1;
      if (i === 0) dice += reg.system.hp.firstLevel === "max" ? die : avg;
      else dice += levelHp(reg, build, i);
    });
    const conTotal = con * level;
    return {
      value: Math.max(level, dice + conTotal),
      parts: [
        { label: L("Hit dice", "生命骰"), value: dice },
        { label: L("Constitution × level", "体质 × 等级"), value: conTotal },
      ],
    };
  });

  // generic attack/damage bonus stats used by weapon & spell actions
  stats.define("crit.bonus", () => 0, L("Natural 20 only", "仅天然 20"));
  stats.define("martial-arts.die", () => 0);
  for (const s of ["attack.melee", "attack.ranged", "attack.spell", "damage.melee", "damage.ranged", "spell.dc", "spell.attack"]) stats.define(s, () => 0);

  // all modifiers from grants
  for (const c of col.grants) if (c.grant.type === "modifier") stats.addModifier(c as Collected<ModifierGrant>);

  /* spellcasting */
  const casting = col.grants.filter((c): c is Collected<SpellcastingGrant> => c.grant.type === "spellcasting");
  const spellcasting: SpellcastingView[] = [];
  const casterLevels: number[] = [];
  let pact: Sheet["pact"];
  const multiclassCasters = new Set(casting.map((c) => c.grant.classId)).size > 1;
  for (const { grant: g } of dedupeBy(casting, (c) => c.grant.classId)) {
    const short = g.classId.replace(/^class:/, "");
    const lvl = col.classLevels.get(g.classId) ?? 0;
    const mod = stats.get(`ability.${g.ability}.mod`);
    stats.define(`spell.${short}.mod`, () => mod);
    stats.define(`spell.${short}.dc`, () => 8 + stats.get("prof") + mod + stats.get("spell.dc"), L("8 + proficiency + ability", "8 + 熟练 + 属性"));
    stats.define(`spell.${short}.attack`, () => stats.get("prof") + mod + stats.get("spell.attack"), L("Proficiency + ability", "熟练 + 属性"));
    let maxSpellLevel = 0;
    if (g.progression === "pact") {
      pact = sys.pactSlots(lvl);
      maxSpellLevel = pact.level;
    } else {
      const cl = sys.casterLevel(g.progression, lvl, multiclassCasters);
      casterLevels.push(g.progression === "full" ? lvl : g.progression === "half" ? lvl / 2 : lvl / 3);
      maxSpellLevel = sys.slots(cl).length;
    }
    stats.define(`spell.${short}.max-level`, () => maxSpellLevel);
    spellcasting.push({
      classId: g.classId,
      ability: g.ability,
      mod,
      dc: stats.get(`spell.${short}.dc`),
      attack: stats.get(`spell.${short}.attack`),
      mode: g.mode,
      list: g.list,
      cantripsMax: g.cantrips !== undefined ? stats.eval(g.cantrips) : 0,
      preparedMax: g.prepared !== undefined ? stats.eval(g.prepared) : 0,
      maxSpellLevel,
    });
  }
  let slots: number[] = [];
  if (casting.some((c) => c.grant.progression !== "pact" && c.grant.progression !== "none")) {
    if (!multiclassCasters) {
      const g = casting.find((c) => c.grant.progression !== "pact")!.grant;
      slots = sys.slots(sys.casterLevel(g.progression, col.classLevels.get(g.classId) ?? 0, false));
    } else {
      // multiclass: sum per-class contributions (half rounds up, third rounds down in 2024)
      let cl = 0;
      for (const { grant: g } of dedupeBy(casting, (c) => c.grant.classId)) {
        cl += sys.casterLevel(g.progression, col.classLevels.get(g.classId) ?? 0, true);
      }
      slots = sys.slots(cl);
    }
  }

  /* resources */
  const resources: ResourceView[] = [];
  for (const c of col.grants) {
    if (c.grant.type !== "resource") continue;
    const g = c.grant as ResourceGrant;
    const existing = resources.find((r) => r.id === g.id);
    const max = stats.eval(g.max);
    stats.define(`resource.${g.id}.max`, () => max);
    const view: ResourceView = {
      id: g.id,
      name: g.name,
      max,
      recovery: g.recovery.map((r) => ({ on: r.on, amount: r.amount === "all" ? "all" : stats.eval(r.amount) })),
      icon: g.icon,
      source: c.source,
      kind: "feature",
    };
    // a later grant of the same resource (e.g. higher level table) replaces the earlier one
    if (existing) Object.assign(existing, view);
    else resources.push(view);
  }
  const hitDice = new Map<number, number>();
  for (const [classId, n] of col.classLevels) {
    const die = reg.getOf("class", classId)?.hitDie ?? 8;
    hitDice.set(die, (hitDice.get(die) ?? 0) + n);
  }
  for (const [die, n] of [...hitDice].sort((a, b) => b[0] - a[0])) {
    resources.push({ id: `hitdie:d${die}`, name: L(`Hit Dice (d${die})`, `生命骰（d${die}）`), max: n, recovery: [{ on: "long", amount: "all" }], kind: "hitdie" });
  }

  /* spells */
  const spells: SpellView[] = [];
  for (const inst of col.spells) {
    const sp = reg.getOf("spell", inst.spellId);
    if (!sp) {
      issues.push({ severity: "error", code: "missing-entity", path: inst.path, message: L(`Unknown spell ${inst.spellId}`, `未知法术 ${inst.spellId}`) });
      continue;
    }
    const sc = spellcasting.find((s) => s.classId === inst.classId);
    const chosen = inst.abilityFrom ? ABILITIES.find((a) => tags.has(`spell-ability:${inst.abilityFrom}:${a}`)) : undefined;
    const ability: Ability =
      inst.ability ?? chosen ?? sc?.ability ?? (["int", "wis", "cha"] as const).reduce((a, b) => (stats.get(`ability.${b}.mod`) > stats.get(`ability.${a}.mod`) ? b : a));
    const mod = stats.get(`ability.${ability}.mod`);
    const own = !!(inst.ability ?? chosen);
    const dc = sc && !own ? sc.dc : 8 + stats.get("prof") + mod + stats.get("spell.dc");
    const attack = sc && !own ? sc.attack : stats.get("prof") + mod + stats.get("spell.attack");
    let freeResource: string | undefined;
    if (inst.free) {
      freeResource = `free:${inst.path}`;
      resources.push({
        id: freeResource,
        name: sp.name,
        max: stats.eval(inst.free.max),
        recovery: inst.free.recovery.map((r) => ({ on: r.on, amount: r.amount === "all" ? "all" : stats.eval(r.amount) })),
        source: inst.source,
        kind: "spell-free",
      });
    }
    const known = true;
    const isPrepared =
      sp.level === 0 ||
      !!inst.alwaysPrepared ||
      !sc ||
      sc.mode === "known" ||
      (build.prepared[sc.classId] ?? []).includes(sp.id);
    spells.push({ spellId: sp.id, name: sp.name, path: inst.path, level: sp.level, classId: inst.classId, ability, dc, attack, known, prepared: isPrepared, alwaysPrepared: !!inst.alwaysPrepared, freeResource, source: inst.source });
  }
  // "prepared" casters (cleric/druid/paladin 2024) prepare straight from the class list
  for (const sc of spellcasting) {
    if (sc.mode !== "prepared") continue;
    for (const id of build.prepared[sc.classId] ?? []) {
      if (spells.some((s) => s.spellId === id && s.classId === sc.classId)) continue;
      const sp = reg.getOf("spell", id);
      if (!sp) continue;
      spells.push({
        spellId: id,
        name: sp.name,
        path: `${sc.classId}/prepared=${id}`,
        level: sp.level,
        classId: sc.classId,
        ability: sc.ability,
        dc: sc.dc,
        attack: sc.attack,
        known: false,
        prepared: true,
        alwaysPrepared: false,
        source: { path: `${sc.classId}/prepared`, kind: "class", name: reg.get(sc.classId)?.name ?? sc.classId, entityId: sc.classId, classId: sc.classId },
      });
    }
  }

  /* actions */
  const actions: ResolvedAction[] = [];
  const resolveDice = (tpl: string, extra: Record<string, number> = {}) => {
    try {
      return normalizeDice(resolveTemplate(tpl, (p) => (p in extra ? extra[p] : stats.resolve(p)), { onUnknown: () => 0 }));
    } catch {
      return tpl;
    }
  };
  /** "[[formula]]" inside action text -> its current value (Rage Damage +[[...]]). */
  const resolveText = (text: LocalizedText | undefined): LocalizedText | undefined => {
    const one = (x: string) => (x.includes("[[") ? x.replace(/\[\[(.+?)\]\]/g, (_, f: string) => String(Math.floor(stats.eval(f)))) : x);
    if (text === undefined || typeof text === "string") return text === undefined ? text : one(text);
    return Object.fromEntries(Object.entries(text).map(([k, v]) => [k, typeof v === "string" ? one(v) : v])) as LocalizedText;
  };
  const economyCost = (a: Activation): Cost[] => (a === "action" || a === "bonus" || a === "reaction" ? [{ economy: a }] : []);
  const resolveCosts = (costs: Cost[] | undefined): Cost[] =>
    (costs ?? []).map((c): Cost => ("resource" in c ? { resource: c.resource, amount: stats.eval(c.amount ?? 1) } : c));

  for (const c of col.grants) {
    if (c.grant.type !== "action") continue;
    const a = c.grant.action;
    actions.push({
      id: `${c.source.path}#${a.id}`,
      name: a.name,
      text: resolveText(a.text),
      activation: a.activation,
      trigger: a.trigger,
      range: a.range,
      target: a.target,
      duration: a.duration,
      concentration: a.concentration,
      category: a.category ?? (c.source.kind === "global" ? "basic" : "feature"),
      tags: a.tags ?? [],
      source: c.source,
      attack: a.attack ? { bonus: stats.eval(a.attack.bonus), kind: a.attack.kind } : undefined,
      save: a.save ? { ability: a.save.ability, dc: stats.eval(a.save.dc), onSave: a.save.onSave } : undefined,
      damage: a.damage?.map((d) => ({ dice: resolveDice(d.dice), type: d.type })),
      heal: a.heal ? { dice: resolveDice(a.heal.dice) } : undefined,
      costs: [...economyCost(a.activation), ...resolveCosts(a.cost)],
      applies: a.applies,
      available: a.when ? !!stats.eval(a.when) : true,
      sound: a.sound,
    });
  }

  // weapon attacks
  for (const it of items) {
    const w = it.entity?.weapon;
    if (!w) continue;
    const finesse = w.properties.includes("finesse");
    const str = stats.get("ability.str.mod");
    const dex = stats.get("ability.dex.mod");
    // Martial Arts (monk): simple melee weapons and light martial melee weapons may use Dex and the Martial Arts die
    const monkWeapon = tags.has("martial-arts") && w.kind === "melee" && (w.category === "simple" || w.properties.includes("light"));
    const ability = w.kind === "ranged" || ((finesse || monkWeapon) && dex > str) ? "dex" : "str";
    const mod = ability === "dex" ? dex : str;
    const maDie = monkWeapon ? stats.get("martial-arts.die") : 0;
    const die = (d: string) => (maDie && /^1d\d+$/.test(d) && Number(d.slice(2)) < maDie ? `1d${maDie}` : d);
    const proficient = !!(proficiency("weapon", w.category) || proficiency("weapon", it.item));
    const kind = w.kind;
    const bonus = mod + (proficient ? stats.get("prof") : 0) + stats.get(`attack.${kind}`);
    const dmgBonus = mod + stats.get(`damage.${kind}`);
    const dmg = (die: string) => normalizeDice(`${die}+${dmgBonus}`);
    const mastery = w.mastery && proficiency("mastery", it.item) ? w.mastery : undefined;
    actions.push({
      id: `weapon:${it.key}`,
      name: it.entity!.name,
      text: it.entity!.text,
      activation: "action",
      range: w.range ? w.range : L("Melee (5 ft)", "近战（5 尺）"),
      category: "attack",
      tags: ["weapon", ...w.properties],
      source: { path: `item:${it.key}`, kind: "item", name: it.entity!.name, entityId: it.item },
      attack: { bonus, kind },
      damage: [{ dice: dmg(die(w.damage)), type: w.damageType }],
      costs: [{ economy: "action" }],
      weapon: {
        itemKey: it.key,
        properties: w.properties,
        mastery,
        versatile: w.versatile ? dmg(die(w.versatile)) : undefined,
        range: w.range,
        equipped: it.equipped,
        mod,
        ability,
        die: die(w.damage),
        versatileDie: w.versatile ? die(w.versatile) : undefined,
        proficient,
      },
      available: true,
    });
    if (!proficient) {
      issues.push({ severity: "warning", code: "weapon-proficiency", path: it.key, message: L(`Not proficient with ${it.item}`, `未熟练该武器：${it.item}`) });
    }
  }

  // spell actions
  const tier = sys.cantripTier(level);
  for (const s of spells) {
    if (!s.prepared && !s.freeResource) continue;
    const sp = reg.getOf("spell", s.spellId)!;
    const a = sp.action;
    const extra = { "spell.mod": stats.get(`ability.${s.ability}.mod`), spellmod: stats.get(`ability.${s.ability}.mod`) };
    const scale = (tpl: string) => {
      const d = resolveDice(tpl, extra);
      return sp.level === 0 && sp.cantripScaling ? multiplyDice(d, tier) : d;
    };
    const costs: Cost[] = [...economyCost(sp.activation)];
    // free casts (species / feat spells) are the default; slots remain available via upcasting UI
    if (s.freeResource) costs.push({ resource: s.freeResource, amount: 1 });
    else if (sp.level > 0) costs.push({ slot: sp.level });
    actions.push({
      id: `spell:${s.path}`,
      name: sp.name,
      text: sp.text,
      activation: sp.activation,
      trigger: a?.trigger,
      range: sp.range,
      target: a?.target,
      duration: sp.duration,
      concentration: sp.concentration,
      category: "spell",
      tags: [...(sp.tags ?? []), sp.school],
      source: s.source,
      attack: a?.attack ? { bonus: s.attack, kind: "spell" } : undefined,
      save: a?.save ? { ability: a.save.ability, dc: s.dc, onSave: a.save.onSave } : undefined,
      damage: a?.damage?.map((d) => ({ dice: scale(d.dice), type: d.type })),
      heal: a?.heal ? { dice: scale(a.heal.dice) } : undefined,
      costs,
      applies: a?.applies,
      spell: {
        id: sp.id,
        level: sp.level,
        upcastDamage: sp.upcast?.damage ? resolveDice(sp.upcast.damage, extra) : undefined,
        upcastHeal: sp.upcast?.heal ? resolveDice(sp.upcast.heal, extra) : undefined,
        ritual: sp.ritual,
        ability: s.ability,
      },
      available: true,
    });
  }

  // usable items (potions, alchemist's fire...): one action per stack, equipped or not
  for (const it of items) {
    const e = it.entity;
    const u = e?.use;
    if (!e || !u) continue;
    actions.push({
      id: `item:${it.key}`,
      name: e.name,
      text: resolveText(u.text ?? e.text),
      activation: u.activation,
      trigger: u.trigger,
      range: u.range,
      target: u.target,
      duration: u.duration,
      concentration: u.concentration,
      category: "item",
      tags: [...(u.tags ?? []), ...(e.consumable ? ["consumable"] : [])],
      source: { path: `item:${it.key}`, kind: "item", name: e.name, entityId: e.id },
      attack: u.attack ? { bonus: stats.eval(u.attack.bonus), kind: u.attack.kind } : undefined,
      save: u.save ? { ability: u.save.ability, dc: stats.eval(u.save.dc), onSave: u.save.onSave } : undefined,
      damage: u.damage?.map((d) => ({ dice: resolveDice(d.dice), type: d.type })),
      heal: u.heal ? { dice: resolveDice(u.heal.dice) } : undefined,
      costs: [...economyCost(u.activation), ...resolveCosts(u.cost), ...(e.consumable ? [{ item: it.key, amount: 1 }] : [])],
      applies: u.applies,
      item: { key: it.key, entityId: e.id, qty: it.qty, consumable: !!e.consumable },
      available: u.when ? !!stats.eval(u.when) : true,
      sound: u.sound,
    });
  }

  /* features */
  const features: FeatureView[] = col.grants
    .filter((c): c is Collected<FeatureGrant> => c.grant.type === "feature")
    .map((c) => ({ id: `${c.source.path}/${c.grant.id}`, name: c.grant.name, text: c.grant.text, tags: c.grant.tags, source: c.source }));

  /* choices */
  const choices: ChoiceView[] = col.choices.map((ch) => {
    let count = 0;
    try {
      count = stats.eval(ch.choice.count);
    } catch {
      count = 0;
    }
    return { ...ch, count, remaining: Math.max(0, count - ch.selected.length) };
  });

  /* assemble */
  const abilities = Object.fromEntries(
    ABILITIES.map((a) => [a, { score: stats.get(`ability.${a}.score`), mod: stats.get(`ability.${a}.mod`), save: stats.get(`save.${a}`), saveProf: !!proficiency("save", a) }]),
  ) as Record<Ability, AbilityView>;
  const skills = Object.fromEntries(
    Object.entries(sys.skills).map(([k, d]) => [k, { ability: d.ability, value: stats.get(`skill.${k}`), prof: proficiency("skill", k), passive: stats.get(`passive.${k}`) }]),
  );

  const subclassOf = (classId: string) => col.entities.find((e) => e.entity.type === "subclass" && (e.entity as EntityOf<"subclass">).classId === classId)?.entity.id;

  if (armor?.entity?.armor && !proficiency("armor", armor.entity.armor.category)) {
    issues.push({
      severity: "warning",
      code: "armor-proficiency",
      path: armor.key,
      message: L("Untrained armor: Disadvantage on Strength and Dexterity tests, and no spellcasting", "未受训的护甲：力量、敏捷相关检定、豁免和攻击具有劣势，且无法施法"),
    });
  }
  if (strNeed && abilities.str.score < strNeed) {
    issues.push({ severity: "warning", code: "armor-strength", path: armor!.key, message: L(`Strength ${abilities.str.score} is below ${strNeed}: Speed −10 ft`, `力量 ${abilities.str.score} 低于 ${strNeed}：速度 −10 尺`) });
  }

  const dice: DiceBonusView[] = col.grants.flatMap((c): DiceBonusView[] => {
    const g = c.grant;
    if (g.type !== "dice" || (g.when && !stats.eval(g.when))) return [];
    const resolved = resolveTemplate(g.dice, stats.resolve, { onUnknown: () => 0 }).replace(/\s+/g, "");
    return [{ on: g.on, dice: resolved, damageType: g.damageType, kinds: g.kinds, properties: g.properties, once: g.once, label: g.label ?? c.source.name, source: c.source }];
  });

  const sheet: Sheet = {
    level,
    prof: stats.get("prof"),
    classes: col.classOrder.map((id) => ({ id, level: col.classLevels.get(id) ?? 0, hitDie: reg.getOf("class", id)?.hitDie ?? 8, subclass: subclassOf(id) })),
    speciesId: build.speciesId,
    backgroundId: build.backgroundId,
    size: species?.size,
    abilities,
    skills,
    ac: stats.get("ac"),
    critRange: 20 - stats.get("crit.bonus"),
    initiative: stats.get("initiative"),
    speed: { walk: stats.get("speed.walk"), fly: stats.get("speed.fly"), swim: stats.get("speed.swim"), climb: stats.get("speed.climb") },
    hpMax: stats.get("hp.max"),
    senses: { darkvision: stats.get("sense.darkvision") },
    dice,
    proficiencies: [...profMap.values()],
    tags: [...tags],
    features,
    resources,
    spellcasting,
    slots,
    pact,
    spells,
    actions,
    items,
    choices,
    pendingCount: choices.reduce((n, c) => n + c.remaining, 0),
    issues,
    warnings: stats.warnings,
    collected: col,
    stats,
    explain: (s) => stats.explain(s),
    proficiency,
  };
  return sheet;
}

const GEAR_CODES = ["armor-proficiency", "shield-proficiency", "armor-strength"];
/** Rule problems one stack of gear causes: untrained armor or shield, too heavy to move freely in. */
export const gearIssues = (sheet: Sheet, key: string): Issue[] => sheet.issues.filter((i) => i.path === key && GEAR_CODES.includes(i.code));

/* ───────────────────────── helpers ───────────────────────── */

function dedupeBy<T>(list: T[], key: (t: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const t of list) seen.set(key(t), t); // last wins (later levels refine earlier grants)
  return [...seen.values()];
}

/** "1d8+3+0" -> "1d8+3"; falls back to the input when it is not a dice expression. */
export function normalizeDice(expr: string): string {
  try {
    const terms = parseDice(expr);
    const dice = terms.filter((t) => t.kind === "dice");
    const constant = terms.reduce((s, t) => s + (t.kind === "const" ? t.sign * t.value : 0), 0);
    const out = formatDice(dice);
    if (!out) return String(constant);
    return constant ? `${out}${constant > 0 ? "+" : ""}${constant}` : out;
  } catch {
    return expr;
  }
}

/** Multiply the dice counts of an expression (cantrip scaling, crits). */
export function multiplyDice(expr: string, factor: number): string {
  if (factor === 1) return expr;
  try {
    return formatDice(parseDice(expr).map((t) => (t.kind === "dice" ? { ...t, count: t.count * factor } : t)));
  } catch {
    return expr;
  }
}
