import type { Entity, Grant } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, LONG_ALL, mod, prof, resource, SHORT_ALL, skillChoice, spellChoice, t, table } from "../helpers";
import { ALL_SKILLS, asi, FULL_CASTER_MAX, INSTRUMENTS, LVL, subclassChoice } from "./common";

/* ───────────────────────── Bard ───────────────────────── */

const L = LVL("bard");
/** Bardic Inspiration die size by Bard level. */
export const BARDIC_DIE = table(L, [6, 6, 6, 6, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 12, 12, 12, 12, 12, 12]);
const BARDIC_ROLL = `1d[[${BARDIC_DIE}]]`;
const USES = "max(1, @ability.cha.mod)";
const BARD_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const cantrips = (id: string, count: number): Grant => spellChoice(id, t("Cantrips", "戏法"), count, "bard", 0, 0);
const inspiration = (recovery = LONG_ALL) => resource("bardic-inspiration", t("Bardic Inspiration", "诗人激励"), USES, recovery);

export const bard: Entity = {
  id: "class:bard",
  type: "class",
  name: t("Bard", "吟游诗人"),
  summary: t("An inspiring performer of music, dance, and magic.", "以音乐、舞蹈与魔法鼓舞人心的表演者。"),
  text: t(
    "Bards weave magic through words and music. Bardic Inspiration bolsters allies, Jack of All Trades rounds out every check, and they prepare spells from the whole bard list.",
    "吟游诗人以言语与音乐编织魔法。诗人激励鼓舞盟友，万事通补足每一项检定，他们可从完整的吟游诗人法术列表中准备法术。",
  ),
  hitDie: 8,
  primaryAbility: ["cha"],
  subclassLevel: 3,
  accent: "#c026d3",
  tags: ["caster"],
  starting: [
    ...prof("save", "dex", "cha"),
    ...prof("armor", "light"),
    ...prof("weapon", "simple"),
    skillChoice(3, "any"),
    {
      type: "choice",
      id: "instruments",
      name: t("Musical Instruments", "乐器"),
      count: 3,
      from: { kind: "proficiency", profKind: "tool", keys: INSTRUMENTS.map((x) => `item:${x}`) },
    },
    equipmentChoice("equipment", [
      { id: "a", name: t("Leather, Daggers & Lute", "皮甲、匕首与鲁特琴"), items: [item("leather-armor", 1, true), item("dagger", 2, true), item("lute"), item("entertainers-pack"), gold(19)] },
      { id: "b", name: t("90 GP", "90 金币"), items: [gold(90)] },
    ]),
  ],
  multiclass: [...prof("armor", "light"), skillChoice(1, "any", "multiclass-skill")],
  levels: {
    "1": [
      feature("bardic-inspiration", t("Bardic Inspiration", "诗人激励"), t("Bonus Action: give a creature within 60 ft a Bardic Inspiration die to add to one failed D20 Test within the next hour. Uses equal your Cha modifier (min 1).", "以附赠动作使 60 尺内一名生物获得诗人激励骰，1 小时内可在一次失败的 D20 检定后掷骰加值。使用次数等于魅力调整值（至少 1）。"), [
        inspiration(),
        action({ id: "bardic-inspiration", name: t("Bardic Inspiration", "诗人激励"), activation: "bonus", category: "feature", cost: [{ resource: "bardic-inspiration" }], range: t("60 ft", "60 尺"), text: t(`Inspiration die: ${BARDIC_ROLL}.`, `激励骰：${BARDIC_ROLL}。`) }),
      ]),
      {
        type: "spellcasting",
        classId: "class:bard",
        ability: "cha",
        progression: "full",
        list: "bard",
        mode: "prepared",
        cantrips: table(L, [2, 2, 2, 3, 3, 3, 3, 3, 3, 4]),
        prepared: table(L, BARD_PREPARED),
      },
      cantrips("cantrips", 2),
    ],
    "2": [
      {
        type: "choice",
        id: "expertise",
        name: t("Expertise", "专精"),
        text: t("Gain Expertise in two skills you are proficient in.", "在你熟练的两项技能中获得专精。"),
        count: 2,
        from: { kind: "proficiency", profKind: "skill", keys: "any", level: "expertise", requireProficient: true },
      },
      feature("jack-of-all-trades", t("Jack of All Trades", "万事通"), t("Add half your Proficiency Bonus (round down) to ability checks that don't already use it.", "未使用熟练加值的属性检定可加上一半熟练加值（向下取整）。"), [
        ...ALL_SKILLS.map((s) => mod(`skill.${s}`, "floor(@prof / 2)", { when: `!@prof.skill.${s}`, label: t("Jack of All Trades", "万事通") })),
        mod("initiative", "floor(@prof / 2)", { label: t("Jack of All Trades", "万事通") }),
      ]),
    ],
    "3": [subclassChoice("bard")],
    "4": [asi(), cantrips("cantrips-4", 1)],
    "5": [
      feature("font-of-inspiration", t("Font of Inspiration", "激励之源"), t("Regain all Bardic Inspiration on a Short or Long Rest, and you can expend a spell slot to regain one use.", "短休或长休后恢复全部诗人激励，并可消耗一个法术位恢复一次使用。"), [inspiration([...SHORT_ALL, ...LONG_ALL])]),
    ],
    "7": [
      feature("countercharm", t("Countercharm", "反迷惑"), t("Reaction when a creature within 30 ft fails a save against Charmed or Frightened: it rerolls with Advantage.", "30 尺内的生物对抗魅惑或恐慌的豁免失败时，以反应令其以优势重骰。"), [
        action({ id: "countercharm", name: t("Countercharm", "反迷惑"), activation: "reaction", category: "feature", range: t("30 ft", "30 尺"), trigger: t("A creature fails a save against Charmed or Frightened", "生物对抗魅惑或恐慌的豁免失败时") }),
      ]),
    ],
    "8": [asi("feat-8")],
  },
};

