import type { Entity, Grant } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, LONG_ALL, mod, prof, resource, SHORT_ONE, skillChoice, spellChoice, t, table, tag } from "../helpers";
import { alwaysPrepared, asi, furyChoice, LVL, subclassChoice } from "./common";

/* ───────────────────────── Druid ───────────────────────── */

const L = LVL("druid");
const DRUID_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const DC = "@spell.druid.dc";
const cantrips = (id: string, count: number): Grant => spellChoice(id, t("Cantrips", "戏法"), count, "druid", 0, 0);

export const druid: Entity = {
  id: "class:druid",
  type: "class",
  name: t("Druid", "德鲁伊"),
  summary: t("A nature priest of primal power.", "掌握原初之力的自然祭司。"),
  text: t(
    "Druids call on nature's magic, preparing spells from the whole druid list. Wild Shape lets them take the forms of beasts, and their Primal Order makes them a spellcaster or a warden.",
    "德鲁伊召唤自然的魔法，从完整的德鲁伊法术列表中准备法术。荒野变形让他们化身野兽，原初职能则决定他们偏重施法或守护。",
  ),
  hitDie: 8,
  primaryAbility: ["wis"],
  subclassLevel: 3,
  accent: "#4d7c0f",
  tags: ["caster"],
  starting: [
    ...prof("save", "int", "wis"),
    ...prof("armor", "light", "shield"),
    ...prof("weapon", "simple"),
    ...prof("tool", "item:herbalism-kit"),
    skillChoice(2, ["arcana", "animal-handling", "insight", "medicine", "nature", "perception", "religion", "survival"]),
    equipmentChoice("equipment", [
      { id: "a", name: t("Leather, Shield & Sickle", "皮甲、盾牌与镰刀"), items: [item("leather-armor", 1, true), item("shield", 1, true), item("sickle", 1, true), item("druidic-focus"), item("explorers-pack"), item("herbalism-kit"), gold(9)] },
      { id: "b", name: t("50 GP", "50 金币"), items: [gold(50)] },
    ]),
  ],
  multiclass: [],
  levels: {
    "1": [
      {
        type: "spellcasting",
        classId: "class:druid",
        ability: "wis",
        progression: "full",
        list: "druid",
        mode: "prepared",
        cantrips: `${table(L, [2, 2, 2, 3, 3, 3, 3, 3, 3, 4])} + @tag.magician`,
        prepared: table(L, DRUID_PREPARED),
      },
      cantrips("cantrips", 2),
      feature("druidic", t("Druidic", "德鲁伊语"), t("You know Druidic, the secret language of druids, and always have Speak with Animals prepared.", "你掌握德鲁伊的秘密语言德鲁伊语，并始终准备着动物交谈。"), [
        ...prof("language", "druidic"),
        ...alwaysPrepared(undefined, "speak-with-animals"),
      ]),
      {
        type: "choice",
        id: "primal-order",
        name: t("Primal Order", "原初职能"),
        count: 1,
        from: {
          kind: "options",
          options: [
            {
              id: "magician",
              name: t("Magician", "术师"),
              text: t("One extra cantrip, and add your Wis modifier (min +1) to Int (Arcana or Nature) checks.", "额外一道戏法，并在智力（奥秘或自然）检定中加上感知调整值（至少 +1）。"),
              grants: [
                tag("magician"),
                cantrips("cantrip", 1),
                mod("skill.arcana", "max(1, @ability.wis.mod)", { label: t("Magician", "术师") }),
                mod("skill.nature", "max(1, @ability.wis.mod)", { label: t("Magician", "术师") }),
              ],
            },
            {
              id: "warden",
              name: t("Warden", "卫士"),
              text: t("Trained for battle: Martial weapons and Medium armor.", "受过战斗训练：军用武器与中甲熟练。"),
              grants: [...prof("weapon", "martial"), ...prof("armor", "medium")],
            },
          ],
        },
      },
    ],
    "2": [
      feature("wild-shape", t("Wild Shape", "荒野变形"), t("Bonus Action: shape-shift into a Beast form you know for hours equal to half your Druid level. Max CR 1/4 (level 2), 1/2 (level 4), 1 with Fly Speed (level 8). Regain one use on a Short Rest, all on a Long Rest.", "以附赠动作变为你已知的野兽形态，持续德鲁伊等级一半的小时数。最大挑战等级：2 级 1/4，4 级 1/2，8 级 1 且可具飞行速度。短休恢复一次，长休全部恢复。"), [
        resource("wild-shape", t("Wild Shape", "荒野变形"), table(L, [0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]), SHORT_ONE),
        action({
          id: "wild-shape",
          name: t("Wild Shape", "荒野变形"),
          activation: "bonus",
          category: "feature",
          cost: [{ resource: "wild-shape" }],
          text: t(`Known forms: [[${table(L, [0, 4, 4, 6, 6, 6, 6, 8])}]]. Gain Temporary HP equal to your Druid level.`, `已知形态：[[${table(L, [0, 4, 4, 6, 6, 6, 6, 8])}]] 种。获得等同于德鲁伊等级的临时生命值。`),
        }),
      ]),
      feature("wild-companion", t("Wild Companion", "荒野伙伴"), t("Magic action: expend a spell slot or a use of Wild Shape to cast Find Familiar without Material components. The familiar is a Fey and vanishes on a Long Rest.", "以魔法动作消耗一个法术位或一次荒野变形，无需材料成分地施展寻获魔宠。魔宠为妖精，长休时消失。"), [
        action({ id: "wild-companion", name: t("Wild Companion", "荒野伙伴"), activation: "action", category: "feature", cost: [{ resource: "wild-shape" }], text: t("Or expend a spell slot instead.", "也可改为消耗一个法术位。") }),
      ]),
    ],
    "3": [subclassChoice("druid")],
    "4": [asi(), cantrips("cantrips-4", 1)],
    "5": [
      feature("wild-resurgence", t("Wild Resurgence", "荒野复苏"), t("Once per turn with no Wild Shape uses left, expend a spell slot to regain one. Once per Long Rest, expend a Wild Shape use to gain a level 1 spell slot.", "每回合一次，若没有荒野变形次数，可消耗一个法术位恢复一次。每次长休一次，可消耗一次荒野变形获得一个一环法术位。"), [
        resource("wild-resurgence", t("Wild Resurgence (slot)", "荒野复苏（法术位）"), 1, LONG_ALL),
      ]),
    ],
    "7": [
      feature("elemental-fury", t("Elemental Fury", "元素之怒"), t("Choose Potent Spellcasting (add Wis to Druid cantrip damage) or Primal Strike (once per turn, +1d8 Cold, Fire, Lightning or Thunder damage on a weapon or Wild Shape hit).", "选择强力施法（德鲁伊戏法伤害加感知调整值）或原力蛮击（每回合一次，武器或野兽形态攻击命中时额外 1d8 寒冷/火焰/闪电/雷鸣伤害）。"), [
        furyChoice("elemental-fury-choice", t("Elemental Fury", "元素之怒"), "druid", { id: "primal-strike", en: "Primal Strike", zh: "原力蛮击", dice: "1d8", type: "chosen", textEn: "Once per turn, +1d8 Cold, Fire, Lightning or Thunder damage on a weapon or beast-form hit.", textZh: "每回合一次，武器或野兽形态攻击命中时额外造成 1d8 寒冷/火焰/闪电/雷鸣伤害。" }),
      ]),
    ],
    "8": [asi("feat-8")],
  },
};

