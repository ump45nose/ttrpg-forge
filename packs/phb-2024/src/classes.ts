import type { ClassEntity, Entity, Grant, SubclassEntity } from "@forge/core";
import type { PhbBenefit, PhbClass, PhbFeature } from "./data";
import { retext } from "./feats";
import { SUBCLASS_OVERLAYS } from "./subclasses";
import { bi, clone, enOf, slug, walkGrants } from "./util";

/** Features above this level are left out until their mechanics exist (the SRD pack caps play at 8). */
export const CLASS_MAX_LEVEL = 8;

/**
 * PHB feature slug -> grant id at that level, where they differ. ASI and "<Class> Subclass"
 * are handled generically below.
 */
const FEATURE_ALIAS: Record<string, string> = {};

/** Ids of the grants a PHB feature at `level` can attach to. */
function aliasesFor(cls: string, level: number, grants: Grant[]): Record<string, string> {
  const out: Record<string, string> = { ...FEATURE_ALIAS, [`${cls}-subclass`]: "subclass" };
  for (const g of grants) {
    if (g.type !== "choice") continue;
    // the ASI feat choice is "feat" at 4 and "feat-<n>" later
    if (g.from.kind === "entity" && g.from.entityType === "feat" && g.from.tags?.includes("general")) out["ability-score-improvement"] = g.id;
    // repeated features: "expertise" at 6 is the choice "expertise-6"
    const m = /^(.*)-(\d+)$/.exec(g.id);
    if (m && Number(m[2]) === level) out[m[1]!] = g.id;
  }
  return out;
}

/** Attach PHB names/text to the grants of one level; unmatched PHB features become text-only features. */
function mergeLevel(grants: Grant[], features: PhbFeature[], aliases: Record<string, string>, extras: PhbBenefit[]): Grant[] {
  const used = retext(grants, features, aliases);
  // sub-entries (Monk's Focus -> Flurry of Blows, Primal Order -> Warden) and whole-page option
  // lists (Metamagic) name the options and actions they describe
  const items = [...features.flatMap((f) => f.items), ...extras];
  const itemFor = (id: string) => items.find((x) => x.en && slug(x.en) === id);
  walkGrants(grants, (g) => {
    if (g.type === "action") {
      const it = itemFor(g.action.id);
      if (it) g.action.name = bi(enOf(g.action.name) ?? it.en ?? undefined, it.zh);
    } else if (g.type === "choice" && g.from.kind === "options") {
      for (const o of g.from.options) {
        const it = itemFor(o.id);
        if (!it) continue;
        o.name = bi(enOf(o.name) ?? it.en ?? undefined, it.zh);
        o.text = bi(enOf(o.text), it.text);
      }
    }
  });
  const extra = features
    .filter((f) => !used.has(f))
    .map((f): Grant => ({ type: "feature", id: slug(f.en ?? f.zh), name: bi(f.en ?? undefined, f.zh), text: bi(undefined, f.text) }));
  return [...grants, ...extra];
}

/** ASI is described once (at level 4) but granted again at 8, 12...: reuse that text everywhere. */
function fillAsi(levels: Record<string, Grant[]>, asi: PhbFeature | undefined) {
  if (!asi) return;
  for (const grants of Object.values(levels))
    walkGrants(grants, (g) => {
      if (g.type === "choice" && g.from.kind === "entity" && g.from.entityType === "feat" && g.from.tags?.includes("general") && !g.text) {
        g.name = bi(enOf(g.name), asi.zh);
        g.text = bi(undefined, asi.text);
      }
    });
}

function mergeLevels(levels: Record<string, Grant[]>, features: PhbFeature[], cls: string, extras: PhbBenefit[] = []): Record<string, Grant[]> {
  const out: Record<string, Grant[]> = {};
  const all = new Set([...Object.keys(levels).map(Number), ...features.map((f) => f.level)]);
  for (const lv of [...all].sort((a, b) => a - b)) {
    if (lv > CLASS_MAX_LEVEL) continue;
    const grants = levels[String(lv)] ?? [];
    out[String(lv)] = mergeLevel(grants, features.filter((f) => f.level === lv), aliasesFor(cls, lv, grants), extras);
  }
  return out;
}

/** Skill keys offered by a class's level-1 skill choice. */
function classSkills(cls: ClassEntity): string[] {
  for (const g of cls.starting) if (g.type === "choice" && g.id === "skills" && g.from.kind === "proficiency" && Array.isArray(g.from.keys)) return g.from.keys;
  return [];
}

export function buildClasses(list: PhbClass[], base: Map<string, Entity>, artisan: string[]): Entity[] {
  const out: Entity[] = [];
  const asi = list.flatMap((c) => c.features).find((f) => f.en === "Ability Score Improvement");
  for (const c of list) {
    const id = `class:${slug(c.en)}`;
    const prev = base.get(id) as ClassEntity | undefined;
    // classes still waiting for mechanics (later batches) stay out rather than appearing half-built
    if (!prev) continue;
    const short = id.slice("class:".length);
    const cls = clone(prev);
    const extras = [...c.extras.flatMap((e) => e.items), ...c.options.flatMap((o) => o.items)];
    const levels = mergeLevels(cls.levels, c.features, short, extras);
    fillAsi(levels, asi);
    out.push({ ...cls, name: bi(enOf(cls.name), c.zh), summary: bi(enOf(cls.summary), c.summary ?? c.zh), text: bi(enOf(cls.text), c.text), levels } as ClassEntity);

    for (const sc of c.subclasses) {
      const sid = `subclass:${slug(sc.en)}`;
      const existing = base.get(sid) as SubclassEntity | undefined;
      const overlay = SUBCLASS_OVERLAYS[sid];
      const levels = existing ? clone(existing.levels) : overlay ? overlay({ sc, artisan, classSkills: classSkills(prev) }) : {};
      out.push({
        ...existing,
        id: sid,
        type: "subclass",
        classId: id,
        name: bi(enOf(existing?.name) ?? sc.en, sc.zh),
        summary: bi(enOf(existing?.summary), sc.summary ?? sc.zh),
        text: bi(enOf(existing?.text), sc.text),
        tags: [short],
        levels: mergeLevels(levels, sc.features, short, [...extras, ...sc.options.flatMap((o) => o.items)]),
      } as SubclassEntity);
    }
  }
  return out;
}
