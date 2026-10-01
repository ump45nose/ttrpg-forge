import type { Ability, Entity, Grant } from "@forge/core";
import { equipmentChoice, gold, item, prof, t } from "./helpers";

const abilityChoice = (abilities: Ability[]): Grant => ({
  type: "choice",
  id: "ability",
  name: t("Ability Scores", "属性值"),
  text: t("Increase one score by 2 and another by 1, or three scores by 1 (max 20).", "一项属性 +2、另一项 +1，或三项各 +1（上限 20）。"),
  count: 1,
  from: { kind: "ability", abilities, patterns: [[2, 1], [1, 1, 1]], cap: 20 },
});

export const backgrounds: Entity[] = [
  {
    id: "background:acolyte",
    type: "background",
    name: t("Acolyte", "侍僧"),
    summary: t("Devoted to service in a temple. Int, Wis, Cha · Magic Initiate (Cleric).", "曾在神殿中虔诚侍奉。智力、感知、魅力 · 魔法学徒（牧师）。"),
    accent: "#eab308",
    grants: [
      abilityChoice(["int", "wis", "cha"]),
      { type: "grant", entity: "feat:magic-initiate-cleric" },
      ...prof("skill", "insight", "religion"),
      ...prof("tool", "item:calligraphers-supplies"),
      equipmentChoice("equipment", [
        { id: "a", name: t("Kit", "装备包"), items: [item("calligraphers-supplies"), item("book"), item("holy-symbol"), item("parchment", 10), item("robe"), gold(8)] },
        { id: "b", name: t("50 GP", "50 金币"), items: [gold(50)] },
      ]),
    ],
  },
  {
    id: "background:criminal",
    type: "background",
    name: t("Criminal", "罪犯"),
    summary: t("Made ends meet in dark alleys. Dex, Con, Int · Alert.", "曾在阴暗小巷中谋生。敏捷、体质、智力 · 警觉。"),
    accent: "#475569",
    grants: [
      abilityChoice(["dex", "con", "int"]),
      { type: "grant", entity: "feat:alert" },
      ...prof("skill", "sleight-of-hand", "stealth"),
      ...prof("tool", "item:thieves-tools"),
      equipmentChoice("equipment", [
        { id: "a", name: t("Kit", "装备包"), items: [item("dagger", 2), item("thieves-tools"), item("crowbar"), item("pouch", 2), item("travelers-clothes"), gold(16)] },
        { id: "b", name: t("50 GP", "50 金币"), items: [gold(50)] },
      ]),
    ],
  },
  {
    id: "background:sage",
    type: "background",
    name: t("Sage", "贤者"),
    summary: t("Years spent studying lore. Con, Int, Wis · Magic Initiate (Wizard).", "多年潜心研究学识。体质、智力、感知 · 魔法学徒（法师）。"),
    accent: "#2563eb",
    grants: [
      abilityChoice(["con", "int", "wis"]),
      { type: "grant", entity: "feat:magic-initiate-wizard" },
      ...prof("skill", "arcana", "history"),
      ...prof("tool", "item:calligraphers-supplies"),
      equipmentChoice("equipment", [
        { id: "a", name: t("Kit", "装备包"), items: [item("quarterstaff"), item("calligraphers-supplies"), item("book"), item("parchment", 8), item("robe"), gold(8)] },
        { id: "b", name: t("50 GP", "50 金币"), items: [gold(50)] },
      ]),
    ],
  },
  {
    id: "background:soldier",
    type: "background",
    name: t("Soldier", "士兵"),
    summary: t("Trained for war from a young age. Str, Dex, Con · Savage Attacker.", "自幼接受战争训练。力量、敏捷、体质 · 凶蛮打手。"),
    accent: "#b91c1c",
    grants: [
      abilityChoice(["str", "dex", "con"]),
      { type: "grant", entity: "feat:savage-attacker" },
      ...prof("skill", "athletics", "intimidation"),
      {
        type: "choice",
        id: "gaming-set",
        name: t("Gaming Set", "游戏套组"),
        count: 1,
        from: { kind: "proficiency", profKind: "tool", keys: ["item:dice-set", "item:playing-cards"] },
      },
      equipmentChoice("equipment", [
        { id: "a", name: t("Kit", "装备包"), items: [item("spear", 1, true), item("shortbow"), item("arrows", 20), item("healers-kit"), item("quiver"), item("travelers-clothes"), gold(14)] },
        { id: "b", name: t("50 GP", "50 金币"), items: [gold(50)] },
      ]),
    ],
  },
];
