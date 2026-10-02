import type { ActionDef, Formula, Grant, LocalizedText, Recovery } from "@forge/core";

export const t = (en: string, zh: string): LocalizedText => ({ en, zh });

export const feature = (id: string, name: LocalizedText, text: LocalizedText, grants?: Grant[], extra: { tags?: string[]; minLevel?: number } = {}): Grant => ({
  type: "feature",
  id,
  name,
  text,
  grants,
  ...extra,
});

export const action = (a: ActionDef): Grant => ({ type: "action", action: a });

export const resource = (id: string, name: LocalizedText, max: Formula, recovery: Recovery[]): Grant => ({ type: "resource", id, name, max, recovery });

export const SHORT_ONE: Recovery[] = [
  { on: "short", amount: 1 },
  { on: "long", amount: "all" },
];
export const SHORT_ALL: Recovery[] = [{ on: "short", amount: "all" }];
export const LONG_ALL: Recovery[] = [{ on: "long", amount: "all" }];

export const prof = (kind: "save" | "skill" | "armor" | "weapon" | "tool" | "language", ...keys: string[]): Grant[] =>
  keys.map((key) => ({ type: "proficiency", kind, key }));

export const mod = (target: string, value: Formula, extra: { when?: string; label?: LocalizedText; op?: "add" | "atLeast" | "override" | "base" } = {}): Grant => ({
  type: "modifier",
  target,
  value,
  ...extra,
});

export const tag = (name: string, label?: LocalizedText): Grant => ({ type: "tag", tag: name, label });

export const item = (id: string, qty = 1, equipped = false): Grant => ({ type: "item", item: `item:${id}`, qty, equipped });

export const gold = (n: number): Grant => item("gp", n);

/** Starting-equipment choice: options A/B/(C) of item lists. */
export const equipmentChoice = (id: string, options: { id: string; name: LocalizedText; items: Grant[] }[]): Grant => ({
  type: "choice",
  id,
  name: t("Starting Equipment", "起始装备"),
  count: 1,
  from: {
    kind: "options",
    options: [
      ...options.map((o) => ({ id: o.id, name: o.name, grants: o.items })),
      {
        id: "custom",
        name: t("Custom", "自定义"),
        text: t("Take nothing here and assemble your own gear under Equipment & Inventory.", "不领取预设装备，在「装备与背包」中自行添加。"),
        grants: [],
      },
    ],
  },
});

export const skillChoice = (count: number, keys: string[] | "any", id = "skills"): Grant => ({
  type: "choice",
  id,
  name: t(`Choose ${count} skill${count > 1 ? "s" : ""}`, `选择 ${count} 项技能`),
  count,
  from: { kind: "proficiency", profKind: "skill", keys },
});

export const masteryChoice = (count: number, keys: string[] | "any", id = "weapon-mastery"): Grant => ({
  type: "choice",
  id,
  name: t("Weapon Mastery", "武器精通"),
  text: t("Choose weapons whose mastery properties you can use.", "选择可以使用其精通词条的武器。"),
  count,
  from: { kind: "proficiency", profKind: "mastery", keys },
});

export const featChoice = (id: string, tags: string[], name = t("Feat", "专长")): Grant => ({
  type: "choice",
  id,
  name,
  count: 1,
  from: { kind: "entity", entityType: "feat", tags },
});

export const spellChoice = (id: string, name: LocalizedText, count: Formula, list: string, minLevel: Formula, maxLevel: Formula, extraTags: string[] = []): Grant => ({
  type: "choice",
  id,
  name,
  count,
  from: { kind: "entity", entityType: "spell", tags: [list, ...extraTags], minLevel, maxLevel },
});

/** Level-indexed table formula for class features. */
export const table = (ref: string, values: number[]) => `table(${ref}, ${values.join(",")})`;
