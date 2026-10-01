import type { Ability, Entity, Grant } from "@forge/core";
import { feature, LONG_ALL, mod, t } from "./helpers";

const L1_FREE = { max: 1, recovery: LONG_ALL };

/** Magic Initiate: pick a casting ability first, then 2 cantrips + one 1st-level spell from that list. */
function magicInitiate(list: "cleric" | "wizard", en: string, zh: string): Entity {
  const abilityOption = (a: Ability, aen: string, azh: string) => ({
    id: a,
    name: t(aen, azh),
    grants: [
      {
        type: "choice",
        id: "cantrips",
        name: t("Two cantrips", "两道戏法"),
        count: 2,
        from: { kind: "entity", entityType: "spell", tags: [list], maxLevel: 0, spell: { ability: a } },
      },
      {
        type: "choice",
        id: "spell",
        name: t("One level 1 spell", "一道 1 环法术"),
        count: 1,
        from: { kind: "entity", entityType: "spell", tags: [list], minLevel: 1, maxLevel: 1, spell: { ability: a, alwaysPrepared: true, free: L1_FREE } },
      },
    ] as Grant[],
  });
  return {
    id: `feat:magic-initiate-${list}`,
    type: "feat",
    category: "origin",
    name: t(`Magic Initiate (${en})`, `魔法学徒（${zh}）`),
    summary: t(`Two ${en} cantrips and a level 1 spell you can cast once per Long Rest for free.`, `获得两道${zh}戏法与一道 1 环法术，后者每次长休可免费施放一次。`),
    tags: ["origin", "magic-initiate"],
    grants: [
      {
        type: "choice",
        id: "ability",
        name: t("Spellcasting Ability", "施法属性"),
        count: 1,
        from: { kind: "options", options: [abilityOption("int", "Intelligence", "智力"), abilityOption("wis", "Wisdom", "感知"), abilityOption("cha", "Charisma", "魅力")] },
      },
    ],
  };
}

const asi = (abilities: Ability[], patterns: number[][]): Grant => ({
  type: "choice",
  id: "ability",
  name: t("Ability Score Increase", "属性值提升"),
  count: 1,
  from: { kind: "ability", abilities, patterns, cap: 20 },
});

