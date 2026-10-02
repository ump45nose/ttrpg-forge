import type { Entity } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, masteryChoice, mod, prof, resource, SHORT_ONE, skillChoice, t, table, tag } from "../helpers";
import { asi, LVL, MARTIAL_MELEE, SIMPLE_MELEE, subclassChoice } from "./common";

const L = LVL("barbarian");
const SKILLS = ["animal-handling", "athletics", "intimidation", "nature", "perception", "survival"];
/** Rage Damage column; the Rage effect reads it. */
export const RAGE_DAMAGE = table(L, [2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4]);

export const barbarian: Entity = {
  id: "class:barbarian",
  type: "class",
  name: t("Barbarian", "野蛮人"),
  summary: t("A fierce warrior of primal rage.", "怀揣原初狂怒的凶猛战士。"),
  text: t(
    "Barbarians channel Rage into raw power and resilience: bonus damage, resistance to weapon blows and Advantage on Strength. Unarmored Defense and Reckless Attack make them the front line.",
    "野蛮人将狂暴化为纯粹的力量与韧性：额外伤害、对武器伤害的抗性以及力量上的优势。无甲防御与鲁莽攻击让他们成为当之无愧的前排。",
  ),
  hitDie: 12,
  primaryAbility: ["str"],
  subclassLevel: 3,
  accent: "#c2410c",
  tags: ["martial"],
  starting: [
    ...prof("save", "str", "con"),
    ...prof("armor", "light", "medium", "shield"),
    ...prof("weapon", "simple", "martial"),
    skillChoice(2, SKILLS),
    equipmentChoice("equipment", [
      { id: "a", name: t("Greataxe & Handaxes", "巨斧与手斧"), items: [item("greataxe", 1, true), item("handaxe", 4), item("explorers-pack"), gold(15)] },
      { id: "b", name: t("75 GP", "75 金币"), items: [gold(75)] },
    ]),
  ],
  multiclass: [...prof("armor", "shield"), ...prof("weapon", "martial")],
  levels: {
    "1": [
      feature("rage", t("Rage", "狂暴"), t("Bonus Action while not in Heavy armor: Resistance to Bludgeoning, Piercing and Slashing damage, bonus damage on Strength attacks, Advantage on Strength checks and saves. No spells or Concentration. Lasts while you keep attacking (up to 10 minutes).", "未着重甲时以附赠动作进入：对钝击、穿刺、挥砍伤害具有抗性，力量攻击获得狂暴伤害加值，力量检定与豁免具有优势；无法施法或专注。持续期间需不断进攻，至多 10 分钟。"), [
        resource("rage", t("Rage", "狂暴"), table(L, [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6]), SHORT_ONE),
        action({
          id: "rage",
          name: t("Rage", "狂暴"),
          activation: "bonus",
          category: "feature",
          cost: [{ resource: "rage" }],
          when: "!@armor.heavy",
          text: t(`Rage Damage +[[${RAGE_DAMAGE}]].`, `狂暴伤害 +[[${RAGE_DAMAGE}]]。`),
          applies: [{ effect: "effect:rage", target: "self", duration: { minutes: 10 } }],
        }),
      ]),
      feature("unarmored-defense", t("Unarmored Defense", "无甲防御"), t("Without armor, your base AC is 10 + Dex + Con. A Shield still applies.", "未着装护甲时，基础 AC 为 10 + 敏捷 + 体质，仍可使用盾牌。"), [
        mod("ac", "10 + @ability.dex.mod + @ability.con.mod", { op: "base", when: "!@equipped.armor", label: t("Unarmored Defense", "无甲防御") }),
      ]),
      masteryChoice(2, [...SIMPLE_MELEE, ...MARTIAL_MELEE]),
    ],
    "2": [
      feature("danger-sense", t("Danger Sense", "危机感应"), t("Advantage on Dexterity saving throws unless you are Incapacitated.", "未陷入失能时，敏捷豁免具有优势。"), [tag("adv:save.dex", t("Danger Sense", "危机感应"))]),
      feature("reckless-attack", t("Reckless Attack", "鲁莽攻击"), t("On your first attack roll of a turn, gain Advantage on Strength attacks until your next turn; attacks against you also have Advantage.", "回合内首次攻击时可鲁莽进攻：直到你下回合开始，你的力量攻击具有优势，但对你的攻击也具有优势。"), [
        action({ id: "reckless-attack", name: t("Reckless Attack", "鲁莽攻击"), activation: "special", category: "feature", trigger: t("Your first attack roll on your turn", "你回合内的首次攻击检定"), text: t("Advantage on Str attacks; attacks against you have Advantage until your next turn.", "力量攻击具有优势；直到你下回合开始，对你的攻击也具有优势。") }),
      ]),
    ],
    "3": [
      subclassChoice("barbarian"),
      feature("primal-knowledge", t("Primal Knowledge", "原初学识"), t("Gain one more Barbarian skill. While raging, you can use Strength for Acrobatics, Intimidation, Perception, Stealth and Survival checks.", "额外获得一项野蛮人技能熟练。狂暴期间，特技、威吓、察觉、隐匿与求生检定可改用力量。"), [
        skillChoice(1, SKILLS, "primal-knowledge-skill"),
      ]),
    ],
    "4": [asi(), masteryChoice(1, [...SIMPLE_MELEE, ...MARTIAL_MELEE], "weapon-mastery-4")],
    "5": [
      feature("extra-attack", t("Extra Attack", "额外攻击"), t("Attack twice whenever you take the Attack action.", "执行攻击动作时可攻击两次。"), [tag("extra-attack")], { tags: ["attacks:2"] }),
      feature("fast-movement", t("Fast Movement", "快速移动"), t("Your Speed increases by 10 ft while you aren't wearing Heavy armor.", "未着重甲时，速度 +10 尺。"), [
        mod("speed.walk", 10, { when: "!@armor.heavy", label: t("Fast Movement", "快速移动") }),
      ]),
    ],
    "7": [
      feature("feral-instinct", t("Feral Instinct", "野性直觉"), t("Advantage on Initiative rolls.", "先攻检定具有优势。"), [tag("adv:initiative", t("Feral Instinct", "野性直觉"))]),
      feature("instinctive-pounce", t("Instinctive Pounce", "莽驰"), t("As part of the Bonus Action to enter Rage, move up to half your Speed.", "进入狂暴的附赠动作中，可移动至多一半速度。")),
    ],
    "8": [asi("feat-8")],
  },
};

