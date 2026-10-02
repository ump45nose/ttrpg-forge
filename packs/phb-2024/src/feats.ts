import type { Ability, Entity, FeatEntity, Grant, Prereq } from "@forge/core";
import { srdHelpers } from "@forge/pack-srd52";
import type { PhbBenefit, PhbFeat } from "./data";
import { ABILITY_ZH, bi, clone, enOf, slug, walkGrants } from "./util";

const { mod, prof, resource, tag, LONG_ALL, t } = srdHelpers;
const ALL: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_RE = Object.keys(ABILITY_ZH).join("|");

export function parsePrereq(s: string | null): Prereq | undefined {
  if (!s) return undefined;
  const p: Prereq = { text: bi(undefined, `先决：${s}`) };
  const lv = /等级\s*(\d+)\+/.exec(s);
  if (lv) p.level = Number(lv[1]);
  const ab = new RegExp(`((?:${ABILITY_RE})(?:或(?:${ABILITY_RE}))*)\\s*(\\d+)\\+`).exec(s);
  if (ab) {
    const list = ab[1]!.split("或").map((z) => ABILITY_ZH[z]!);
    p.formula = list.map((a) => `@ability.${a}.score >= ${ab[2]}`).join(" || ");
  }
  return p;
}

/** "你的力量或敏捷提升1，至多提升至20" -> an ability choice. */
export function asiGrant(sentence: string | null): Grant | undefined {
  if (!sentence) return undefined;
  const amount = Number(/提升\s*(\d)/.exec(sentence)?.[1] ?? 1);
  const cap = Number(/至多提升至\s*(\d+)/.exec(sentence)?.[1] ?? 20);
  const named = [...sentence.matchAll(new RegExp(ABILITY_RE, "g"))].map((m) => ABILITY_ZH[m[0]]!);
  const abilities = named.length && !/一项属性|任意属性/.test(sentence) ? [...new Set(named)] : ALL;
  return { type: "choice", id: "ability", name: t("Ability Score Increase", "属性值提升"), text: bi(undefined, sentence), count: 1, from: { kind: "ability", abilities, patterns: [[amount]], cap } };
}

const featureOf = (b: PhbBenefit): Grant => ({ type: "feature", id: slug(b.en ?? b.zh), name: bi(b.en ?? undefined, b.zh), text: bi(undefined, b.text) });
const isAsi = (b: PhbBenefit) => /Ability Score Increase/.test(b.en ?? "") || b.zh === "属性值提升";
const isRepeatable = (b: PhbBenefit) => b.zh === "复选";

/** One-line card summary: "<first benefit>：<its first sentence>", trimmed. */
function summaryOf(f: PhbFeat): string | undefined {
  const b = f.benefits.find((x) => !isAsi(x) && !isRepeatable(x));
  const first = (b?.text ?? f.text).split(/(?<=。)/)[0]!.trim();
  if (!first) return undefined;
  const line = b ? `${b.zh}：${first}` : first;
  return line.length > 70 ? `${line.slice(0, 68)}…` : line;
}

/** Mechanics the prose alone can't give us, keyed by feat id. Text always comes from the PHB. */
const MECHANICS: Record<string, Grant[]> = {
  "feat:tough": [mod("hp.max", "2 * @level", { label: t("Tough", "健壮") })],
  "feat:lucky": [resource("luck-points", t("Luck Points", "幸运点"), "@prof", LONG_ALL)],
  "feat:musician": [{ type: "choice", id: "instruments", name: t("Three instruments", "三种乐器"), count: 3, from: { kind: "proficiency", profKind: "tool", keys: [] } }],
  "feat:crafter": [{ type: "choice", id: "tools", name: t("Three artisan's tools", "三种工匠工具"), count: 3, from: { kind: "proficiency", profKind: "tool", keys: [] } }],
  "feat:speedy": [mod("speed.walk", 10, { label: t("Speedy", "飙速跑者") })],
  "feat:lightly-armored": [...prof("armor", "light", "shield")],
  "feat:moderately-armored": [...prof("armor", "medium", "shield")],
  "feat:heavily-armored": [...prof("armor", "heavy")],
  "feat:martial-weapon-training": [...prof("weapon", "martial")],
  "feat:resilient": [{ type: "choice", id: "save", name: t("Saving Throw Proficiency", "豁免熟练"), count: 1, from: { kind: "proficiency", profKind: "save", keys: ALL } }],
  "feat:skill-expert": [{ type: "choice", id: "skill", name: t("Skill Proficiency", "技能熟练"), count: 1, from: { kind: "proficiency", profKind: "skill", keys: "any" } }],
  "feat:blind-fighting": [mod("sense.blindsight", 10, { op: "atLeast", label: t("Blind Fighting", "盲斗") })],
  "feat:thrown-weapon-fighting": [tag("thrown-weapon-fighting")],
  "feat:boon-of-fortitude": [mod("hp.max", 40, { label: t("Boon of Fortitude", "超凡强韧之恩惠") })],
  "feat:boon-of-speed": [mod("speed.walk", 30, { label: t("Boon of Speed", "神行无拘之恩惠") })],
};

