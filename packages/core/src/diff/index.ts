import { applyOps, type BuildOp } from "../build/mutations";
import { validate } from "../build/choices";
import type { Issue } from "../build/collect";
import { derive, type Sheet } from "../derive/sheet";
import type { PackRegistry } from "../pack/registry";
import { ABILITIES, type Build } from "../schema/types";
import type { LocalizedText } from "../text";

/**
 * "What happens if I pick this?" — the core of the BG3-style builder.
 * Compares two derived sheets and explains what was gained, lost and changed.
 */

export interface StatChange {
  stat: string;
  label: LocalizedText;
  before: number;
  after: number;
  delta: number;
}

export interface SetChange<T> {
  added: T[];
  removed: T[];
}

export interface NamedRef {
  id: string;
  name: LocalizedText;
  detail?: string;
}

export interface SheetDiff {
  stats: StatChange[];
  proficiencies: SetChange<NamedRef>;
  /** Feats, subclasses, species... gained through the build. */
  entities: SetChange<NamedRef>;
  features: SetChange<NamedRef>;
  actions: SetChange<NamedRef>;
  resources: SetChange<NamedRef> & { changed: StatChange[] };
  spells: SetChange<NamedRef>;
  slots: StatChange[];
  choices: SetChange<NamedRef>;
  issues: SetChange<Issue>;
  empty: boolean;
}

const L = (en: string, zh: string): LocalizedText => ({ en, zh });

const ABILITY_LABEL: Record<string, LocalizedText> = {
  str: L("Strength", "力量"),
  dex: L("Dexterity", "敏捷"),
  con: L("Constitution", "体质"),
  int: L("Intelligence", "智力"),
  wis: L("Wisdom", "感知"),
  cha: L("Charisma", "魅力"),
};

function numericStats(s: Sheet): Map<string, { label: LocalizedText; value: number }> {
  const m = new Map<string, { label: LocalizedText; value: number }>();
  m.set("hp.max", { label: L("Max HP", "生命值上限"), value: s.hpMax });
  m.set("ac", { label: L("Armor Class", "护甲等级"), value: s.ac });
  m.set("initiative", { label: L("Initiative", "先攻"), value: s.initiative });
  m.set("speed.walk", { label: L("Speed", "速度"), value: s.speed.walk });
  m.set("prof", { label: L("Proficiency Bonus", "熟练加值"), value: s.prof });
  m.set("sense.darkvision", { label: L("Darkvision", "黑暗视觉"), value: s.senses.darkvision ?? 0 });
  for (const a of ABILITIES) {
    m.set(`ability.${a}.score`, { label: ABILITY_LABEL[a]!, value: s.abilities[a].score });
    m.set(`save.${a}`, { label: { en: `${(ABILITY_LABEL[a] as { en: string }).en} save`, zh: `${(ABILITY_LABEL[a] as { zh: string }).zh}豁免` }, value: s.abilities[a].save });
  }
  for (const [k, v] of Object.entries(s.skills)) m.set(`skill.${k}`, { label: { en: k, zh: k }, value: v.value });
  m.set("passive.perception", { label: L("Passive Perception", "被动察觉"), value: s.skills.perception?.passive ?? 10 });
  for (const sc of s.spellcasting) {
    m.set(`spell.${sc.classId}.dc`, { label: L("Spell save DC", "法术豁免 DC"), value: sc.dc });
    m.set(`spell.${sc.classId}.attack`, { label: L("Spell attack", "法术攻击"), value: sc.attack });
  }
  return m;
}

function setDiff<T>(a: T[], b: T[], key: (t: T) => string): SetChange<T> {
  const ka = new Map(a.map((x) => [key(x), x]));
  const kb = new Map(b.map((x) => [key(x), x]));
  return {
    added: [...kb].filter(([k]) => !ka.has(k)).map(([, v]) => v),
    removed: [...ka].filter(([k]) => !kb.has(k)).map(([, v]) => v),
  };
}

