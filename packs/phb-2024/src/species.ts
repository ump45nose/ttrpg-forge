import type { Entity, Grant, SpeciesEntity } from "@forge/core";
import { sizeChoice, srdHelpers } from "@forge/pack-srd52";
import type { PhbBenefit, PhbSpecies, PhbTable } from "./data";
import { retext } from "./feats";
import { bi, clone, enOf, slug } from "./util";

const { action, feature, mod, resource, tag, LONG_ALL, t } = srdHelpers;

/** PHB trait slug -> SRD grant id, per species where they differ. */
const ALIAS: Record<string, Record<string, string>> = {
  "species:elf": { "elven-lineage": "lineage" },
  "species:gnome": { "gnomish-lineage": "lineage" },
  "species:tiefling": { "fiendish-legacy": "legacy" },
  "species:dragonborn": { "draconic-ancestry": "ancestry" },
  "species:goliath": { "giant-ancestry": "ancestry" },
  "species:halfling": { lucky: "luck" },
};

const AASIMAR: SpeciesEntity = {
  id: "species:aasimar",
  type: "species",
  name: t("Aasimar", "阿斯莫"),
  summary: t("Celestial resistance, healing hands and, at level 3, a celestial transformation.", "天界抗性与治愈之手，3 级时可进行天界变身。"),
  size: t("Medium or Small", "中型或小型"),
  speed: 30,
  accent: "#eab308",
  grants: [
    sizeChoice(),
    feature("celestial-resistance", t("Celestial Resistance", "天界抗性"), t("Resistance to Necrotic and Radiant damage.", "具有暗蚀与光耀伤害抗性。"), [tag("resist:necrotic"), tag("resist:radiant")]),
    mod("sense.darkvision", 60, { op: "atLeast", label: t("Darkvision", "黑暗视觉") }),
    feature("healing-hands", t("Healing Hands", "治愈之手"), t("Magic action: touch a creature, it regains Proficiency Bonus d4 HP. Once per Long Rest.", "魔法动作：触碰一个生物，其恢复熟练加值枚 d4 的生命值。每次长休一次。"), [
      resource("healing-hands", t("Healing Hands", "治愈之手"), 1, LONG_ALL),
      action({ id: "healing-hands", name: t("Healing Hands", "治愈之手"), activation: "action", category: "feature", cost: [{ resource: "healing-hands" }], heal: { dice: "[[@prof]]d4" } }),
    ]),
    feature("light-bearer", t("Light Bearer", "光辉掌者"), t("You know the Light cantrip (Charisma).", "你习得光亮术戏法（魅力）。"), [{ type: "spell", spell: "spell:light", ability: "cha", alwaysPrepared: true }]),
    feature(
      "celestial-revelation",
      t("Celestial Revelation", "天启"),
      t("Bonus Action: transform for 1 minute (Heavenly Wings, Inner Radiance or Necrotic Shroud). Once per turn deal extra damage equal to your Proficiency Bonus. Once per Long Rest.", "附赠动作：变身 1 分钟（天堂飞翼、内耀辉光或死灵环绕）。每回合一次额外造成等于熟练加值的伤害。每次长休一次。"),
      [
        resource("celestial-revelation", t("Celestial Revelation", "天启"), 1, LONG_ALL),
        action({ id: "celestial-revelation", name: t("Celestial Revelation", "天启"), activation: "bonus", category: "feature", cost: [{ resource: "celestial-revelation" }] }),
      ],
      { minLevel: 3 },
    ),
  ],
};

const OVERLAY: Record<string, SpeciesEntity> = { [AASIMAR.id]: AASIMAR };

/** "中型（约4-7尺高）或小型（约2-4尺高），在选取该种族时选择" -> "中型或小型" */
const shortSize = (s: string) => s.replace(/（[^）]*）/g, "").replace(/，.*$/, "").trim() || "中型";

/** Lineage/ancestry tables: one row per option -> option text. */
function tableTexts(tables: PhbTable[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const tb of tables) {
    const [head, ...rows] = tb.rows;
    for (const r of rows) {
      const en = /[A-Za-z][A-Za-z' -]*$/.exec(r[0] ?? "")?.[0];
      if (!en) continue;
      const cells = r.slice(1).map((c, i) => (head?.[i + 1] ? `${head[i + 1]}：${c}` : c));
      out.set(slug(en), cells.join("；"));
    }
  }
  return out;
}

export function buildSpecies(list: PhbSpecies[], base: Map<string, Entity>): Entity[] {
  return list.map((s): Entity => {
    const id = `species:${slug(s.en)}`;
    const prev = (base.get(id) ?? OVERLAY[id]) as SpeciesEntity | undefined;
    const e: SpeciesEntity = prev ? clone(prev) : { id, type: "species", name: t(s.en, s.zh), size: t("Medium", "中型"), speed: s.speed, grants: [] };
    const grants: Grant[] = e.grants ?? [];
    const used = retext(grants, s.traits, ALIAS[id]);

    // choice options (lineages, ancestries, giant boons) take their text from trait entries or table rows
    const rows = tableTexts(s.tables);
    const optionUsed = new Set<PhbBenefit>();
    for (const g of grants) {
      if (g.type !== "choice" || g.from.kind !== "options") continue;
      for (const o of g.from.options) {
        const oslug = [o.id, slug(enOf(o.name) ?? "")];
        const b = s.traits.find((x) => x.en && oslug.some((k) => slug(x.en!).startsWith(k)));
        if (b) {
          optionUsed.add(b);
          o.name = bi(enOf(o.name), b.zh);
          o.text = bi(enOf(o.text), b.text);
        } else {
          const row = oslug.map((k) => rows.get(k)).find(Boolean);
          if (row) o.text = bi(enOf(o.text), row);
        }
      }
    }
    // traits with no mechanical counterpart (e.g. Darkvision) still deserve their text
    for (const b of s.traits) {
      if (used.has(b) || optionUsed.has(b)) continue;
      grants.push({ type: "feature", id: slug(b.en ?? b.zh), name: bi(b.en ?? undefined, b.zh), text: bi(undefined, b.text) });
    }
    return {
      ...e,
      name: bi(enOf(e.name) ?? s.en, s.zh),
      text: bi(enOf(e.text), [s.text, s.creatureType ? `生物类型：${s.creatureType}` : "", `体型：${s.size}`, `速度：${s.speed}尺`].filter(Boolean).join("\n")),
      size: bi(enOf(e.size), shortSize(s.size)),
      speed: s.speed,
      grants,
    };
  });
}
