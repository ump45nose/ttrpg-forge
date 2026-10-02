import type { Entity } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, LONG_ALL, masteryChoice, mod, prof, skillChoice, t, table, tag } from "../helpers";
import { asi, LVL, MARTIAL_MELEE, SIMPLE, subclassChoice } from "./common";
import { styleChoice, warriorCantrips } from "./paladin";

/* ───────────────────────── Ranger ───────────────────────── */

const L = LVL("ranger");
const RANGER_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const NOT_HEAVY = "!@armor.heavy";

export const druidicWarrior = warriorCantrips("druidic-warrior", "Druidic Warrior", "德鲁伊教战士", "ranger", "druid", "wis", "Learn two Druid cantrips; they count as Ranger spells and use Wisdom.", "习得两道德鲁伊戏法，视为游侠法术，以感知施法。");

export const ranger: Entity = {
  id: "class:ranger",
  type: "class",
  name: t("Ranger", "游侠"),
  summary: t("A wandering warrior imbued with primal magic.", "身怀原初魔法的荒野游猎战士。"),
  text: t(
    "Rangers hunt with blade, bow and nature magic. Hunter's Mark is always ready, and they range across any terrain with Expertise and extra Speed.",
    "游侠以刀剑、弓矢与自然魔法狩猎。猎人印记随时可用，专精与额外速度让他们驰骋于任何地形。",
  ),
  hitDie: 10,
  primaryAbility: ["dex", "wis"],
  subclassLevel: 3,
  accent: "#15803d",
  tags: ["martial", "caster"],
  starting: [
    ...prof("save", "str", "dex"),
    ...prof("armor", "light", "medium", "shield"),
    ...prof("weapon", "simple", "martial"),
    skillChoice(3, ["animal-handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"]),
    equipmentChoice("equipment", [
      { id: "a", name: t("Studded Leather, Blades & Longbow", "镶钉皮甲、刀剑与长弓"), items: [item("studded-leather-armor", 1, true), item("scimitar", 1, true), item("shortsword"), item("longbow"), item("arrows", 20), item("quiver"), item("druidic-focus"), item("explorers-pack"), gold(7)] },
      { id: "b", name: t("150 GP", "150 金币"), items: [gold(150)] },
    ]),
  ],
  multiclass: [...prof("armor", "light", "medium", "shield"), ...prof("weapon", "martial"), skillChoice(1, ["animal-handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"], "multiclass-skill")],
  levels: {
    "1": [
      {
        type: "spellcasting",
        classId: "class:ranger",
        ability: "wis",
        progression: "half",
        list: "ranger",
        mode: "prepared",
        prepared: table(L, RANGER_PREPARED),
      },
      feature("favored-enemy", t("Favored Enemy", "宿敌"), t("Hunter's Mark is always prepared, and you can cast it without a spell slot a number of times per Long Rest (2, rising with level).", "始终准备着猎人印记，并可每次长休无需法术位地施展若干次（起始 2 次，随等级提升）。"), [
        { type: "spell", spell: "spell:hunters-mark", alwaysPrepared: true, free: { max: table(L, [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]), recovery: LONG_ALL } },
      ]),
      masteryChoice(2, [...SIMPLE, ...MARTIAL_MELEE, "item:longbow", "item:hand-crossbow", "item:heavy-crossbow"]),
    ],
    "2": [
      feature("deft-explorer", t("Deft Explorer", "熟练探险家"), t("Gain Expertise in one skill you're proficient in, and learn two languages.", "在一项你熟练的技能上获得专精，并习得两门语言。"), [
        { type: "choice", id: "expertise", name: t("Expertise", "专精"), count: 1, from: { kind: "proficiency", profKind: "skill", keys: "any", level: "expertise", requireProficient: true } },
        { type: "choice", id: "languages", name: t("Languages", "语言"), count: 2, from: { kind: "proficiency", profKind: "language", keys: "any" } },
      ]),
      styleChoice("druidic-warrior"),
    ],
    "3": [subclassChoice("ranger")],
    "4": [asi()],
    "5": [feature("extra-attack", t("Extra Attack", "额外攻击"), t("Attack twice whenever you take the Attack action.", "执行攻击动作时可攻击两次。"), [tag("extra-attack")], { tags: ["attacks:2"] })],
    "6": [
      feature("roving", t("Roving", "越野"), t("While not wearing Heavy armor, your Speed increases by 10 ft, and you have Climb and Swim Speeds equal to your Speed.", "未着重甲时速度 +10 尺，并获得等同于速度的攀爬速度与游泳速度。"), [
        mod("speed.walk", 10, { when: NOT_HEAVY, label: t("Roving", "越野") }),
        mod("speed.climb", "@speed.walk", { op: "atLeast", when: NOT_HEAVY, label: t("Roving", "越野") }),
        mod("speed.swim", "@speed.walk", { op: "atLeast", when: NOT_HEAVY, label: t("Roving", "越野") }),
      ]),
    ],
    "8": [asi("feat-8")],
  },
};

