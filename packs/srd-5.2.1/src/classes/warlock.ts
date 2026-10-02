import type { Entity, Grant, LocalizedText } from "@forge/core";
import { action, equipmentChoice, feature, featChoice, gold, item, LONG_ALL, mod, prof, resource, skillChoice, spellChoice, t, table, tag } from "../helpers";
import { alwaysPrepared, asi, LVL, subclassChoice } from "./common";

/* ───────────────────────── Warlock ───────────────────────── */

const L = LVL("warlock");
const WARLOCK_PREPARED = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
/** Pact slot level by Warlock level. */
const PACT_MAX = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
const spells = (id: string, level: number, count: number): Grant => spellChoice(id, t("Warlock Spells", "魔契师法术"), count, "warlock", 1, PACT_MAX[level - 1]!);
const cantrips = (id: string, count: number): Grant => spellChoice(id, t("Cantrips", "戏法"), count, "warlock", 0, 0);
const atWill = (spell: string): Grant[] => [{ type: "spell", spell: `spell:${spell}`, alwaysPrepared: true }, tag(`at-will:${spell}`)];
const lvl = (n: number, also?: string) => ({ formula: `@class.warlock.level >= ${n}${also ? ` && ${also}` : ""}`, text: t(`Warlock level ${n}+${also ? ", pact" : ""}`, `魔契师等级 ${n}+${also ? "，需对应魔契" : ""}`) });

interface Invocation {
  id: string;
  name: LocalizedText;
  text: LocalizedText;
  prereq?: ReturnType<typeof lvl>;
  grants: Grant[];
}
const inv = (id: string, en: string, zh: string, ten: string, tzh: string, grants: Grant[] = [], prereq?: ReturnType<typeof lvl>): Invocation => ({ id, name: t(en, zh), text: t(ten, tzh), prereq, grants: [tag(`invocation-${id}`), ...grants] });

const BLADE = "@tag.invocation-pact-of-the-blade";
const CHAIN = "@tag.invocation-pact-of-the-chain";

