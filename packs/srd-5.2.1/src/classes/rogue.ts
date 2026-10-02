import type { Entity } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, masteryChoice, mod, prof, skillChoice, t, tag } from "../helpers";
import { asi, LVL, SIMPLE, subclassChoice } from "./common";

/* ───────────────────────── Rogue ───────────────────────── */

const ROGUE_MARTIAL = ["item:rapier", "item:scimitar", "item:shortsword", "item:hand-crossbow", "item:whip"];
const ROGUE_SKILLS = ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "persuasion", "sleight-of-hand", "stealth"];

export const rogue: Entity = {
  id: "class:rogue",
  type: "class",
  name: t("Rogue", "游荡者"),
  summary: t("A dexterous expert in stealth and subterfuge.", "精于潜行与诡计的灵巧专家。"),
  text: t(
    "Rogues strike where it hurts with Sneak Attack, slip away with Cunning Action, and are experts at the skills that matter.",
    "游荡者以偷袭打击要害，以灵巧动作全身而退，并在关键技能上身怀专精。",
  ),
  hitDie: 8,
  primaryAbility: ["dex"],
  subclassLevel: 3,
  accent: "#5f8fb0",
  tags: ["martial"],
  starting: [
    ...prof("save", "dex", "int"),
    ...prof("armor", "light"),
    ...prof("weapon", "simple", ...ROGUE_MARTIAL),
    ...prof("tool", "item:thieves-tools"),
    skillChoice(4, ROGUE_SKILLS),
    equipmentChoice("equipment", [
      { id: "a", name: t("Leather, Shortsword & Bow", "皮甲、短剑与短弓"), items: [item("leather-armor", 1, true), item("dagger", 2), item("shortsword", 1, true), item("shortbow"), item("arrows", 20), item("quiver"), item("thieves-tools"), item("burglars-pack"), gold(8)] },
      { id: "b", name: t("100 GP", "100 金币"), items: [gold(100)] },
    ]),
  ],
  multiclass: [...prof("armor", "light"), ...prof("tool", "item:thieves-tools"), skillChoice(1, ROGUE_SKILLS, "multiclass-skill")],
  levels: {
    "1": [
      {
        type: "choice",
        id: "expertise",
        name: t("Expertise", "专精"),
        text: t("Choose two of your skill proficiencies; your Proficiency Bonus is doubled for them.", "选择两项已熟练的技能，其熟练加值翻倍。"),
        count: 2,
        from: { kind: "proficiency", profKind: "skill", keys: "any", level: "expertise", requireProficient: true },
      },
      feature("sneak-attack", t("Sneak Attack", "偷袭"), t("Once per turn, deal extra damage when you hit with a Finesse or Ranged weapon and have Advantage, or an ally is within 5 ft of the target.", "每回合一次，以灵巧或远程武器命中且具有优势、或目标 5 尺内有你的盟友时，造成额外伤害。"), [
        action({
          id: "sneak-attack",
          name: t("Sneak Attack", "偷袭"),
          activation: "special",
          category: "feature",
          tags: ["rider", "once-per-turn"],
          trigger: t("Hit with a Finesse/Ranged weapon with Advantage or an ally adjacent to the target", "以灵巧/远程武器命中，且具有优势或目标身旁有盟友"),
          damage: [{ dice: `[[ceil(${LVL("rogue")} / 2)]]d6`, type: "weapon" }],
        }),
      ]),
      feature("thieves-cant", t("Thieves' Cant", "盗贼黑话"), t("You know Thieves' Cant and one other language.", "你掌握盗贼黑话及另一门语言。"), [
        ...prof("language", "thieves-cant"),
        { type: "choice", id: "language", name: t("Language", "语言"), count: 1, from: { kind: "proficiency", profKind: "language", keys: "any" } },
      ]),
      masteryChoice(2, [...SIMPLE, ...ROGUE_MARTIAL]),
    ],
    "2": [
      feature("cunning-action", t("Cunning Action", "灵巧动作"), t("Take Dash, Disengage or Hide as a Bonus Action.", "以附赠动作执行疾走、撤离或躲藏。"), [
        action({ id: "cunning-dash", name: t("Cunning Action: Dash", "灵巧动作：疾走"), activation: "bonus", category: "feature" }),
        action({ id: "cunning-disengage", name: t("Cunning Action: Disengage", "灵巧动作：撤离"), activation: "bonus", category: "feature" }),
        action({ id: "cunning-hide", name: t("Cunning Action: Hide", "灵巧动作：躲藏"), activation: "bonus", category: "feature", text: t("Dex (Stealth) DC 15.", "敏捷（隐匿）DC 15。") }),
      ]),
    ],
    "3": [
      subclassChoice("rogue"),
      feature("steady-aim", t("Steady Aim", "稳定瞄准"), t("Bonus Action: Advantage on your next attack this turn if you haven't moved; your Speed becomes 0 until the end of the turn.", "附赠动作：若本回合未移动，下一次攻击具有优势；你的速度变为 0 直到回合结束。"), [
        action({ id: "steady-aim", name: t("Steady Aim", "稳定瞄准"), activation: "bonus", category: "feature", text: t("Advantage on next attack; Speed 0 this turn.", "下一次攻击具有优势；本回合速度为 0。") }),
      ]),
    ],
    "4": [asi()],
    "5": [
      feature("cunning-strike", t("Cunning Strike", "灵巧打击"), t("When you deal Sneak Attack damage, forgo dice for effects: Poison (1d6, Con save or Poisoned), Trip (1d6, Dex save or Prone), Withdraw (1d6, move half Speed without provoking).", "造成偷袭伤害时可放弃部分骰子换取效果：毒伤（1d6，体质豁免否则中毒）、绊摔（1d6，敏捷豁免否则倒地）、撤步（1d6，移动一半速度且不引发借机攻击）。"), [], { tags: ["rider"] }),
      feature("uncanny-dodge", t("Uncanny Dodge", "直觉闪避"), t("Reaction when hit by an attacker you can see: halve the attack's damage.", "被可见攻击者命中时，以反应将该攻击伤害减半。"), [
        action({ id: "uncanny-dodge", name: t("Uncanny Dodge", "直觉闪避"), activation: "reaction", category: "feature", trigger: t("An attacker you can see hits you", "被可见的攻击者命中"), text: t("Halve the damage.", "伤害减半。") }),
      ]),
    ],
    "6": [
      {
        type: "choice",
        id: "expertise-6",
        name: t("Expertise", "专精"),
        text: t("Choose two more of your skill proficiencies to gain Expertise.", "再选择两项已熟练的技能获得专精。"),
        count: 2,
        from: { kind: "proficiency", profKind: "skill", keys: "any", level: "expertise", requireProficient: true },
      },
    ],
    "7": [
      feature("evasion", t("Evasion", "反射闪避"), t("When a Dex save would halve damage, take none on a success and half on a failure (unless Incapacitated).", "进行敏捷豁免以承受一半伤害的效应时，成功则不受伤害，失败只受一半（失能时除外）。"), [tag("evasion")]),
      feature("reliable-talent", t("Reliable Talent", "可靠才能"), t("When you make an ability check using a skill or tool you're proficient in, treat a d20 roll of 9 or lower as a 10.", "使用熟练的技能或工具进行属性检定时，d20 掷出 9 或更低视为 10。"), [tag("reliable-talent")]),
    ],
    "8": [asi("feat-8")],
  },
};

export const thief: Entity = {
  id: "subclass:thief",
  type: "subclass",
  classId: "class:rogue",
  name: t("Thief", "盗贼"),
  summary: t("Burglar, treasure hunter and nimble climber.", "窃贼、寻宝者与敏捷的攀爬者。"),
  tags: ["rogue"],
  levels: {
    "3": [
      feature("fast-hands", t("Fast Hands", "快手"), t("Cunning Action can also make a Sleight of Hand check, use Thieves' Tools, or take the Utilize action.", "灵巧动作还可进行巧手检定、使用盗贼工具或执行使用动作。"), [
        action({ id: "fast-hands", name: t("Fast Hands", "快手"), activation: "bonus", category: "feature", text: t("Sleight of Hand, Thieves' Tools or Utilize.", "巧手、盗贼工具或使用动作。") }),
      ]),
      feature("second-story-work", t("Second-Story Work", "飞檐走壁"), t("You gain a Climb Speed equal to your Speed and can use Dex for jump distance.", "获得等同于速度的攀爬速度，并可用敏捷决定跳跃距离。"), [mod("speed.climb", "@speed.walk", { op: "atLeast", label: t("Second-Story Work", "飞檐走壁") })]),
    ],
  },
};
