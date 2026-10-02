import type { ChoiceOption, Entity, Grant, Recovery } from "@forge/core";
import { action, feature, LONG_ALL, mod, resource, t, tag } from "./helpers";
export { DRAGONS, dragonOption, GIANTS, giantOption, lineageChoice };

const PB_LONG: Recovery[] = LONG_ALL;
const darkvision = (ft: number): Grant => mod("sense.darkvision", ft, { op: "atLeast", label: t("Darkvision", "黑暗视觉") });
/** Lineage spells use the Int/Wis/Cha picked in the species' "spell-ability" choice. */
export const freeSpell = (spell: string, minLevel?: number, abilityFrom = "species"): Grant => ({
  type: "spell",
  spell: `spell:${spell}`,
  alwaysPrepared: true,
  minLevel,
  abilityFrom,
  ...(minLevel ? { free: { max: 1, recovery: LONG_ALL } } : {}),
});

export const spellAbilityChoice = (scope = "species"): Grant => ({
  type: "choice",
  id: "spell-ability",
  name: t("Spellcasting Ability", "施法属性"),
  text: t("Intelligence, Wisdom or Charisma for spells from this species.", "此种族赋予的法术使用智力、感知或魅力之一作为施法属性。"),
  count: 1,
  from: {
    kind: "options",
    options: (
      [
        ["int", "Intelligence", "智力"],
        ["wis", "Wisdom", "感知"],
        ["cha", "Charisma", "魅力"],
      ] as const
    ).map(([id, en, zh]) => ({ id, name: t(en, zh), grants: [tag(`spell-ability:${scope}:${id}`)] })),
  },
});

export const sizeChoice = (): Grant => ({
  type: "choice",
  id: "size",
  name: t("Size", "体型"),
  count: 1,
  from: {
    kind: "options",
    options: [
      { id: "medium", name: t("Medium", "中型"), grants: [tag("size:medium")] },
      { id: "small", name: t("Small", "小型"), grants: [tag("size:small")] },
    ],
  },
});

const DRAGONS: [string, string, string, string, string][] = [
  ["black", "Black", "黑龙", "acid", "强酸"],
  ["blue", "Blue", "蓝龙", "lightning", "闪电"],
  ["brass", "Brass", "黄铜龙", "fire", "火焰"],
  ["bronze", "Bronze", "青铜龙", "lightning", "闪电"],
  ["copper", "Copper", "赤铜龙", "acid", "强酸"],
  ["gold", "Gold", "金龙", "fire", "火焰"],
  ["green", "Green", "绿龙", "poison", "毒素"],
  ["red", "Red", "红龙", "fire", "火焰"],
  ["silver", "Silver", "银龙", "cold", "寒冷"],
  ["white", "White", "白龙", "cold", "寒冷"],
];

const dragonOption = ([id, en, zh, dmg, dmgZh]: (typeof DRAGONS)[number]): ChoiceOption => ({
  id,
  name: t(`${en} (${dmg})`, `${zh}（${dmgZh}）`),
  grants: [
    tag(`resist:${dmg}`, t(`Resistance: ${dmg}`, `抗性：${dmgZh}`)),
    action({
      id: "breath-weapon",
      name: t("Breath Weapon", "吐息武器"),
      activation: "special",
      category: "feature",
      text: t(
        "Replace one attack of the Attack action: 15-ft Cone or 30-ft Line. Dex save, half damage on success.",
        "替换攻击动作中的一次攻击：15 尺锥形或 30 尺直线。敏捷豁免，成功减半。",
      ),
      cost: [{ resource: "breath-weapon" }],
      save: { ability: "dex", dc: "8 + @ability.con.mod + @prof", onSave: "half" },
      damage: [{ dice: "[[@level >= 17 ? 4 : @level >= 11 ? 3 : @level >= 5 ? 2 : 1]]d10", type: dmg }],
    }),
  ],
});

