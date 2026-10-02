import type { Entity, Grant } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, LONG_ALL, mod, prof, resource, SHORT_ALL, skillChoice, t, table, tag } from "../helpers";
import { ARTISAN, asi, INSTRUMENTS, LVL, SIMPLE_MELEE, subclassChoice } from "./common";

const L = LVL("monk");
/** Martial Arts die size by Monk level. */
export const MA_DIE = table(L, [6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 12, 12, 12, 12]);
export const MA_ROLL = `1d[[${MA_DIE}]]`;
/** Save DC for Monk focus features. */
export const FOCUS_DC = "8 + @ability.wis.mod + @prof";
const DEX = "max(@ability.str.mod, @ability.dex.mod)";
const UNARMORED = "!@equipped.armor && !@equipped.shield";

const focus = (id: string, en: string, zh: string, activation: "action" | "bonus" | "reaction" | "special", textEn: string, textZh: string, extra: Partial<Parameters<typeof action>[0]> = {}): Grant =>
  action({ id, name: t(en, zh), activation, category: "feature", text: t(textEn, textZh), ...extra });

export const monk: Entity = {
  id: "class:monk",
  type: "class",
  name: t("Monk", "武僧"),
  summary: t("A martial artist who channels inner focus.", "以内在功力驾驭武艺的修行者。"),
  text: t(
    "Monks fight unarmored with fists and simple blades, add their Wisdom to AC, and spend Focus Points on Flurry of Blows, Patient Defense and Step of the Wind.",
    "武僧不着护甲，以拳脚与简易兵刃作战，感知加入 AC，并消耗功力施展疾风连击、坚强防御与疾步如风。",
  ),
  hitDie: 8,
  primaryAbility: ["dex", "wis"],
  subclassLevel: 3,
  accent: "#0d9488",
  tags: ["martial"],
  starting: [
    ...prof("save", "str", "dex"),
    ...prof("weapon", "simple", "item:scimitar", "item:shortsword", "item:hand-crossbow"),
    skillChoice(2, ["acrobatics", "athletics", "history", "insight", "religion", "stealth"]),
    {
      type: "choice",
      id: "tool",
      name: t("Tool Proficiency", "工具熟练"),
      text: t("One type of Artisan's Tools or Musical Instrument.", "一种工匠工具或乐器。"),
      count: 1,
      from: { kind: "proficiency", profKind: "tool", keys: [...ARTISAN, ...INSTRUMENTS].map((x) => `item:${x}`) },
    },
    equipmentChoice("equipment", [
      { id: "a", name: t("Spear & Daggers", "矛与匕首"), items: [item("spear", 1, true), item("dagger", 5), item("explorers-pack"), gold(11)] },
      { id: "b", name: t("50 GP", "50 金币"), items: [gold(50)] },
    ]),
  ],
  multiclass: [],
  levels: {
    "1": [
      feature("martial-arts", t("Martial Arts", "武艺"), t("Unarmed and with Monk weapons (Simple melee, Light Martial melee): use Dex instead of Str, roll the Martial Arts die for damage, and make an Unarmed Strike as a Bonus Action.", "徒手或使用武僧武器（简易近战武器、轻型军用近战武器）时可用敏捷代替力量，伤害可改用武艺骰，并可用附赠动作进行一次徒手打击。"), [
        tag("martial-arts"),
        mod("martial-arts.die", MA_DIE, { op: "atLeast", label: t("Martial Arts", "武艺") }),
        action({
          id: "martial-arts-strike",
          name: t("Unarmed Strike (Martial Arts)", "徒手打击（武艺）"),
          activation: "action",
          category: "attack",
          tags: ["unarmed"],
          text: t("Also usable as a Bonus Action after the Attack action.", "执行攻击动作后也可用附赠动作进行。"),
          attack: { bonus: `${DEX} + @prof + @attack.melee`, kind: "melee" },
          damage: [{ dice: `${MA_ROLL} + [[${DEX}]]`, type: "bludgeoning" }],
        }),
      ]),
      feature("unarmored-defense", t("Unarmored Defense", "无甲防御"), t("Without armor or a Shield, your base AC is 10 + Dex + Wis.", "未着装护甲且未持盾时，基础 AC 为 10 + 敏捷 + 感知。"), [
        mod("ac", "10 + @ability.dex.mod + @ability.wis.mod", { op: "base", when: UNARMORED, label: t("Unarmored Defense", "无甲防御") }),
      ]),
    ],
    "2": [
      feature("monks-focus", t("Monk's Focus", "武僧武功"), t("Focus Points equal to your Monk level, regained on a Short or Long Rest. Flurry of Blows, Patient Defense and Step of the Wind.", "功力点数等于武僧等级，短休或长休恢复。可施展疾风连击、坚强防御与疾步如风。"), [
        resource("focus", t("Focus Points", "功力"), L, SHORT_ALL),
        focus("flurry-of-blows", "Flurry of Blows", "疾风连击", "bonus", "Make two Unarmed Strikes.", "进行两次徒手打击。", { cost: [{ resource: "focus" }] }),
        focus("patient-defense", "Patient Defense", "坚强防御", "bonus", "Disengage; spend 1 Focus Point to also Dodge.", "执行撤离动作；消耗 1 功力可同时执行闪避动作。"),
        focus("step-of-the-wind", "Step of the Wind", "疾步如风", "bonus", "Dash; spend 1 Focus Point to also Disengage and double your jump distance.", "执行疾走动作；消耗 1 功力可同时撤离，且跳跃距离翻倍。"),
      ]),
      feature("unarmored-movement", t("Unarmored Movement", "无甲移动"), t("Your Speed increases while you wear no armor and wield no Shield.", "未着护甲且未持盾时，速度提升。"), [
        mod("speed.walk", table(L, [0, 10, 10, 10, 10, 15, 15, 15, 15, 20, 20, 20, 20, 25, 25, 25, 25, 30, 30, 30]), { when: UNARMORED, label: t("Unarmored Movement", "无甲移动") }),
      ]),
      feature("uncanny-metabolism", t("Uncanny Metabolism", "运转周天"), t("When you roll Initiative, regain all Focus Points and heal Martial Arts die + Monk level. Once per Long Rest.", "投掷先攻时，恢复全部功力并回复武艺骰 + 武僧等级的生命值。每次长休一次。"), [
        resource("uncanny-metabolism", t("Uncanny Metabolism", "运转周天"), 1, LONG_ALL),
        focus("uncanny-metabolism", "Uncanny Metabolism", "运转周天", "special", "Regain all Focus Points.", "恢复全部功力。", { cost: [{ resource: "uncanny-metabolism" }], trigger: t("You roll Initiative", "投掷先攻时"), heal: { dice: `${MA_ROLL} + [[${L}]]` } }),
      ]),
    ],
    "3": [
      subclassChoice("monk"),
      feature("deflect-attacks", t("Deflect Attacks", "拨挡攻击"), t("Reaction when hit by an attack dealing Bludgeoning, Piercing or Slashing damage: reduce it by 1d10 + Dex + Monk level. If reduced to 0, spend 1 Focus Point to redirect it (Dex save, two Martial Arts dice + Dex).", "被造成钝击、穿刺或挥砍伤害的攻击命中时，以反应将伤害减少 1d10 + 敏捷 + 武僧等级。若降至 0，可消耗 1 功力将其反弹（敏捷豁免，两枚武艺骰 + 敏捷）。"), [
        focus("deflect-attacks", "Deflect Attacks", "拨挡攻击", "reaction", `Reduce the damage by 1d10 + [[@ability.dex.mod + ${L}]].`, `所受伤害减少 1d10 + [[@ability.dex.mod + ${L}]]。`, { trigger: t("An attack hits you", "被攻击命中") }),
      ]),
    ],
    "4": [
      asi(),
      feature("slow-fall", t("Slow Fall", "轻身坠"), t("Reaction when you fall: reduce the falling damage by five times your Monk level.", "坠落时以反应将坠落伤害减少武僧等级的五倍。"), [
        focus("slow-fall", "Slow Fall", "轻身坠", "reaction", `Reduce falling damage by [[5 * ${L}]].`, `坠落伤害减少 [[5 * ${L}]]。`, { trigger: t("You fall", "你坠落时") }),
      ]),
    ],
    "5": [
      feature("extra-attack", t("Extra Attack", "额外攻击"), t("Attack twice whenever you take the Attack action.", "执行攻击动作时可攻击两次。"), [tag("extra-attack")], { tags: ["attacks:2"] }),
      feature("stunning-strike", t("Stunning Strike", "震慑拳"), t("Once per turn when you hit with a Monk weapon or Unarmed Strike, spend 1 Focus Point: Con save or Stunned until the start of your next turn; on a success its Speed is halved and the next attack against it has Advantage.", "每回合一次，以武僧武器或徒手打击命中时可消耗 1 功力：目标进行体质豁免，失败则震慑至你下回合开始；成功则速度减半，且下一次对其的攻击具有优势。"), [
        focus("stunning-strike", "Stunning Strike", "震慑拳", "special", "Con save or Stunned.", "体质豁免，失败则震慑。", { cost: [{ resource: "focus" }], tags: ["rider", "once-per-turn"], trigger: t("You hit with a Monk weapon or Unarmed Strike", "以武僧武器或徒手打击命中"), save: { ability: "con", dc: FOCUS_DC, onSave: "none" }, applies: [{ effect: "condition:stunned", target: "target", duration: { rounds: 1 } }] }),
      ]),
    ],
    "6": [
      feature("empowered-strikes", t("Empowered Strikes", "真力注拳"), t("Your Unarmed Strikes can deal Force damage instead of their normal type.", "你的徒手打击可改为造成力场伤害。"), [tag("empowered-strikes")]),
    ],
    "7": [
      feature("evasion", t("Evasion", "反射闪避"), t("When a Dex save would halve damage, take none on a success and half on a failure (unless Incapacitated).", "进行敏捷豁免以承受一半伤害的效应时，成功则不受伤害，失败只受一半（失能时除外）。"), [tag("evasion")]),
    ],
    "8": [asi("feat-8")],
  },
};