export interface FeatIndex {
  entities: Entity[];
  /** Chinese feat name (+ optional list note) -> id, for background parsing. */
  resolve(zh: string, note?: string | null): string | undefined;
}

export function buildFeats(feats: PhbFeat[], base: Map<string, Entity>, toolGroups: { instrument: string[]; artisan: string[] }): FeatIndex {
  const out: Entity[] = [];
  const byZh = new Map<string, string>();
  MECHANICS["feat:musician"]![0] = { ...MECHANICS["feat:musician"]![0], from: { kind: "proficiency", profKind: "tool", keys: toolGroups.instrument } } as Grant;
  MECHANICS["feat:crafter"]![0] = { ...MECHANICS["feat:crafter"]![0], from: { kind: "proficiency", profKind: "tool", keys: toolGroups.artisan } } as Grant;

  for (const f of feats) {
    if (f.en === "Magic Initiate") {
      out.push(...magicInitiate(f, base));
      continue;
    }
    const id = `feat:${slug(f.en)}`;
    byZh.set(f.zh, id);
    const prev = base.get(id) as FeatEntity | undefined;
    const benefits = f.benefits.filter((b) => !isRepeatable(b));
    let grants: Grant[];
    if (prev) {
      grants = clone(prev.grants ?? []);
      retext(grants, benefits);
    } else {
      grants = [
        ...(f.asi ? [asiGrant(f.asi)!] : []),
        ...(MECHANICS[id] ?? []),
        ...benefits.filter((b) => !isAsi(b)).map(featureOf),
      ];
    }
    out.push({
      ...prev,
      id,
      type: "feat",
      category: f.category,
      name: bi(enOf(prev?.name) ?? f.en, f.zh),
      summary: prev?.summary ?? bi(undefined, summaryOf(f) ?? f.zh),
      text: bi(enOf(prev?.text), f.text),
      tags: [...new Set([...(prev?.tags ?? []), f.category])],
      prereq: prev?.prereq ?? parsePrereq(f.prereq),
      repeatable: f.repeatable || prev?.repeatable || undefined,
      grants,
    } as FeatEntity);
  }

  return {
    entities: out,
    resolve(zh, note) {
      if (zh === "魔法学徒") {
        const list = note && /牧师|德鲁伊|法师/.exec(note)?.[0];
        return list ? `feat:magic-initiate-${{ 牧师: "cleric", 德鲁伊: "druid", 法师: "wizard" }[list]}` : undefined;
      }
      return byZh.get(zh);
    },
  };
}

/** Give grants that match a PHB benefit (by id or English name) the PHB name and full text. */
export function retext(grants: Grant[], benefits: PhbBenefit[], aliases: Record<string, string> = {}) {
  const key = (b: PhbBenefit) => aliases[slug(b.en ?? "")] ?? slug(b.en ?? "");
  const used = new Set<PhbBenefit>();
  walkGrants(grants, (g) => {
    if (g.type !== "feature" && g.type !== "choice") return;
    const b = benefits.find((x) => key(x) === g.id);
    if (!b) return;
    used.add(b);
    g.name = bi(enOf(g.name) ?? b.en ?? undefined, b.zh);
    g.text = bi(enOf(g.text), b.text);
  });
  return used;
}

const MI_LISTS: [list: string, en: string, zh: string][] = [
  ["cleric", "Cleric", "牧师"],
  ["druid", "Druid", "德鲁伊"],
  ["wizard", "Wizard", "法师"],
];

/** The PHB's one Magic Initiate feat becomes one feat per spell list, cloned from the SRD's cleric version. */
function magicInitiate(f: PhbFeat, base: Map<string, Entity>): Entity[] {
  const template = base.get("feat:magic-initiate-cleric");
  if (!template) return [];
  return MI_LISTS.map(([list, en, zh]) => {
    const e = clone(template) as FeatEntity;
    walkGrants(e.grants, (g) => {
      if (g.type === "choice" && g.from.kind === "entity" && g.from.tags) g.from.tags = g.from.tags.map((x) => (x === "cleric" ? list : x));
    });
    const prev = base.get(`feat:magic-initiate-${list}`);
    return {
      ...e,
      id: `feat:magic-initiate-${list}`,
      name: bi(`Magic Initiate (${en})`, `${f.zh}（${zh}）`),
      summary: prev?.summary ?? e.summary,
      text: bi(enOf(prev?.text), f.text),
      repeatable: undefined,
    };
  });
}
