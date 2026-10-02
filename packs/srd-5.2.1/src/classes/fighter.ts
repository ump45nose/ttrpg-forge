import type { Entity } from "@forge/core";
import { action, equipmentChoice, feature, featChoice, gold, item, masteryChoice, mod, prof, resource, SHORT_ALL, SHORT_ONE, skillChoice, t, table, tag } from "../helpers";
import { asi, LVL, subclassChoice } from "./common";

/* ───────────────────────── Fighter ───────────────────────── */

export const fighter: Entity = {
  id: "class:fighter",
  type: "class",
  name: t("Fighter", "战士"),
  summary: t("A master of martial combat, skilled with a variety of weapons and armor.", "精通各式武器与护甲的武艺大师。"),
  text: t(
    "Fighters wield every weapon and armor with expertise. Second Wind keeps them standing, Action Surge lets them strike twice as hard, and Weapon Mastery unlocks special tricks with their favourite arms.",
    "战士能熟练运用一切武器与护甲。回气让他们屹立不倒，动作如潮让他们攻势倍增，武器精通则解锁趁手兵器的特殊技巧。",
  ),
  hitDie: 10,
  primaryAbility: ["str", "dex"],
  subclassLevel: 3,
  accent: "#d9632b",
  tags: ["martial"],
  starting: [
    ...prof("save", "str", "con"),
    ...prof("armor", "light", "medium", "heavy", "shield"),
    ...prof("weapon", "simple", "martial"),
    skillChoice(2, ["acrobatics", "animal-handling", "athletics", "history", "insight", "intimidation", "persuasion", "perception", "survival"]),
    equipmentChoice("equipment", [
      { id: "a", name: t("Chain Mail & Greatsword", "链甲与巨剑"), items: [item("chain-mail", 1, true), item("greatsword", 1, true), item("flail"), item("javelin", 8), item("dungeoneers-pack"), gold(4)] },
      { id: "b", name: t("Studded Leather & Bow", "镶钉皮甲与长弓"), items: [item("studded-leather-armor", 1, true), item("scimitar", 1, true), item("shortsword"), item("longbow"), item("arrows", 20), item("quiver"), item("dungeoneers-pack"), gold(11)] },
      { id: "c", name: t("155 GP", "155 金币"), items: [gold(155)] },
    ]),
  ],
  multiclass: [...prof("armor", "light", "medium", "shield"), ...prof("weapon", "martial")],
  levels: {
    "1": [
      featChoice("fighting-style", ["fighting-style"], t("Fighting Style", "战斗风格")),
      feature("second-wind", t("Second Wind", "回气"), t("Bonus Action: regain 1d10 + Fighter level HP. Regain one use on a Short Rest, all on a Long Rest.", "附赠动作：恢复 1d10 + 战士等级的生命值。短休恢复一次使用次数，长休全部恢复。"), [
        resource("second-wind", t("Second Wind", "回气"), table(LVL("fighter"), [2, 2, 2, 3, 3, 3, 3, 3, 3, 4]), SHORT_ONE),
        action({ id: "second-wind", name: t("Second Wind", "回气"), activation: "bonus", category: "feature", cost: [{ resource: "second-wind" }], heal: { dice: `1d10 + ${LVL("fighter")}` } }),
      ]),
      masteryChoice(3, "any"),
    ],
    "2": [
      feature("action-surge", t("Action Surge", "动作如潮"), t("On your turn, take one additional action (not Magic). Once per Short or Long Rest.", "在你的回合额外执行一个动作（魔法动作除外）。每次短休或长休一次。"), [
        resource("action-surge", t("Action Surge", "动作如潮"), 1, SHORT_ALL),
        action({ id: "action-surge", name: t("Action Surge", "动作如潮"), activation: "special", category: "feature", cost: [{ resource: "action-surge" }], text: t("Take one additional action this turn.", "本回合额外执行一个动作。") }),
      ]),
      feature("tactical-mind", t("Tactical Mind", "战术思维"), t("When you fail an ability check, expend a use of Second Wind to add 1d10; if it still fails, the use isn't spent.", "属性检定失败时，可消耗一次回气为该检定加 1d10；若仍失败则不消耗。"), [
        action({ id: "tactical-mind", name: t("Tactical Mind", "战术思维"), activation: "special", category: "feature", cost: [{ resource: "second-wind" }], trigger: t("You fail an ability check", "属性检定失败时"), text: t("Add 1d10 to the check.", "为该检定加 1d10。") }),
      ]),
    ],
    "3": [subclassChoice("fighter")],
    "4": [asi(), masteryChoice(1, "any", "weapon-mastery-4")],
    "5": [
      feature("extra-attack", t("Extra Attack", "额外攻击"), t("Attack twice whenever you take the Attack action.", "执行攻击动作时可攻击两次。"), [tag("extra-attack")], { tags: ["attacks:2"] }),
      feature("tactical-shift", t("Tactical Shift", "战术转移"), t("When you use Second Wind, move up to half your Speed without provoking Opportunity Attacks.", "使用回气时，可移动至多一半速度且不引发借机攻击。")),
    ],
    "6": [asi("feat-6")],
    "8": [asi("feat-8")],
  },
};

export const champion: Entity = {
  id: "subclass:champion",
  type: "subclass",
  classId: "class:fighter",
  name: t("Champion", "勇士"),
  summary: t("Raw physical power honed to deadly perfection.", "将纯粹的肉体力量磨砺至致命的完美。"),
  tags: ["fighter"],
  levels: {
    "3": [
      feature("improved-critical", t("Improved Critical", "精通重击"), t("Your attack rolls with weapons and Unarmed Strikes score a Critical Hit on a 19 or 20.", "武器与徒手打击的攻击检定掷出 19 或 20 即为重击。"), [mod("crit.bonus", 1, { op: "atLeast", label: t("Improved Critical", "精通重击") })]),
      feature("remarkable-athlete", t("Remarkable Athlete", "卓越运动员"), t("Advantage on Initiative and Str (Athletics) checks. After a Critical Hit, move up to half your Speed without provoking Opportunity Attacks.", "先攻与力量（运动）检定具有优势。重击后可移动至多一半速度且不引发借机攻击。"), [
        tag("adv:initiative", t("Remarkable Athlete", "卓越运动员")),
        tag("adv:skill.athletics", t("Remarkable Athlete", "卓越运动员")),
      ]),
    ],
    "7": [featChoice("additional-fighting-style", ["fighting-style"], t("Additional Fighting Style", "额外战斗风格"))],
  },
};
