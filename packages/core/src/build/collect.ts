import type { PackRegistry } from "../pack/registry";
import type {
  Ability,
  Build,
  ChoiceGrant,
  Entity,
  Grant,
  ProficiencyGrant,
  ModifierGrant,
  Recovery,
  Formula,
} from "../schema/types";
import type { LocalizedText } from "../text";

/**
 * Collection phase: walk everything reachable from a build (global grants,
 * species, background, class levels, choices, items, active effects) and flatten
 * it into grants tagged with where they came from. No numbers are computed here.
 */

export type SourceKind =
  | "global"
  | "species"
  | "background"
  | "class"
  | "subclass"
  | "feat"
  | "feature"
  | "option"
  | "item"
  | "effect"
  | "spell"
  | "choice";

export interface SourceRef {
  /** Stable, unique path of the grant's origin, e.g. "class:fighter@1/fighting-style=feat:archery". */
  path: string;
  kind: SourceKind;
  name: LocalizedText;
  entityId?: string;
  /** Character level (class levels) or class level this came from. */
  level?: number;
  classId?: string;
}

export interface Collected<G extends Grant = Grant> {
  grant: G;
  source: SourceRef;
}

export interface ChoiceInstance {
  path: string;
  choice: ChoiceGrant;
  source: SourceRef;
  selected: string[];
}

export interface EntityInstance {
  path: string;
  entity: Entity;
  source: SourceRef;
  /** Set when the entity was picked through a choice. */
  viaChoice?: string;
}

export interface SpellInstance {
  spellId: string;
  path: string;
  source: SourceRef;
  classId?: string;
  ability?: Ability;
  alwaysPrepared?: boolean;
  free?: { max: Formula; recovery: Recovery[] };
}

export interface ItemInstance {
  key: string;
  item: string;
  qty: number;
  equipped: boolean;
  source?: SourceRef;
}

export interface Issue {
  severity: "error" | "warning";
  code: string;
  path?: string;
  message: LocalizedText;
}

export interface CollectResult {
  grants: Collected[];
  choices: ChoiceInstance[];
  entities: EntityInstance[];
  spells: SpellInstance[];
  items: ItemInstance[];
  classLevels: Map<string, number>;
  classOrder: string[];
  issues: Issue[];
}

const MAX_DEPTH = 24;

export function classLevels(build: Build): { order: string[]; levels: Map<string, number> } {
  const levels = new Map<string, number>();
  const order: string[] = [];
  for (const l of build.levels) {
    if (!levels.has(l.classId)) order.push(l.classId);
    levels.set(l.classId, (levels.get(l.classId) ?? 0) + 1);
  }
  return { order, levels };
}

function classOfPath(path: string): string | undefined {
  const m = /^(class:[^@/=]+)/.exec(path);
  return m?.[1];
}