export function diffSheets(a: Sheet, b: Sheet, issuesA: Issue[] = a.issues, issuesB: Issue[] = b.issues): SheetDiff {
  const sa = numericStats(a);
  const sb = numericStats(b);
  const stats: StatChange[] = [];
  for (const [k, vb] of sb) {
    const before = sa.get(k)?.value ?? 0;
    if (before !== vb.value) stats.push({ stat: k, label: vb.label, before, after: vb.value, delta: vb.value - before });
  }
  for (const [k, va] of sa) {
    if (!sb.has(k) && va.value !== 0) stats.push({ stat: k, label: va.label, before: va.value, after: 0, delta: -va.value });
  }

  const prof = (s: Sheet): NamedRef[] => s.proficiencies.map((p) => ({ id: `${p.kind}:${p.key}:${p.level}`, name: { en: p.key, zh: p.key }, detail: p.kind }));
  const feat = (s: Sheet): NamedRef[] => s.features.map((f) => ({ id: f.id, name: f.name }));
  const act = (s: Sheet): NamedRef[] => s.actions.map((x) => ({ id: x.id, name: x.name, detail: x.activation }));
  const res = (s: Sheet): NamedRef[] => s.resources.map((r) => ({ id: r.id, name: r.name, detail: String(r.max) }));
  const spl = (s: Sheet): NamedRef[] => s.spells.map((x) => ({ id: `${x.spellId}@${x.classId ?? ""}`, name: x.name, detail: String(x.level) }));
  const ent = (s: Sheet): NamedRef[] =>
    s.collected.entities.filter((e) => e.entity.type !== "spell" && e.entity.type !== "item").map((e) => ({ id: e.path, name: e.entity.name, detail: e.entity.type }));
  const pend = (s: Sheet): NamedRef[] => s.choices.filter((c) => c.remaining > 0).map((c) => ({ id: c.path, name: c.choice.name, detail: String(c.remaining) }));

  const resChanged: StatChange[] = [];
  for (const r of b.resources) {
    const old = a.resources.find((x) => x.id === r.id);
    if (old && old.max !== r.max) resChanged.push({ stat: r.id, label: r.name, before: old.max, after: r.max, delta: r.max - old.max });
  }
  const slots: StatChange[] = [];
  const n = Math.max(a.slots.length, b.slots.length);
  for (let i = 0; i < n; i++) {
    const before = a.slots[i] ?? 0;
    const after = b.slots[i] ?? 0;
    if (before !== after) slots.push({ stat: `slot.${i + 1}`, label: L(`Level ${i + 1} slots`, `${i + 1} 环法术位`), before, after, delta: after - before });
  }

  const d: SheetDiff = {
    stats,
    proficiencies: setDiff(prof(a), prof(b), (x) => x.id),
    entities: setDiff(ent(a), ent(b), (x) => x.id),
    features: setDiff(feat(a), feat(b), (x) => x.id),
    actions: setDiff(act(a), act(b), (x) => x.id),
    resources: { ...setDiff(res(a), res(b), (x) => x.id), changed: resChanged },
    spells: setDiff(spl(a), spl(b), (x) => x.id),
    slots,
    choices: setDiff(pend(a), pend(b), (x) => x.id),
    issues: setDiff(issuesA, issuesB, (i) => `${i.code}|${i.path}|${JSON.stringify(i.message)}`),
    empty: false,
  };
  d.empty =
    !d.stats.length &&
    !d.slots.length &&
    !d.resources.changed.length &&
    [d.proficiencies, d.entities, d.features, d.actions, d.resources, d.spells, d.choices, d.issues].every((s) => !s.added.length && !s.removed.length);
  return d;
}

export interface Preview {
  build: Build;
  sheet: Sheet;
  issues: Issue[];
  diff: SheetDiff;
}

/** Derive a hypothetical build and diff it against the current one. */
export function preview(reg: PackRegistry, build: Build, current: Sheet, ops: BuildOp[], currentIssues?: Issue[]): Preview {
  const next = applyOps(build, ops);
  const sheet = derive(reg, next);
  const issues = validate(reg, next, sheet);
  return { build: next, sheet, issues, diff: diffSheets(current, sheet, currentIssues ?? validate(reg, build, current), issues) };
}