export const loreCollege: Entity = {
  id: "subclass:college-of-lore",
  type: "subclass",
  classId: "class:bard",
  name: t("College of Lore", "逸闻学院"),
  summary: t("Collectors of secrets who cut foes down with words.", "搜罗秘闻、以言辞挫败敌人的学者。"),
  tags: ["bard"],
  levels: {
    "3": [
      feature("bonus-proficiencies", t("Bonus Proficiencies", "附赠熟练"), t("Gain proficiency in three skills of your choice.", "获得三项自选技能的熟练。"), [skillChoice(3, "any", "bonus-proficiencies")]),
      feature("cutting-words", t("Cutting Words", "语出惊人"), t("Reaction when a creature within 60 ft makes a damage roll or succeeds on an ability check or attack roll: expend Bardic Inspiration and subtract the die from the roll.", "60 尺内生物进行伤害掷骰或在属性检定、攻击检定中成功时，以反应消耗诗人激励，从其结果中减去诗人骰。"), [
        action({ id: "cutting-words", name: t("Cutting Words", "语出惊人"), activation: "reaction", category: "feature", cost: [{ resource: "bardic-inspiration" }], range: t("60 ft", "60 尺"), text: t(`Subtract ${BARDIC_ROLL}.`, `减去 ${BARDIC_ROLL}。`) }),
      ]),
    ],
    "6": [
      feature("magical-discoveries", t("Magical Discoveries", "魔法探秘"), t("Learn two spells from the Cleric, Druid or Wizard lists (cantrips or levels you have slots for). They are always prepared.", "从牧师、德鲁伊或法师法术列表中习得两道法术（戏法或你拥有法术位的环阶），始终准备。"), [
        {
          type: "choice",
          id: "magical-discoveries",
          name: t("Magical Discoveries", "魔法探秘"),
          count: 2,
          from: { kind: "entity", entityType: "spell", anyTags: ["cleric", "druid", "wizard"], minLevel: 0, maxLevel: FULL_CASTER_MAX[5], spell: { alwaysPrepared: true } },
        },
      ]),
    ],
  },
};