export const feats: Entity[] = [
  {
    id: "feat:alert",
    type: "feat",
    category: "origin",
    name: t("Alert", "警觉"),
    summary: t("Add your Proficiency Bonus to Initiative; swap Initiative with a willing ally.", "先攻加上熟练加值；可与自愿盟友交换先攻。"),
    tags: ["origin"],
    grants: [
      mod("initiative", "@prof", { label: t("Alert", "警觉") }),
      feature("initiative-swap", t("Initiative Swap", "先攻交换"), t("After rolling Initiative, you can swap your Initiative with a willing ally.", "投掷先攻后，可与一名自愿盟友交换先攻值。")),
    ],
  },
  magicInitiate("cleric", "Cleric", "牧师"),
  magicInitiate("wizard", "Wizard", "法师"),
  {
    id: "feat:savage-attacker",
    type: "feat",
    category: "origin",
    name: t("Savage Attacker", "凶蛮打手"),
    summary: t("Once per turn, roll weapon damage dice twice and use either roll.", "每回合一次，武器伤害骰可掷两次并任选其一。"),
    tags: ["origin"],
    grants: [feature("savage-attacker", t("Savage Attacker", "凶蛮打手"), t("Once per turn when you hit with a weapon, roll its damage dice twice and use either roll.", "每回合一次，以武器命中时将伤害骰掷两次并任选其一。"), [], { tags: ["once-per-turn"] })],
  },
  {
    id: "feat:skilled",
    type: "feat",
    category: "origin",
    name: t("Skilled", "多才多艺"),
    summary: t("Gain proficiency in any three skills.", "获得任意三项技能的熟练。"),
    tags: ["origin"],
    repeatable: true,
    grants: [{ type: "choice", id: "skills", name: t("Three skills", "三项技能"), count: 3, from: { kind: "proficiency", profKind: "skill", keys: "any" } }],
  },
  {
    id: "feat:ability-score-improvement",
    type: "feat",
    category: "general",
    name: t("Ability Score Improvement", "属性值提升"),
    summary: t("+2 to one ability score, or +1 to two (max 20).", "一项属性值 +2，或两项各 +1（上限 20）。"),
    tags: ["general"],
    prereq: { level: 4 },
    repeatable: true,
    grants: [asi(["str", "dex", "con", "int", "wis", "cha"], [[2], [1, 1]])],
  },
  {
    id: "feat:grappler",
    type: "feat",
    category: "general",
    name: t("Grappler", "擒抱者"),
    summary: t("+1 Str or Dex; Punch and Grab; Advantage against creatures you grapple.", "力量或敏捷 +1；可打击并擒抱；对你擒抱的生物攻击具有优势。"),
    tags: ["general"],
    prereq: { level: 4, formula: "@ability.str.score >= 13 || @ability.dex.score >= 13", text: t("Level 4+, Str or Dex 13+", "4 级以上，力量或敏捷 13+") },
    grants: [
      asi(["str", "dex"], [[1]]),
      feature("punch-and-grab", t("Punch and Grab", "打击并擒抱"), t("When you hit with an Unarmed Strike as part of the Attack action, you can use both the Damage and Grapple options (once per turn).", "作为攻击动作的一部分以徒手打击命中时，可同时使用伤害与擒抱选项（每回合一次）。")),
      feature("attack-advantage", t("Attack Advantage", "攻击优势"), t("You have Advantage on attack rolls against a creature Grappled by you.", "你对被你擒抱的生物的攻击检定具有优势。")),
      feature("fast-wrestler", t("Fast Wrestler", "迅捷摔跤手"), t("Moving a creature you grapple costs no extra movement if it is your size or smaller.", "移动体型不大于你的受擒生物不需额外移动力。")),
    ],
  },
  {
    id: "feat:archery",
    type: "feat",
    category: "fighting-style",
    name: t("Archery", "箭术"),
    summary: t("+2 bonus to attack rolls with Ranged weapons.", "使用远程武器的攻击检定 +2。"),
    tags: ["fighting-style"],
    grants: [mod("attack.ranged", 2, { label: t("Archery", "箭术") })],
  },
  {
    id: "feat:defense",
    type: "feat",
    category: "fighting-style",
    name: t("Defense", "防御"),
    summary: t("+1 AC while wearing Light, Medium or Heavy armor.", "穿着轻甲、中甲或重甲时 AC +1。"),
    tags: ["fighting-style"],
    grants: [mod("ac", 1, { when: "@equipped.armor", label: t("Defense", "防御") })],
  },
  {
    id: "feat:great-weapon-fighting",
    type: "feat",
    category: "fighting-style",
    name: t("Great Weapon Fighting", "巨武器战斗"),
    summary: t("Treat 1s and 2s on damage dice as 3 with two-handed or versatile melee weapons.", "使用双手或两用近战武器时，伤害骰的 1 和 2 视为 3。"),
    tags: ["fighting-style"],
    grants: [feature("great-weapon-fighting", t("Great Weapon Fighting", "巨武器战斗"), t("Treat any 1 or 2 on a damage die as a 3 when wielding a Two-Handed or Versatile melee weapon with both hands.", "双手持用双手或两用近战武器时，伤害骰掷出的 1 或 2 视为 3。"))],
  },
  {
    id: "feat:two-weapon-fighting",
    type: "feat",
    category: "fighting-style",
    name: t("Two-Weapon Fighting", "双武器战斗"),
    summary: t("Add your ability modifier to the damage of the extra Light weapon attack.", "轻型武器额外攻击的伤害可加上属性调整值。"),
    tags: ["fighting-style"],
    grants: [feature("two-weapon-fighting", t("Two-Weapon Fighting", "双武器战斗"), t("When you make the extra attack of the Light property, add your ability modifier to its damage.", "进行轻型武器的额外攻击时，伤害加上属性调整值。"))],
  },
];