export const openHand: Entity = {
  id: "subclass:warrior-of-the-open-hand",
  type: "subclass",
  classId: "class:monk",
  name: t("Warrior of the Open Hand", "散打武者"),
  summary: t("Masters of unarmed combat who push, topple and disrupt.", "徒手格斗大师，推撞、摔绊、扰乱敌人。"),
  tags: ["monk"],
  levels: {
    "3": [
      feature("open-hand-technique", t("Open Hand Technique", "散打技巧"), t("When you hit with a Flurry of Blows strike: Addle (no Opportunity Attacks until its next turn), Push (Str save or pushed 15 ft) or Topple (Dex save or Prone).", "疾风连击命中时可附加：扰乱（直到其下回合开始无法借机攻击）、推撞（力量豁免，失败被推开 15 尺）或摔绊（敏捷豁免，失败倒地）。"), [
        action({ id: "open-hand-technique", name: t("Open Hand Technique", "散打技巧"), activation: "special", category: "feature", tags: ["rider"], trigger: t("A Flurry of Blows strike hits", "疾风连击命中"), save: { ability: "dex", dc: FOCUS_DC, onSave: "none" } }),
      ]),
    ],
    "6": [
      feature("wholeness-of-body", t("Wholeness of Body", "混元体"), t("Bonus Action: regain HP equal to a Martial Arts die roll + Wis modifier. Uses equal to your Wis modifier (min 1) per Long Rest.", "附赠动作：回复一枚武艺骰 + 感知调整值的生命值。每次长休可用次数等于感知调整值（至少 1）。"), [
        resource("wholeness-of-body", t("Wholeness of Body", "混元体"), "max(1, @ability.wis.mod)", LONG_ALL),
        action({ id: "wholeness-of-body", name: t("Wholeness of Body", "混元体"), activation: "bonus", category: "feature", cost: [{ resource: "wholeness-of-body" }], heal: { dice: `${MA_ROLL} + [[max(1, @ability.wis.mod)]]` } }),
      ]),
    ],
  },
};