/** Eldritch Invocations up to Warlock level 8 (later ones arrive with higher levels). */
const INVOCATIONS: Invocation[] = [
  inv("armor-of-shadows", "Armor of Shadows", "幽影护甲", "Cast Mage Armor on yourself without a spell slot.", "可对自身无需法术位地施展法师护甲。", atWill("mage-armor")),
  inv("eldritch-mind", "Eldritch Mind", "魔能意志", "Advantage on Constitution saves to maintain Concentration.", "维持专注的体质豁免具有优势。", [tag("adv:save.concentration")]),
  inv("pact-of-the-blade", "Pact of the Blade", "刃之魔契", "Bonus Action: conjure a pact weapon or bond with a magic weapon; you're proficient with it and can use Charisma for its attacks and damage.", "以附赠动作召唤契约武器或与魔法武器缔结连结；你熟练该武器，并可用魅力进行其攻击与伤害。", [
    action({ id: "pact-weapon", name: t("Conjure Pact Weapon", "召唤契约武器"), activation: "bonus", category: "feature" }),
  ]),
  inv("pact-of-the-chain", "Pact of the Chain", "链之魔契", "Learn Find Familiar and cast it as a Magic action without a slot; your familiar can take special forms.", "习得寻获魔宠，可无需法术位地以魔法动作施展；魔宠可选择特殊形态。", atWill("find-familiar")),
  inv("pact-of-the-tome", "Pact of the Tome", "书之魔契", "A Book of Shadows holds three cantrips and two level 1 Ritual spells of your choice from any class; they count as Warlock spells.", "影之书中记载三道戏法与两道一环仪式法术（可来自任意职业），视为魔契师法术。", [
    { type: "choice", id: "tome-cantrips", name: t("Book of Shadows: Cantrips", "影之书：戏法"), count: 3, from: { kind: "entity", entityType: "spell", maxLevel: 0, spell: { alwaysPrepared: true } } },
    { type: "choice", id: "tome-rituals", name: t("Book of Shadows: Rituals", "影之书：仪式"), count: 2, from: { kind: "entity", entityType: "spell", tags: ["ritual"], minLevel: 1, maxLevel: 1, spell: { alwaysPrepared: true } } },
  ]),
  inv("agonizing-blast", "Agonizing Blast", "苦痛魔爆", "Add your Cha modifier to the damage of one damaging Warlock cantrip.", "选择一道造成伤害的魔契师戏法，其伤害加上魅力调整值。", [], lvl(2)),
  inv("devils-sight", "Devil's Sight", "魔鬼视界", "See normally in Dim Light and Darkness, magical or not, within 120 ft.", "在 120 尺内可在微光与黑暗（无论是否魔法）中正常视物。", [mod("sense.darkvision", 120, { op: "atLeast", label: t("Devil's Sight", "魔鬼视界") })], lvl(2)),
  inv("eldritch-spear", "Eldritch Spear", "魔能长枪", "One damaging Warlock cantrip with a range of 10+ ft gains range equal to 30 × your Warlock level.", "一道射程至少 10 尺的伤害戏法射程变为魔契师等级 × 30 尺。", [], lvl(2)),
  inv("fiendish-vigor", "Fiendish Vigor", "邪魔活力", "Cast False Life on yourself without a slot, taking the maximum Temporary HP.", "可对自身无需法术位地施展虚假生命，并取最大临时生命值。", atWill("false-life"), lvl(2)),
  inv("lessons-of-the-first-ones", "Lessons of the First Ones", "原初之一的教习", "Gain one Origin feat of your choice.", "获得一项自选的起源专长。", [featChoice("origin-feat", ["origin"], t("Origin Feat", "起源专长"))], lvl(2)),
  inv("mask-of-many-faces", "Mask of Many Faces", "千面之颜", "Cast Disguise Self without a spell slot.", "可无需法术位地施展易容术。", atWill("disguise-self"), lvl(2)),
  inv("misty-visions", "Misty Visions", "幻象迷踪", "Cast Silent Image without a spell slot.", "可无需法术位地施展无声幻影。", atWill("silent-image"), lvl(2)),
  inv("otherworldly-leap", "Otherworldly Leap", "超凡跳跃", "Cast Jump on yourself without a spell slot.", "可对自身无需法术位地施展跳跃术。", atWill("jump"), lvl(2)),
  inv("repelling-blast", "Repelling Blast", "斥力魔爆", "When an attack-roll Warlock cantrip hits a Large or smaller creature, push it up to 10 ft.", "以需要攻击检定的魔契师戏法命中大型或更小生物时，可将其推离至多 10 尺。", [], lvl(2)),
  inv("ascendant-step", "Ascendant Step", "星移步法", "Cast Levitate on yourself without a spell slot.", "可对自身无需法术位地施展浮空术。", atWill("levitate"), lvl(5)),
  inv("eldritch-smite", "Eldritch Smite", "魔能斩", "Once per turn on a pact weapon hit, expend a Pact Magic slot: +1d8 Force per slot level (plus 1d8) and the target can be knocked Prone.", "每回合一次，契约武器命中时消耗一个契约魔法法术位：额外造成 1d8 + 每环 1d8 力场伤害，并可使目标倒地。", [
    action({ id: "eldritch-smite", name: t("Eldritch Smite", "魔能斩"), activation: "special", category: "feature", tags: ["rider", "once-per-turn"], trigger: t("You hit with your pact weapon", "以契约武器命中时"), damage: [{ dice: "[[1 + @spell.warlock.max-level]]d8", type: "force" }] }),
  ], lvl(5, BLADE)),
  inv("gaze-of-two-minds", "Gaze of Two Minds", "共视感官", "Bonus Action: touch a willing creature and perceive through its senses until the end of your next turn.", "以附赠动作触碰一名自愿生物，直到你下回合结束前共享其感官。", [action({ id: "gaze-of-two-minds", name: t("Gaze of Two Minds", "共视感官"), activation: "bonus", category: "feature", range: t("Touch", "触及") })], lvl(5)),
  inv("gift-of-the-depths", "Gift of the Depths", "深海馈赠", "Breathe underwater and gain a Swim Speed equal to your Speed; cast Water Breathing once per Long Rest without a slot.", "可在水下呼吸并获得等同于速度的游泳速度；每次长休一次无需法术位地施展水下呼吸。", [
    mod("speed.swim", "@speed.walk", { op: "atLeast", label: t("Gift of the Depths", "深海馈赠") }),
    { type: "spell", spell: "spell:water-breathing", alwaysPrepared: true, free: { max: 1, recovery: LONG_ALL } },
  ], lvl(5)),
  inv("investment-of-the-chain-master", "Investment of the Chain Master", "链主赋能", "Your familiar gains a Fly or Swim Speed of 40 ft, magical attacks, and uses your spell save DC.", "你的魔宠获得 40 尺飞行或游泳速度，攻击视为魔法，并使用你的法术豁免 DC。", [], lvl(5, CHAIN)),
  inv("master-of-myriad-forms", "Master of Myriad Forms", "万形之主", "Cast Alter Self without a spell slot.", "可无需法术位地施展变身术。", atWill("alter-self"), lvl(5)),
  inv("one-with-shadows", "One with Shadows", "融身入影", "While in Dim Light or Darkness, cast Invisibility on yourself without a spell slot.", "身处微光或黑暗时，可对自身无需法术位地施展隐形术。", atWill("invisibility"), lvl(5)),
  inv("thirsting-blade", "Thirsting Blade", "饥渴魔刃", "Attack twice with your pact weapon when you take the Attack action.", "执行攻击动作时可用契约武器攻击两次。", [feature("thirsting-blade", t("Thirsting Blade", "饥渴魔刃"), t("Extra Attack with your pact weapon.", "契约武器获得额外攻击。"), [tag("extra-attack")], { tags: ["attacks:2"] })], lvl(5, BLADE)),
  inv("whispers-of-the-grave", "Whispers of the Grave", "坟茔殁语", "Cast Speak with Dead without a spell slot.", "可无需法术位地施展死者交谈。", atWill("speak-with-dead"), lvl(7)),
];