type Giant = [id: string, en: string, zh: string, textEn: string, textZh: string, extra?: Partial<Parameters<typeof action>[0] & object>];
const GIANTS: Giant[] = [
  ["cloud", "Cloud's Jaunt", "云巨人·瞬移", "Bonus Action: teleport up to 30 ft to an unoccupied space you can see.", "附赠动作：传送至多 30 尺到可见的空位。", { activation: "bonus" }],
  ["fire", "Fire's Burn", "火巨人·灼烧", "When you hit with an attack roll, deal an extra 1d10 Fire damage.", "攻击命中时额外造成 1d10 火焰伤害。", { damage: [{ dice: "1d10", type: "fire" }] }],
  ["frost", "Frost's Chill", "霜巨人·寒栗", "When you hit, deal an extra 1d6 Cold damage and reduce the target's Speed by 10 ft.", "命中时额外造成 1d6 寒冷伤害，目标速度降低 10 尺。", { damage: [{ dice: "1d6", type: "cold" }] }],
  ["hill", "Hill's Tumble", "丘巨人·掀翻", "When you hit a Large or smaller creature, it has the Prone condition.", "命中大型或更小的生物时，使其倒地。"],
  ["stone", "Stone's Endurance", "石巨人·坚忍", "Reaction when you take damage: reduce it by 1d12 + Con modifier.", "受到伤害时以反应将其降低 1d12 + 体质调整值。", { activation: "reaction" }],
  ["storm", "Storm's Thunder", "风暴巨人·雷鸣", "Reaction when damaged by a creature within 60 ft: deal 1d8 Thunder damage to it.", "被 60 尺内的生物伤害时，以反应对其造成 1d8 雷鸣伤害。", { activation: "reaction", damage: [{ dice: "1d8", type: "thunder" }] }],
];

const giantOption = ([id, en, zh, ten, tzh, extra]: Giant): ChoiceOption => ({
  id,
  name: t(en, zh),
  text: t(ten, tzh),
  grants: [
    action({ id: `giant-${id}`, name: t(en, zh), activation: "special", category: "feature", text: t(ten, tzh), cost: [{ resource: "giant-ancestry" }], ...extra }),
  ],
});

type Lineage = [id: string, en: string, zh: string, textEn: string, textZh: string, grants: Grant[]];

const ELF: Lineage[] = [
  ["drow", "Drow", "卓尔", "Darkvision 120 ft; Dancing Lights, then Faerie Fire (3) and Darkness (5).", "黑暗视觉 120 尺；舞光术，3 级妖火，5 级黑暗术。", [darkvision(120), freeSpell("dancing-lights"), freeSpell("faerie-fire", 3), freeSpell("darkness", 5)]],
  ["high-elf", "High Elf", "高等精灵", "Prestidigitation, then Detect Magic (3) and Misty Step (5).", "魔法伎俩，3 级侦测魔法，5 级迷踪步。", [freeSpell("prestidigitation"), freeSpell("detect-magic", 3), freeSpell("misty-step", 5)]],
  ["wood-elf", "Wood Elf", "木精灵", "Speed 35 ft; Druidcraft, then Longstrider (3) and Pass without Trace (5).", "速度 35 尺；德鲁伊伎俩，3 级大步奔行，5 级行动无踪。", [mod("speed.walk", 5, { label: t("Wood Elf", "木精灵") }), freeSpell("druidcraft"), freeSpell("longstrider", 3), freeSpell("pass-without-trace", 5)]],
];

const TIEFLING: Lineage[] = [
  ["abyssal", "Abyssal", "深渊", "Poison Resistance; Poison Spray, Ray of Sickness (3), Hold Person (5).", "毒素抗性；毒气喷溅，3 级致病射线，5 级人类定身术。", [tag("resist:poison"), freeSpell("poison-spray"), freeSpell("ray-of-sickness", 3), freeSpell("hold-person", 5)]],
  ["chthonic", "Chthonic", "冥府", "Necrotic Resistance; Chill Touch, False Life (3), Ray of Enfeeblement (5).", "黯蚀抗性；颤栗之触，3 级虚假生命，5 级衰弱射线。", [tag("resist:necrotic"), freeSpell("chill-touch"), freeSpell("false-life", 3), freeSpell("ray-of-enfeeblement", 5)]],
  ["infernal", "Infernal", "炼狱", "Fire Resistance; Fire Bolt, Hellish Rebuke (3), Darkness (5).", "火焰抗性；火焰箭，3 级炼狱叱喝，5 级黑暗术。", [tag("resist:fire"), freeSpell("fire-bolt"), freeSpell("hellish-rebuke", 3), freeSpell("darkness", 5)]],
];

