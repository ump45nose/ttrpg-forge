import type { Entity } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, LONG_ALL, prof, resource, skillChoice, spellChoice, t, table, tag } from "../helpers";
import { asi, LVL, subclassChoice } from "./common";

/* ───────────────────────── Wizard ───────────────────────── */

const WIZARD_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25];
const book = (id: string, count: number, maxLevel: number) => spellChoice(id, t("Spellbook", "法术书"), count, "wizard", 1, maxLevel);

export const wizard: Entity = {
  id: "class:wizard",
  type: "class",
  name: t("Wizard", "法师"),
  summary: t("A scholarly magic-user of arcane power.", "钻研奥术伟力的博学施法者。"),
  text: t(
    "Wizards record spells in a spellbook and prepare a selection each day. Arcane Recovery restores slots during a Short Rest, and their spell list is the broadest of all.",
    "法师将法术记录在法术书中，每天从中准备一部分。奥术回想能在短休时恢复法术位，他们的法术列表也是最广博的。",
  ),
  hitDie: 6,
  primaryAbility: ["int"],
  subclassLevel: 3,
  accent: "#7b6cf6",
  tags: ["caster"],
  starting: [
    ...prof("save", "int", "wis"),
    ...prof("weapon", "simple"),
    skillChoice(2, ["arcana", "history", "insight", "investigation", "medicine", "nature", "religion"]),
    equipmentChoice("equipment", [
      { id: "a", name: t("Staff & Spellbook", "长棍与法术书"), items: [item("dagger", 2), item("quarterstaff", 1, true), item("robe"), item("spellbook"), item("scholars-pack"), gold(5)] },
      { id: "b", name: t("55 GP", "55 金币"), items: [gold(55)] },
    ]),
  ],
  multiclass: [],
  levels: {
    "1": [
      {
        type: "spellcasting",
        classId: "class:wizard",
        ability: "int",
        progression: "full",
        list: "wizard",
        mode: "spellbook",
        cantrips: table(LVL("wizard"), [3, 3, 3, 4, 4, 4, 4, 4, 4, 5]),
        prepared: table(LVL("wizard"), WIZARD_PREPARED),
      },
      spellChoice("cantrips", t("Cantrips", "戏法"), 3, "wizard", 0, 0),
      book("spellbook", 6, 1),
      feature("ritual-adept", t("Ritual Adept", "仪式专家"), t("Cast any Ritual spell in your spellbook as a Ritual without preparing it.", "可将法术书中的任意仪式法术以仪式施放，无需准备。")),
      feature("arcane-recovery", t("Arcane Recovery", "奥术回想"), t("Once per day after a Short Rest, recover expended slots with a combined level up to half your Wizard level (round up), none above 5th.", "每天一次，短休后恢复总环阶不超过法师等级一半（向上取整）的法术位，单个不超过 5 环。"), [
        resource("arcane-recovery", t("Arcane Recovery", "奥术回想"), 1, LONG_ALL),
        action({ id: "arcane-recovery", name: t("Arcane Recovery", "奥术回想"), activation: "special", category: "feature", cost: [{ resource: "arcane-recovery" }], text: t(`Recover slots totalling up to half your Wizard level (round up).`, "恢复总环阶不超过法师等级一半的法术位。") }),
      ]),
    ],
    "2": [
      {
        type: "choice",
        id: "scholar",
        name: t("Scholar", "学者"),
        text: t("Gain Expertise in one of Arcana, History, Investigation, Medicine, Nature or Religion you are proficient in.", "在你熟练的奥秘、历史、调查、医药、自然或宗教中选择一项获得专精。"),
        count: 1,
        from: { kind: "proficiency", profKind: "skill", keys: ["arcana", "history", "investigation", "medicine", "nature", "religion"], level: "expertise", requireProficient: true },
      },
      book("spellbook", 2, 1),
    ],
    "3": [subclassChoice("wizard"), book("spellbook", 2, 2)],
    "4": [asi(), spellChoice("cantrips-4", t("Cantrip", "戏法"), 1, "wizard", 0, 0), book("spellbook", 2, 2)],
    "5": [
      feature("memorize-spell", t("Memorize Spell", "法术默记"), t("After a Short Rest, swap one prepared spell for another in your spellbook.", "短休后可将一道已准备法术替换为法术书中的另一道。")),
      book("spellbook", 2, 3),
    ],
    "6": [book("spellbook", 2, 3)],
    "7": [book("spellbook", 2, 4)],
    "8": [asi("feat-8"), book("spellbook", 2, 4)],
  },
};

export const evoker: Entity = {
  id: "subclass:evoker",
  type: "subclass",
  classId: "class:wizard",
  name: t("Evoker", "塑能师"),
  summary: t("Shapers of raw elemental force.", "塑造原始元素之力的施法者。"),
  tags: ["wizard"],
  levels: {
    "3": [
      feature("evocation-savant", t("Evocation Savant", "塑能学者"), t("Add two Evocation spells (up to 2nd level) to your spellbook for free, and one more whenever you gain a new level of slots.", "免费将两道塑能法术（至多 2 环）加入法术书，此后每获得新的法术位环阶再加一道。"), [
        spellChoice("savant", t("Evocation Savant", "塑能学者"), 2, "wizard", 1, 2, ["evocation"]),
      ]),
      feature("potent-cantrip", t("Potent Cantrip", "强效戏法"), t("When a damaging cantrip misses or the target succeeds on its save, the target still takes half damage.", "伤害戏法未命中或目标豁免成功时，目标仍受到一半伤害。"), [tag("potent-cantrip")]),
    ],
    "5": [spellChoice("savant-5", t("Evocation Savant", "塑能学者"), 1, "wizard", 1, 3, ["evocation"])],
    "6": [
      feature("sculpt-spells", t("Sculpt Spells", "法术塑形"), t("When you cast an Evocation spell affecting others you can see, choose 1 + the spell's level of them: they succeed on its saves and take no damage on a success.", "施展会影响可见他人的塑能法术时，可指定 1 + 法术环阶数量的生物：它们自动通过豁免，成功时不受伤害。"), [tag("sculpt-spells")]),
    ],
    "7": [spellChoice("savant-7", t("Evocation Savant", "塑能学者"), 1, "wizard", 1, 4, ["evocation"])],
  },
};