export const hunter: Entity = {
  id: "subclass:hunter",
  type: "subclass",
  classId: "class:ranger",
  name: t("Hunter", "猎人"),
  summary: t("Protect nature and people from destruction.", "守护自然与人民免遭毁灭。"),
  tags: ["ranger"],
  levels: {
    "3": [
      feature("hunters-lore", t("Hunter's Lore", "猎人学识"), t("While a creature is marked by your Hunter's Mark, you know its Immunities, Resistances and Vulnerabilities.", "被你的猎人印记标记的生物，你知晓它的免疫、抗性与易伤。")),
      feature("hunters-prey", t("Hunter's Prey", "猎杀技艺"), t("Choose Colossus Slayer or Horde Breaker; you can swap after a Short or Long Rest.", "选择巨像屠夫或灭族者；短休或长休后可替换。"), [
        {
          type: "choice",
          id: "hunters-prey-choice",
          name: t("Hunter's Prey", "猎杀技艺"),
          count: 1,
          from: {
            kind: "options",
            options: [
              {
                id: "colossus-slayer",
                name: t("Colossus Slayer", "巨像屠夫"),
                text: t("Once per turn, +1d8 damage on a weapon hit against a creature missing any HP.", "每回合一次，武器命中生命值不满的生物时额外 1d8 伤害。"),
                grants: [action({ id: "colossus-slayer", name: t("Colossus Slayer", "巨像屠夫"), activation: "special", category: "feature", tags: ["rider", "once-per-turn"], trigger: t("Weapon hit on a creature below its HP maximum", "武器命中生命值不满的生物"), damage: [{ dice: "1d8", type: "weapon" }] })],
              },
              {
                id: "horde-breaker",
                name: t("Horde Breaker", "灭族者"),
                text: t("Once per turn, make another attack with the same weapon against a different creature within 5 ft of the target.", "每回合一次，可用同一武器攻击目标 5 尺内的另一生物。"),
                grants: [action({ id: "horde-breaker", name: t("Horde Breaker", "灭族者"), activation: "special", category: "feature", tags: ["once-per-turn"], trigger: t("You attack with a weapon", "你以武器攻击时") })],
              },
            ],
          },
        },
      ]),
    ],
    "7": [
      feature("defensive-tactics", t("Defensive Tactics", "防守战术"), t("Choose Escape the Horde or Multiattack Defense; you can swap after a Short or Long Rest.", "选择冲出重围或多重防御；短休或长休后可替换。"), [
        {
          type: "choice",
          id: "defensive-tactics-choice",
          name: t("Defensive Tactics", "防守战术"),
          count: 1,
          from: {
            kind: "options",
            options: [
              { id: "escape-the-horde", name: t("Escape the Horde", "冲出重围"), text: t("Opportunity Attacks against you have Disadvantage.", "对你的借机攻击具有劣势。"), grants: [tag("escape-the-horde")] },
              { id: "multiattack-defense", name: t("Multiattack Defense", "多重防御"), text: t("After a creature hits you, its other attacks against you this turn have Disadvantage.", "生物命中你后，本回合它对你的其他攻击具有劣势。"), grants: [tag("multiattack-defense")] },
            ],
          },
        },
      ]),
    ],
  },
};
