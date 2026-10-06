import { applyOps } from "../build/mutations";
import { autofill } from "../build/autofill";
import { derive } from "../derive/sheet";
import { Engine } from "../engine";
import { parseFormula, resolveTemplate } from "../formula";
import type { ActionDef, Entity, Formula, Grant, RulePack } from "../schema/types";
import { parseRulePack } from "../schema/zod";
import { localize } from "../text";
import type { PackStats } from "./registry";

export interface PackReport {
  ok: boolean;
  /** Problems that break the pack: bad shape, missing references, formulas that don't parse. */
  errors: string[];
  /** Likely mistakes that still load: unknown stat references, unusual ids, failed smoke builds. */
  warnings: string[];
  stats?: PackStats;
  /** Example characters built with the pack's content, e.g. "class:x 1–20". */
  smoke: string[];
}

/**
 * Everything an author should hear about a rule pack before sharing it: the schema,
 * whether ids it points at exist (in itself or `base`), whether its formulas parse,
 * and what happens when characters are actually built with its classes, species,
 * backgrounds and feats. Used by `pnpm validate:pack` and the pack tests.
 */
export function checkPack(data: unknown, base: RulePack[]): PackReport {
  const parsed = parseRulePack(data);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: [], smoke: [] };
  const pack = parsed.value;
  const errors: string[] = [];
  const warnings: string[] = [];
  const smoke: string[] = [];

  const packs = [...base.filter((p) => p.id !== pack.id), pack];
  const engine = new Engine(packs);
  const reg = engine.reg;
  const stats = reg.statsOf(pack.id);
  for (const t of stats?.missingTargets ?? []) errors.push(`patch target ${t} does not exist`);
  for (const r of pack.requires ?? []) if (!packs.some((p) => p.id === r)) warnings.push(`requires "${r}", which is not loaded here; references into it are reported as missing`);

  // ids
  const seen = new Set<string>();
  for (const e of pack.entities) {
    if (seen.has(e.id)) errors.push(`${e.id}: defined twice in this pack`);
    seen.add(e.id);
    if (!e.id.includes(":")) warnings.push(`${e.id}: ids are usually "<type>:<name>" (e.g. "feat:${e.id}")`);
  }

  // references and formulas, entity by entity
  const exists = (id: string) => !!reg.get(id);
  const formula = (where: string, f: Formula | undefined) => {
    if (typeof f !== "string") return;
    try {
      parseFormula(f);
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
    }
  };
  const template = (where: string, s: string | undefined) => {
    if (!s) return;
    try {
      resolveTemplate(s, () => 0);
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
    }
  };
  const ref = (where: string, id: string | undefined) => {
    if (id && !exists(id)) errors.push(`${where}: ${id} does not exist`);
  };
  const action = (where: string, a: Partial<ActionDef> | undefined) => {
    if (!a) return;
    formula(`${where} when`, a.when);
    formula(`${where} attack`, a.attack?.bonus);
    formula(`${where} save DC`, a.save?.dc);
    for (const d of a.damage ?? []) template(`${where} damage`, d.dice);
    template(`${where} heal`, a.heal?.dice);
    for (const c of a.cost ?? []) if ("resource" in c) formula(`${where} cost`, c.amount);
    for (const x of a.applies ?? []) ref(`${where} applies`, x.effect);
  };
  const grants = (where: string, list: Grant[] | undefined) => {
    for (const g of list ?? []) {
      switch (g.type) {
        case "modifier":
          formula(`${where} modifier ${g.target}`, g.value);
          formula(`${where} modifier ${g.target} when`, g.when);
          break;
        case "resource":
          formula(`${where} resource ${g.id}`, g.max);
          for (const r of g.recovery) if (r.amount !== "all") formula(`${where} resource ${g.id} recovery`, r.amount);
          break;
        case "action":
          action(`${where} action ${g.action.id}`, g.action);
          break;
        case "feature":
          grants(`${where} › ${g.id}`, g.grants);
          break;
        case "choice":
          formula(`${where} choice ${g.id} count`, g.count);
          if (g.from.kind === "options") for (const o of g.from.options) grants(`${where} › ${g.id}/${o.id}`, o.grants);
          if (g.from.kind === "entity") {
            for (const id of g.from.ids ?? []) ref(`${where} choice ${g.id}`, id);
            formula(`${where} choice ${g.id} minLevel`, g.from.minLevel);
            formula(`${where} choice ${g.id} maxLevel`, g.from.maxLevel);
          }
          break;
        case "grant":
          ref(where, g.entity);
          break;
        case "spellcasting":
          ref(`${where} spellcasting`, g.classId);
          formula(`${where} cantrips`, g.cantrips);
          formula(`${where} prepared`, g.prepared);
          break;
        case "spell":
          ref(where, g.spell);
          formula(`${where} ${g.spell} uses`, g.free?.max);
          break;
        case "item":
          ref(where, g.item);
          break;
      }
    }
  };
  const entity = (e: Entity) => {
    const w = e.id;
    grants(w, e.grants);
    formula(`${w} prereq`, e.prereq?.formula);
    if (e.type === "class") {
      grants(`${w} starting`, e.starting);
      grants(`${w} multiclass`, e.multiclass);
      for (const [lvl, list] of Object.entries(e.levels)) grants(`${w}@${lvl}`, list);
    }
    if (e.type === "subclass") {
      ref(w, e.classId);
      for (const [lvl, list] of Object.entries(e.levels)) grants(`${w}@${lvl}`, list);
    }
    if (e.type === "spell") action(w, e.action);
    if (e.type === "item") {
      for (const c of e.contents ?? []) ref(`${w} contents`, c.item);
      action(`${w} use`, e.use);
      if (e.weapon?.mastery && !exists(`mastery:${e.weapon.mastery}`)) warnings.push(`${w}: weapon mastery "${e.weapon.mastery}" has no mastery:${e.weapon.mastery} entry`);
    }
  };
  pack.entities.forEach(entity);
  for (const p of pack.patches ?? []) {
    grants(`patch ${p.target}`, p.grants?.add);
    grants(`patch ${p.target} starting`, p.starting?.add);
    for (const [lvl, ed] of Object.entries(p.levels ?? {})) grants(`patch ${p.target}@${lvl}`, ed.add);
  }

  // smoke builds: real characters using the pack's content
  const first = (type: "class" | "species" | "background") => reg.all(type).find((e) => !pack.entities.includes(e as Entity))?.id ?? reg.all(type)[0]?.id;
  const build = (label: string, o: { classId?: string; speciesId?: string; backgroundId?: string; level: number; prefer?: Record<string, string[]>; active?: string[] }) => {
    const classId = o.classId ?? first("class");
    if (!classId) return;
    try {
      let b = engine.newCharacter("check", { level: o.level }).build;
      b = applyOps(b, [
        { op: "setAbilities", method: "standard", scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } },
        ...(o.speciesId ?? first("species") ? [{ op: "setSpecies" as const, id: (o.speciesId ?? first("species"))! }] : []),
        ...(o.backgroundId ?? first("background") ? [{ op: "setBackground" as const, id: (o.backgroundId ?? first("background"))! }] : []),
        { op: "setClass", id: classId },
        { op: "setLevel", level: o.level },
      ]);
      b = autofill(engine, b, o.prefer ?? {});
      const sheet = derive(reg, b, { activeEffects: o.active });
      for (const w of sheet.warnings) warnings.push(`${label}: ${w}`);
      for (const i of engine.evaluate(b).issues.filter((x) => x.severity === "error")) warnings.push(`${label}: ${localize(i.message, "en")}`);
      smoke.push(label);
    } catch (e) {
      errors.push(`${label}: building a character failed — ${(e as Error).message}`);
    }
  };
  for (const e of pack.entities) {
    if (e.type === "class") {
      const top = Math.min(reg.system.maxLevel, Math.max(1, ...Object.keys(e.levels).map(Number)));
      build(`${e.id} level ${top}`, { classId: e.id, level: top });
    }
    if (e.type === "subclass") {
      const cls = reg.getOf("class", e.classId);
      if (cls) build(`${e.id} level ${reg.system.maxLevel}`, { classId: cls.id, level: reg.system.maxLevel, prefer: { [`${cls.id}@${cls.subclassLevel}/subclass`]: [e.id] } });
    }
    if (e.type === "species") build(`${e.id} level 5`, { speciesId: e.id, level: 5 });
    if (e.type === "background") build(`${e.id} level 1`, { backgroundId: e.id, level: 1 });
    if (e.type === "feat" || e.type === "effect" || e.type === "condition") build(`${e.id} on a level 5 character`, { level: 5, active: [e.id] });
  }
  if (pack.systemConfig) build("house rules on a level 1 character", { level: 1 });

  return { ok: !errors.length, errors, warnings: [...new Set(warnings)], stats, smoke };
}