/* ── Circle of the Land ── */

const LANDS: { id: string; en: string; zh: string; spells: [number, string[]][] }[] = [
  { id: "arid", en: "Arid Land", zh: "荒漠", spells: [[3, ["blur", "burning-hands", "fire-bolt"]], [5, ["fireball"]], [7, ["blight"]]] },
  { id: "polar", en: "Polar Land", zh: "极地", spells: [[3, ["fog-cloud", "hold-person", "ray-of-frost"]], [5, ["sleet-storm"]], [7, ["ice-storm"]]] },
  { id: "temperate", en: "Temperate Land", zh: "温带", spells: [[3, ["misty-step", "shocking-grasp", "sleep"]], [5, ["lightning-bolt"]], [7, ["freedom-of-movement"]]] },
  { id: "tropical", en: "Tropical Land", zh: "热带", spells: [[3, ["acid-splash", "ray-of-sickness", "web"]], [5, ["stinking-cloud"]], [7, ["polymorph"]]] },
];

export const landCircle: Entity = {
  id: "subclass:circle-of-the-land",
  type: "subclass",
  classId: "class:druid",
  name: t("Circle of the Land", "大地结社"),
  summary: t("Mystics whose magic is drawn from the land they call home.", "从所栖之地汲取魔力的神秘主义者。"),
  tags: ["druid"],
  levels: {
    "3": [
      feature("circle-of-the-land-spells", t("Circle of the Land Spells", "大地结社法术"), t("After each Long Rest choose a land type; its spells are always prepared as you reach the listed Druid levels.", "每次长休后选择一种地形；达到对应德鲁伊等级时始终准备该地形的法术。"), [
        {
          type: "choice",
          id: "land",
          name: t("Land", "地形"),
          count: 1,
          from: {
            kind: "options",
            options: LANDS.map((l) => ({
              id: l.id,
              name: t(l.en, l.zh),
              grants: l.spells.flatMap(([lv, ids]) => alwaysPrepared(lv > 3 ? lv : undefined, ...ids)),
            })),
          },
        },
      ]),
      feature("lands-aid", t("Land's Aid", "大地之援"), t("Magic action, expend a Wild Shape use: a 10-ft-radius Sphere within 60 ft. Chosen creatures make a Con save or take Necrotic damage (half on success); one creature regains the same dice in HP.", "以魔法动作消耗一次荒野变形：60 尺内 10 尺半径球形。所选生物进行体质豁免，失败受黯蚀伤害（成功减半）；一名生物恢复同等骰数的生命值。"), [
        action({
          id: "lands-aid",
          name: t("Land's Aid", "大地之援"),
          activation: "action",
          category: "feature",
          cost: [{ resource: "wild-shape" }],
          range: t("60 ft", "60 尺"),
          save: { ability: "con", dc: DC, onSave: "half" },
          damage: [{ dice: `[[${table(L, [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4])}]]d6`, type: "necrotic" }],
          heal: { dice: `[[${table(L, [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4])}]]d6` },
        }),
      ]),
    ],
    "6": [
      feature("natural-recovery", t("Natural Recovery", "自然恢复"), t("Once per Long Rest, cast a level 1+ Circle spell without a slot. Once per Long Rest after a Short Rest, recover slots totalling up to half your Druid level (round up), none level 6+.", "每次长休一次，可无需法术位施展一道一环及以上的结社法术。每次长休一次，短休后可恢复总环阶不超过德鲁伊等级一半（向上取整）的法术位，单个不高于五环。"), [
        resource("natural-recovery", t("Natural Recovery", "自然恢复"), 1, LONG_ALL),
        action({ id: "natural-recovery", name: t("Natural Recovery", "自然恢复"), activation: "special", category: "feature", cost: [{ resource: "natural-recovery" }], text: t(`Recover slots totalling up to [[ceil(${L} / 2)]] levels.`, `恢复总环阶至多 [[ceil(${L} / 2)]] 的法术位。`) }),
      ]),
    ],
  },
};