export const berserker: Entity = {
  id: "subclass:path-of-the-berserker",
  type: "subclass",
  classId: "class:barbarian",
  name: t("Path of the Berserker", "狂战士道途"),
  summary: t("Violence as an end in itself: frenzied extra damage while raging.", "以暴力本身为目的：狂暴中鲁莽进攻造成额外伤害。"),
  tags: ["barbarian"],
  levels: {
    "3": [
      feature("frenzy", t("Frenzy", "狂怒"), t("While raging, if you use Reckless Attack, the first target you hit with a Strength attack this turn takes extra damage: d6s equal to your Rage Damage bonus.", "狂暴期间使用鲁莽攻击时，本回合首个被你力量攻击命中的目标额外受到若干 d6 伤害，骰数等于狂暴伤害加值。"), [
        action({ id: "frenzy", name: t("Frenzy", "狂怒"), activation: "special", category: "feature", tags: ["rider", "once-per-turn"], trigger: t("First Strength hit this turn while raging and reckless", "狂暴且鲁莽攻击时，本回合首次力量攻击命中"), damage: [{ dice: `[[${RAGE_DAMAGE}]]d6`, type: "weapon" }] }),
      ]),
    ],
    "6": [
      feature("mindless-rage", t("Mindless Rage", "无我狂暴"), t("Immunity to the Charmed and Frightened conditions while raging; entering Rage ends them.", "狂暴期间免疫魅惑与恐慌状态；进入狂暴时这些状态结束。"), [tag("immune-while-raging:charmed"), tag("immune-while-raging:frightened")]),
    ],
  },
};