export const warlock: Entity = {
  id: "class:warlock",
  type: "class",
  name: t("Warlock", "魔契师"),
  summary: t("An occultist empowered by a pact with a patron.", "与宗主缔约而获得力量的秘术师。"),
  text: t(
    "Warlocks wield Pact Magic: few spell slots, always cast at their highest level and regained on a Short Rest. Eldritch Invocations shape the rest of their power.",
    "魔契师使用契约魔法：法术位不多，但总以最高环阶施展，并在短休后恢复。魔能祈唤塑造其余的力量。",
  ),
  hitDie: 8,
  primaryAbility: ["cha"],
  subclassLevel: 3,
  accent: "#7e22ce",
  tags: ["caster"],
  starting: [
    ...prof("save", "wis", "cha"),
    ...prof("armor", "light"),
    ...prof("weapon", "simple"),
    skillChoice(2, ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"]),
    equipmentChoice("equipment", [
      { id: "a", name: t("Leather, Sickle & Focus", "皮甲、镰刀与法器"), items: [item("leather-armor", 1, true), item("sickle", 1, true), item("dagger", 2), item("arcane-focus"), item("book"), item("scholars-pack"), gold(15)] },
      { id: "b", name: t("100 GP", "100 金币"), items: [gold(100)] },
    ]),
  ],
  multiclass: [...prof("armor", "light")],
  levels: {
    "1": [
      {
        type: "spellcasting",
        classId: "class:warlock",
        ability: "cha",
        progression: "pact",
        list: "warlock",
        mode: "known",
        cantrips: table(L, [2, 2, 2, 3, 3, 3, 3, 3, 3, 4]),
        prepared: table(L, WARLOCK_PREPARED),
      },
      cantrips("cantrips", 2),
      spells("spells", 1, 2),
      feature("eldritch-invocations", t("Eldritch Invocations", "魔能祈唤"), t("Gain Eldritch Invocations (1 at level 1, 3 at 2, 5 at 5, 6 at 7). You can replace one whenever you gain a Warlock level.", "获得魔能祈唤（1 级 1 个，2 级 3 个，5 级 5 个，7 级 6 个）。每次获得魔契师等级时可替换一个。"), [
        {
          type: "choice",
          id: "invocations",
          name: t("Eldritch Invocations", "魔能祈唤"),
          count: table(L, [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10]),
          from: { kind: "options", options: INVOCATIONS },
        },
      ]),
    ],
    "2": [
      feature("magical-cunning", t("Magical Cunning", "秘法回流"), t("Once per Long Rest, perform a 1-minute rite to regain half your expended Pact Magic slots (round up).", "每次长休一次，进行 1 分钟仪式以恢复一半已消耗的契约魔法法术位（向上取整）。"), [
        resource("magical-cunning", t("Magical Cunning", "秘法回流"), 1, LONG_ALL),
        action({ id: "magical-cunning", name: t("Magical Cunning", "秘法回流"), activation: "minute", category: "feature", cost: [{ resource: "magical-cunning" }] }),
      ]),
      spells("spells-2", 2, 1),
    ],
    "3": [subclassChoice("warlock"), spells("spells-3", 3, 1)],
    "4": [asi(), cantrips("cantrips-4", 1), spells("spells-4", 4, 1)],
    "5": [spells("spells-5", 5, 1)],
    "6": [spells("spells-6", 6, 1)],
    "7": [spells("spells-7", 7, 1)],
    "8": [asi("feat-8"), spells("spells-8", 8, 1)],
  },
};

export const fiendPatron: Entity = {
  id: "subclass:fiend-patron",
  type: "subclass",
  classId: "class:warlock",
  name: t("Fiend Patron", "邪魔宗主"),
  summary: t("Make a deal with the Lower Planes.", "与下层位面达成交易。"),
  tags: ["warlock"],
  levels: {
    "3": [
      feature("dark-ones-blessing", t("Dark One's Blessing", "黑暗赐福"), t("When you (or someone within 10 ft of you) reduce an enemy to 0 HP, gain Temporary HP equal to your Cha modifier + Warlock level (min 1).", "当你（或你 10 尺内的他人）将敌人生命值降至 0 时，获得等同于魅力调整值 + 魔契师等级的临时生命值（至少 1）。"), [
        action({ id: "dark-ones-blessing", name: t("Dark One's Blessing", "黑暗赐福"), activation: "special", category: "feature", trigger: t("An enemy drops to 0 HP", "敌人生命值降至 0"), text: t(`Gain [[max(1, @ability.cha.mod + ${L})]] Temporary HP.`, `获得 [[max(1, @ability.cha.mod + ${L})]] 点临时生命值。`) }),
      ]),
      feature("fiend-spells", t("Fiend Spells", "邪魔法术"), t("Always prepared: Burning Hands, Command, Scorching Ray, Suggestion; Fireball and Stinking Cloud at 5; Fire Shield and Wall of Fire at 7.", "始终准备：燃烧之手、命令术、灼热射线、暗示术；5 级火球术、臭云术；7 级火焰护盾、火墙术。"), [
        ...alwaysPrepared(undefined, "burning-hands", "command", "scorching-ray", "suggestion"),
        ...alwaysPrepared(5, "fireball", "stinking-cloud"),
        ...alwaysPrepared(7, "fire-shield", "wall-of-fire"),
      ]),
    ],
    "6": [
      feature("dark-ones-own-luck", t("Dark One's Own Luck", "黑暗强运"), t("Add 1d10 to an ability check or saving throw after seeing the roll. Uses equal your Cha modifier (min 1) per Long Rest.", "看到结果后可为属性检定或豁免检定加上 1d10。每次长休可用次数等于魅力调整值（至少 1）。"), [
        resource("dark-ones-own-luck", t("Dark One's Own Luck", "黑暗强运"), "max(1, @ability.cha.mod)", LONG_ALL),
        action({ id: "dark-ones-own-luck", name: t("Dark One's Own Luck", "黑暗强运"), activation: "special", category: "feature", cost: [{ resource: "dark-ones-own-luck" }], text: t("Add 1d10.", "加上 1d10。") }),
      ]),
    ],
  },
};