const GNOME: Lineage[] = [
  ["forest", "Forest Gnome", "森林侏儒", "Minor Illusion; Speak with Animals (Proficiency Bonus times per Long Rest).", "次级幻象；动物交谈（每次长休可用次数等于熟练加值）。", [freeSpell("minor-illusion"), { type: "spell", spell: "spell:speak-with-animals", alwaysPrepared: true, abilityFrom: "species", free: { max: "@prof", recovery: LONG_ALL } }]],
  ["rock", "Rock Gnome", "岩石侏儒", "Mending and Prestidigitation; build Tiny clockwork devices.", "修复术与魔法伎俩；可制造超小型发条装置。", [freeSpell("mending"), freeSpell("prestidigitation")]],
];

const lineageChoice = (id: string, name: [string, string], list: Lineage[]): Grant => ({
  type: "choice",
  id,
  name: t(name[0], name[1]),
  count: 1,
  from: { kind: "options", options: list.map(([oid, en, zh, ten, tzh, grants]) => ({ id: oid, name: t(en, zh), text: t(ten, tzh), grants })) },
});

export const species: Entity[] = [
  {
    id: "species:dragonborn",
    type: "species",
    name: t("Dragonborn", "龙裔"),
    summary: t("Breath weapon, damage resistance and, at level 5, draconic wings.", "吐息武器、伤害抗性，5 级时展开龙翼。"),
    size: t("Medium", "中型"),
    speed: 30,
    accent: "#c2410c",
    grants: [
      darkvision(60),
      {
        type: "choice",
        id: "ancestry",
        name: t("Draconic Ancestry", "龙族血统"),
        count: 1,
        from: { kind: "options", options: DRAGONS.map(dragonOption) },
      },
      resource("breath-weapon", t("Breath Weapon", "吐息武器"), "@prof", PB_LONG),
      feature("draconic-flight", t("Draconic Flight", "龙翼飞行"), t("Bonus Action: sprout wings for 10 minutes, gaining a Fly Speed equal to your Speed. Once per Long Rest.", "附赠动作：展开龙翼 10 分钟，获得等同于速度的飞行速度。每次长休一次。"), [
        resource("draconic-flight", t("Draconic Flight", "龙翼飞行"), 1, LONG_ALL),
        action({ id: "draconic-flight", name: t("Draconic Flight", "龙翼飞行"), activation: "bonus", category: "feature", cost: [{ resource: "draconic-flight" }], applies: [{ effect: "effect:draconic-flight", target: "self", duration: { minutes: 10 } }] }),
      ], { minLevel: 5 }),
    ],
  },
  {
    id: "species:dwarf",
    type: "species",
    name: t("Dwarf", "矮人"),
    summary: t("Tough and poison-resistant, with superb darkvision and stonecunning.", "坚韧且抗毒，拥有卓越的黑暗视觉与石工知识。"),
    size: t("Medium", "中型"),
    speed: 30,
    accent: "#a16207",
    grants: [
      darkvision(120),
      feature("dwarven-resilience", t("Dwarven Resilience", "矮人韧性"), t("Resistance to Poison damage and Advantage on saves to avoid or end the Poisoned condition.", "具有毒素伤害抗性，对抗或终止中毒状态的豁免具有优势。"), [tag("resist:poison")]),
      feature("dwarven-toughness", t("Dwarven Toughness", "矮人坚韧"), t("Your HP maximum increases by 1 per level.", "每级生命值上限 +1。"), [mod("hp.max", "@level", { label: t("Dwarven Toughness", "矮人坚韧") })]),
      feature("stonecunning", t("Stonecunning", "石工知识"), t("Bonus Action: Tremorsense 60 ft for 10 minutes while on stone. Proficiency Bonus uses per Long Rest.", "附赠动作：站在石面上时获得 60 尺震颤感知，持续 10 分钟。每次长休次数等于熟练加值。"), [
        resource("stonecunning", t("Stonecunning", "石工知识"), "@prof", LONG_ALL),
        action({ id: "stonecunning", name: t("Stonecunning", "石工知识"), activation: "bonus", category: "feature", cost: [{ resource: "stonecunning" }], applies: [{ effect: "effect:stonecunning", target: "self", duration: { minutes: 10 } }] }),
      ]),
    ],
  },
  {
    id: "species:elf",
    type: "species",
    name: t("Elf", "精灵"),
    summary: t("Fey ancestry, keen senses and lineage magic.", "妖精血统、敏锐感官与血脉魔法。"),
    size: t("Medium", "中型"),
    speed: 30,
    accent: "#15803d",
    grants: [
      darkvision(60),
      lineageChoice("lineage", ["Elven Lineage", "精灵血脉"], ELF),
      spellAbilityChoice(),
      feature("fey-ancestry", t("Fey Ancestry", "妖精血统"), t("Advantage on saves to avoid or end the Charmed condition.", "对抗或终止魅惑状态的豁免具有优势。")),
      { type: "choice", id: "keen-senses", name: t("Keen Senses", "敏锐感官"), count: 1, from: { kind: "proficiency", profKind: "skill", keys: ["insight", "perception", "survival"] } },
      feature("trance", t("Trance", "冥想"), t("You don't sleep; a Long Rest takes you 4 hours of meditation.", "你无需睡眠，4 小时冥想即可完成长休。")),
    ],
  },
  {
    id: "species:gnome",
    type: "species",
    name: t("Gnome", "侏儒"),
    summary: t("Small, clever and resistant to mental magic.", "体型小巧、机敏，对心灵魔法有抵抗力。"),
    size: t("Small", "小型"),
    speed: 30,
    accent: "#7c3aed",
    grants: [
      darkvision(60),
      feature("gnomish-cunning", t("Gnomish Cunning", "侏儒狡黠"), t("Advantage on Intelligence, Wisdom and Charisma saving throws.", "智力、感知与魅力豁免具有优势。")),
      lineageChoice("lineage", ["Gnomish Lineage", "侏儒血脉"], GNOME),
      spellAbilityChoice(),
    ],
  },
  {
    id: "species:goliath",
    type: "species",
    name: t("Goliath", "歌利亚"),
    summary: t("Giant ancestry, powerful build and, at level 5, Large form.", "巨人血统与强健体格，5 级时可化为大型。"),
    size: t("Medium", "中型"),
    speed: 35,
    accent: "#64748b",
    grants: [
      { type: "choice", id: "ancestry", name: t("Giant Ancestry", "巨人血统"), count: 1, from: { kind: "options", options: GIANTS.map(giantOption) } },
      resource("giant-ancestry", t("Giant Ancestry", "巨人血统"), "@prof", LONG_ALL),
      feature("powerful-build", t("Powerful Build", "强健体格"), t("Advantage on checks to end the Grappled condition; count as one size larger for carrying capacity.", "终止受擒状态的检定具有优势；负重时视为大一级体型。")),
      feature("large-form", t("Large Form", "巨型形态"), t("Bonus Action: become Large for 10 minutes (Advantage on Str checks, +10 ft Speed). Once per Long Rest.", "附赠动作：变为大型 10 分钟（力量检定具有优势，速度 +10 尺）。每次长休一次。"), [
        resource("large-form", t("Large Form", "巨型形态"), 1, LONG_ALL),
        action({ id: "large-form", name: t("Large Form", "巨型形态"), activation: "bonus", category: "feature", cost: [{ resource: "large-form" }], applies: [{ effect: "effect:large-form", target: "self", duration: { minutes: 10 } }] }),
      ], { minLevel: 5 }),
    ],
  },
  {
    id: "species:halfling",
    type: "species",
    name: t("Halfling", "半身人"),
    summary: t("Lucky, brave and naturally stealthy.", "幸运、勇敢、天生善于隐匿。"),
    size: t("Small", "小型"),
    speed: 30,
    accent: "#ca8a04",
    grants: [
      feature("brave", t("Brave", "勇敢"), t("Advantage on saves to avoid or end the Frightened condition.", "对抗或终止恐慌状态的豁免具有优势。")),
      feature("halfling-nimbleness", t("Halfling Nimbleness", "半身人灵巧"), t("You can move through the space of any creature a size larger than you.", "可以穿过比你大一级体型的生物所在空间。")),
      feature("luck", t("Luck", "幸运"), t("When you roll a 1 on the d20 of a D20 Test, you can reroll it and must use the new roll.", "D20 检定掷出 1 时可以重掷，且必须使用新结果。"), [], { tags: ["reroll-1"] }),
      feature("naturally-stealthy", t("Naturally Stealthy", "天生隐匿"), t("You can take the Hide action even when obscured only by a creature larger than you.", "即使只被比你大的生物遮挡也能躲藏。")),
    ],
  },
  {
    id: "species:human",
    type: "species",
    name: t("Human", "人类"),
    summary: t("Resourceful and versatile: an extra skill and an origin feat.", "足智多谋、多才多艺：额外一项技能与一个起源专长。"),
    size: t("Medium or Small", "中型或小型"),
    speed: 30,
    accent: "#0369a1",
    grants: [
      sizeChoice(),
      feature("resourceful", t("Resourceful", "足智多谋"), t("You gain Heroic Inspiration whenever you finish a Long Rest.", "每次完成长休时获得英雄激励。"), [
        resource("heroic-inspiration", t("Heroic Inspiration", "英雄激励"), 1, LONG_ALL),
      ]),
      { type: "choice", id: "skillful", name: t("Skillful", "技艺娴熟"), count: 1, from: { kind: "proficiency", profKind: "skill", keys: "any" } },
      { type: "choice", id: "versatile", name: t("Versatile (Origin Feat)", "多才多艺（起源专长）"), count: 1, from: { kind: "entity", entityType: "feat", tags: ["origin"] } },
    ],
  },
  {
    id: "species:orc",
    type: "species",
    name: t("Orc", "兽人"),
    summary: t("Adrenaline rush and relentless endurance.", "肾上腺素冲刺与不屈耐力。"),
    size: t("Medium", "中型"),
    speed: 30,
    accent: "#4d7c0f",
    grants: [
      darkvision(120),
      feature("adrenaline-rush", t("Adrenaline Rush", "肾上腺素冲刺"), t("Bonus Action: Dash and gain Temporary HP equal to your Proficiency Bonus. Proficiency Bonus uses per Short or Long Rest.", "附赠动作：疾走并获得等同于熟练加值的临时生命值。每次短休或长休次数等于熟练加值。"), [
        resource("adrenaline-rush", t("Adrenaline Rush", "肾上腺素冲刺"), "@prof", [{ on: "short", amount: "all" }]),
        action({ id: "adrenaline-rush", name: t("Adrenaline Rush", "肾上腺素冲刺"), activation: "bonus", category: "feature", cost: [{ resource: "adrenaline-rush" }], text: t("Dash + Temporary HP equal to your Proficiency Bonus.", "疾走，并获得等同于熟练加值的临时生命值。"), heal: { dice: "@prof" }, tags: ["temp-hp"] }),
      ]),
      feature("relentless-endurance", t("Relentless Endurance", "不屈耐力"), t("When reduced to 0 HP but not killed outright, drop to 1 HP instead. Once per Long Rest.", "生命值降至 0 但未立即死亡时，改为降至 1。每次长休一次。"), [
        resource("relentless-endurance", t("Relentless Endurance", "不屈耐力"), 1, LONG_ALL),
      ]),
    ],
  },
  {
    id: "species:tiefling",
    type: "species",
    name: t("Tiefling", "提夫林"),
    summary: t("Fiendish legacy grants resistance and innate spells.", "邪魔血脉赋予抗性与天生法术。"),
    size: t("Medium or Small", "中型或小型"),
    speed: 30,
    accent: "#be123c",
    grants: [
      darkvision(60),
      sizeChoice(),
      lineageChoice("legacy", ["Fiendish Legacy", "邪魔血脉"], TIEFLING),
      spellAbilityChoice(),
      feature("otherworldly-presence", t("Otherworldly Presence", "异界存在"), t("You know the Thaumaturgy cantrip.", "你掌握奇术戏法。"), [freeSpell("thaumaturgy")]),
    ],
  },
];