export function collect(reg: PackRegistry, build: Build, activeEffects: string[] = []): CollectResult {
  const res: CollectResult = {
    grants: [],
    choices: [],
    entities: [],
    spells: [],
    items: [],
    classLevels: new Map(),
    classOrder: [],
    issues: [],
  };
  const { order, levels } = classLevels(build);
  res.classLevels = levels;
  res.classOrder = order;

  const visitGrants = (grants: Grant[] | undefined, source: SourceRef, depth: number) => {
    if (!grants) return;
    if (depth > MAX_DEPTH) {
      res.issues.push({ severity: "error", code: "depth", path: source.path, message: { en: "Grant nesting too deep (cycle?)", zh: "授予嵌套过深（可能存在循环）" } });
      return;
    }
    const itemCounts = new Map<string, number>();
    for (const g of grants) {
      if ((g.type === "feature" || g.type === "spell") && g.minLevel && build.levels.length < g.minLevel) continue;
      res.grants.push({ grant: g, source });
      switch (g.type) {
        case "feature":
          visitGrants(g.grants, { ...source, path: `${source.path}/${g.id}`, kind: "feature", name: g.name }, depth + 1);
          break;
        case "choice":
          visitChoice(g, source, depth);
          break;
        case "grant": {
          const e = reg.get(g.entity);
          if (!e) {
            res.issues.push(missing(g.entity, source.path));
            break;
          }
          visitEntity(e, `${source.path}/${e.id}`, source, depth + 1);
          break;
        }
        case "spell":
          res.spells.push({
            spellId: g.spell,
            path: `${source.path}/${g.spell}`,
            source,
            classId: classOfPath(source.path),
            ability: g.ability,
            alwaysPrepared: g.alwaysPrepared ?? true,
            free: g.free,
          });
          break;
        case "item": {
          const n = itemCounts.get(g.item) ?? 0;
          itemCounts.set(g.item, n + 1);
          const key = `${source.path}/${g.item}${n ? `#${n}` : ""}`;
          res.items.push({ key, item: g.item, qty: g.qty ?? 1, equipped: build.equipped[key] ?? g.equipped ?? false, source });
          break;
        }
      }
    }
  };

  const visitChoice = (g: ChoiceGrant, source: SourceRef, depth: number) => {
    const path = `${source.path}/${g.id}`;
    const selected = build.choices[path] ?? [];
    res.choices.push({ path, choice: g, source, selected });
    const from = g.from;
    for (const sel of selected) {
      const selSource: SourceRef = { ...source, path: `${path}=${sel}`, kind: "choice", name: g.name };
      switch (from.kind) {
        case "entity": {
          const e = reg.get(sel);
          if (!e) {
            res.issues.push(missing(sel, path));
            continue;
          }
          if (e.type === "spell") {
            res.spells.push({
              spellId: e.id,
              path: `${path}=${sel}`,
              source,
              classId: classOfPath(path),
              ability: from.spell?.ability,
              alwaysPrepared: from.spell?.alwaysPrepared,
              free: from.spell?.free,
            });
            res.entities.push({ path: `${path}=${sel}`, entity: e, source, viaChoice: path });
          } else {
            visitEntity(e, `${path}=${sel}`, source, depth + 1, path);
          }
          break;
        }
        case "options": {
          const opt = from.options.find((o) => o.id === sel);
          if (!opt) {
            res.issues.push({ severity: "error", code: "bad-option", path, message: { en: `Unknown option "${sel}"`, zh: `未知选项“${sel}”` } });
            continue;
          }
          visitGrants(opt.grants, { ...selSource, kind: "option", name: opt.name }, depth + 1);
          break;
        }
        case "proficiency": {
          const pg: ProficiencyGrant = { type: "proficiency", kind: from.profKind, key: sel, level: from.level ?? "proficient" };
          res.grants.push({ grant: pg, source: selSource });
          break;
        }
        case "ability": {
          const [ab, amt] = sel.split(":");
          const mg: ModifierGrant = { type: "modifier", target: `ability.${ab}.score`, op: "add", value: Number(amt) || 0 };
          res.grants.push({ grant: mg, source: { ...selSource, name: source.name } });
          break;
        }
      }
    }
  };

  const visitEntity = (e: Entity, path: string, parent: SourceRef, depth: number, viaChoice?: string) => {
    if (depth > MAX_DEPTH) return;
    const kind: SourceKind =
      e.type === "species" || e.type === "background" || e.type === "class" || e.type === "subclass" || e.type === "feat" || e.type === "item" || e.type === "spell"
        ? e.type
        : "effect";
    const source: SourceRef = { path, kind, name: e.name, entityId: e.id, classId: parent.classId ?? classOfPath(path) };
    res.entities.push({ path, entity: e, source, viaChoice });
    if (e.type === "subclass") {
      const lvl = levels.get(e.classId) ?? 0;
      for (let i = 1; i <= lvl; i++) {
        visitGrants(e.levels[String(i)], { ...source, path: `${path}@${i}`, level: i, classId: e.classId }, depth + 1);
      }
      return;
    }
    visitGrants(e.grants, source, depth + 1);
  };

  // global grants (basic actions, unarmed strike...)
  visitGrants(reg.globalGrants, { path: "global", kind: "global", name: { en: "Rules", zh: "规则" } }, 0);

  // species & background
  for (const [id, type] of [
    [build.speciesId, "species"],
    [build.backgroundId, "background"],
  ] as const) {
    if (!id) continue;
    const e = reg.getOf(type, id);
    if (!e) {
      res.issues.push(missing(id, type));
      continue;
    }
    visitEntity(e, e.id, { path: "", kind: type, name: e.name }, 1);
  }

  // classes, in the order first taken
  order.forEach((classId, idx) => {
    const cls = reg.getOf("class", classId);
    if (!cls) {
      res.issues.push(missing(classId, "class"));
      return;
    }
    const base: SourceRef = { path: cls.id, kind: "class", name: cls.name, entityId: cls.id, classId: cls.id, level: 1 };
    res.entities.push({ path: cls.id, entity: cls, source: base });
    visitGrants(idx === 0 ? cls.starting : cls.multiclass, base, 1);
    visitGrants(cls.grants, base, 1);
    const n = levels.get(classId) ?? 0;
    for (let i = 1; i <= n; i++) {
      visitGrants(cls.levels[String(i)], { ...base, path: `${cls.id}@${i}`, level: i }, 1);
    }
  });

  // manually added inventory
  for (const entry of build.inventory) {
    res.items.push({ key: entry.key, item: entry.item, qty: entry.qty, equipped: build.equipped[entry.key] ?? entry.equipped ?? false });
  }
  // equipped items contribute their own grants (magic items, shields with properties...)
  for (const it of res.items) {
    const e = reg.getOf("item", it.item);
    if (!e) {
      res.issues.push(missing(it.item, it.key));
      continue;
    }
    if (it.equipped && e.grants?.length) {
      visitGrants(e.grants, { path: `item:${it.key}`, kind: "item", name: e.name, entityId: e.id }, 1);
    }
  }

  // active effects & conditions from play
  for (const id of activeEffects) {
    const e = reg.get(id);
    if (!e) continue;
    visitGrants(e.grants, { path: `effect:${id}`, kind: "effect", name: e.name, entityId: id }, 1);
  }

  return res;
}

function missing(id: string, path: string): Issue {
  return {
    severity: "error",
    code: "missing-entity",
    path,
    message: { en: `"${id}" is not in any enabled pack`, zh: `已启用的规则包中找不到“${id}”` },
  };
}
