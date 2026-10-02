import type { Entity, Grant } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, LONG_ALL, mod, prof, resource, skillChoice, spellChoice, t, table, tag } from "../helpers";
import { alwaysPrepared, asi, FULL_CASTER_MAX, LVL, subclassChoice } from "./common";

/* ───────────────────────── Sorcerer ───────────────────────── */

const L = LVL("sorcerer");
const SORCERER_PREPARED = [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const spells = (id: string, level: number, count: number): Grant => spellChoice(id, t("Sorcerer Spells", "术士法术"), count, "sorcerer", 1, FULL_CASTER_MAX[level - 1]!);
const cantrips = (id: string, count: number): Grant => spellChoice(id, t("Cantrips", "戏法"), count, "sorcerer", 0, 0);

/** Metamagic options: [id, en, zh, cost, text en, text zh]. */
const METAMAGIC: [string, string, string, number, string, string][] = [
  ["careful-spell", "Careful Spell", "谨慎法术", 1, "Up to Cha modifier creatures automatically succeed on the spell's save and take no damage on a success.", "至多魅力调整值数量的生物自动通过该法术的豁免，成功时不受伤害。"],
  ["distant-spell", "Distant Spell", "远程法术", 1, "Double a range of 5 ft or more, or make a Touch range 30 ft.", "射程至少 5 尺的法术射程翻倍，触及法术射程变为 30 尺。"],
  ["empowered-spell", "Empowered Spell", "强效法术", 1, "Reroll up to Cha modifier damage dice. Can combine with another Metamagic.", "重骰至多魅力调整值数量的伤害骰，可与其他超魔法同时使用。"],
  ["extended-spell", "Extended Spell", "延效法术", 1, "Double a duration of 1 minute or more (max 24 hours); Advantage on Concentration saves for it.", "持续 1 分钟以上的法术持续时间翻倍（至多 24 小时），维持其专注的豁免具有优势。"],
  ["heightened-spell", "Heightened Spell", "升阶法术", 2, "One target has Disadvantage on its saves against the spell.", "一名目标对该法术的豁免具有劣势。"],
  ["quickened-spell", "Quickened Spell", "瞬发法术", 2, "Change a casting time of an action to a Bonus Action (not if you already cast a level 1+ spell this turn).", "将施法时间为动作的法术改为附赠动作（本回合已施展过一环以上法术时不可用）。"],
  ["seeking-spell", "Seeking Spell", "追踪法术", 1, "Reroll a missed spell attack. Can combine with another Metamagic.", "法术攻击未命中时重骰 d20，可与其他超魔法同时使用。"],
  ["subtle-spell", "Subtle Spell", "精妙法术", 1, "Cast without Verbal, Somatic, or non-consumed Material components.", "施法无需言语、姿势及不被消耗的材料成分。"],
  ["transmuted-spell", "Transmuted Spell", "转化法术", 1, "Change Acid, Cold, Fire, Lightning, Poison or Thunder damage to another of those types.", "将强酸、寒冷、火焰、闪电、毒素或雷鸣伤害改为其中另一种。"],
  ["twinned-spell", "Twinned Spell", "孪生法术", 1, "Increase the spell's effective level by 1 to add one more target, if upcasting would.", "若升环会增加目标，则视作提升一环以增加一名目标。"],
];

export const sorcerer: Entity = {
  id: "class:sorcerer",
  type: "class",
  name: t("Sorcerer", "术士"),
  summary: t("A dazzling mage filled with innate magic.", "体内蕴藏先天魔法的耀眼施法者。"),
  text: t(
    "Sorcerers wield magic born in their blood. Innate Sorcery sharpens their spells, and Sorcery Points fuel Metamagic that bends spells to their will.",
    "术士驾驭与生俱来的魔法。先天术法强化他们的法术，术法点则驱动超魔法，随心所欲地改变法术。",
  ),
  hitDie: 6,
  primaryAbility: ["cha"],
  subclassLevel: 3,
  accent: "#dc2626",
  tags: ["caster"],
  starting: [
    ...prof("save", "con", "cha"),
    ...prof("weapon", "simple"),
    skillChoice(2, ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"]),
    equipmentChoice("equipment", [
      { id: "a", name: t("Spear, Daggers & Focus", "矛、匕首与法器"), items: [item("spear", 1, true), item("dagger", 2), item("arcane-focus"), item("dungeoneers-pack"), gold(28)] },
      { id: "b", name: t("50 GP", "50 金币"), items: [gold(50)] },
    ]),
  ],
  multiclass: [],
  levels: {
    "1": [
      {
        type: "spellcasting",
        classId: "class:sorcerer",
        ability: "cha",
        progression: "full",
        list: "sorcerer",
        mode: "known",
        cantrips: table(L, [4, 4, 4, 5, 5, 5, 5, 5, 5, 6]),
        prepared: table(L, SORCERER_PREPARED),
      },
      cantrips("cantrips", 4),
      spells("spells", 1, 2),
      feature("innate-sorcery", t("Innate Sorcery", "先天术法"), t("Bonus Action, twice per Long Rest: for 1 minute your Sorcerer spell save DC increases by 1 and you have Advantage on Sorcerer spell attack rolls.", "每次长休两次，以附赠动作激发，持续 1 分钟：术士法术豁免 DC +1，术士法术攻击检定具有优势。"), [
        resource("innate-sorcery", t("Innate Sorcery", "先天术法"), 2, LONG_ALL),
        action({ id: "innate-sorcery", name: t("Innate Sorcery", "先天术法"), activation: "bonus", category: "feature", cost: [{ resource: "innate-sorcery" }], applies: [{ effect: "effect:innate-sorcery", target: "self", duration: { minutes: 1 } }] }),
      ]),
    ],
    "2": [
      feature("font-of-magic", t("Font of Magic", "魔力泉涌"), t("Sorcery Points equal to your Sorcerer level, regained on a Long Rest. Convert a spell slot into points equal to its level, or spend points to create a slot as a Bonus Action (level 1: 2, 2: 3, 3: 5, 4: 6, 5: 7).", "拥有等于术士等级的术法点，长休恢复。可将法术位转化为等同其环阶的术法点，或以附赠动作消耗术法点创造法术位（一环 2、二环 3、三环 5、四环 6、五环 7）。"), [
        resource("sorcery-points", t("Sorcery Points", "术法点"), `max(0, ${L})`, LONG_ALL),
        action({ id: "create-spell-slot", name: t("Create Spell Slot", "创造法术位"), activation: "bonus", category: "feature", text: t("Spend 2/3/5/6/7 Sorcery Points for a level 1/2/3/4/5 slot.", "消耗 2/3/5/6/7 术法点创造一/二/三/四/五环法术位。") }),
      ]),
      feature("metamagic", t("Metamagic", "超魔法"), t("Choose two Metamagic options. You can apply one per spell by spending Sorcery Points; swap one whenever you gain a level.", "选择两个超魔法选项。施法时可消耗术法点为该法术应用一个；每次升级可替换一个。"), [
        {
          type: "choice",
          id: "metamagic-options",
          name: t("Metamagic Options", "超魔法选项"),
          count: 2,
          from: {
            kind: "options",
            options: METAMAGIC.map(([id, en, zh, cost, ten, tzh]) => ({
              id,
              name: t(en, zh),
              text: t(`${cost} SP. ${ten}`, `${cost} 术法点。${tzh}`),
              grants: [action({ id, name: t(en, zh), activation: "special", category: "feature", cost: [{ resource: "sorcery-points", amount: cost }], text: t(ten, tzh) })],
            })),
          },
        },
      ]),
      spells("spells-2", 2, 2),
    ],
    "3": [subclassChoice("sorcerer"), spells("spells-3", 3, 2)],
    "4": [asi(), cantrips("cantrips-4", 1), spells("spells-4", 4, 1)],
    "5": [
      feature("sorcerous-restoration", t("Sorcerous Restoration", "术法复苏"), t("Once per Long Rest, when you finish a Short Rest, regain Sorcery Points up to half your Sorcerer level (round down).", "每次长休一次，短休结束时恢复至多术士等级一半（向下取整）的术法点。"), [
        resource("sorcerous-restoration", t("Sorcerous Restoration", "术法复苏"), 1, LONG_ALL),
        action({ id: "sorcerous-restoration", name: t("Sorcerous Restoration", "术法复苏"), activation: "special", category: "feature", cost: [{ resource: "sorcerous-restoration" }], text: t(`Regain up to [[floor(${L} / 2)]] Sorcery Points.`, `恢复至多 [[floor(${L} / 2)]] 术法点。`) }),
      ]),
      spells("spells-5", 5, 2),
    ],
    "6": [spells("spells-6", 6, 1)],
    "7": [
      feature("sorcery-incarnate", t("Sorcery Incarnate", "术法化身"), t("With no Innate Sorcery uses left, spend 2 Sorcery Points to activate it. While it's active, apply up to two Metamagic options to each spell.", "先天术法次数耗尽时，可消耗 2 术法点激活。先天术法激活期间，每道法术可应用至多两个超魔法选项。"), [
        action({ id: "sorcery-incarnate", name: t("Innate Sorcery (2 SP)", "先天术法（2 术法点）"), activation: "bonus", category: "feature", cost: [{ resource: "sorcery-points", amount: 2 }], applies: [{ effect: "effect:innate-sorcery", target: "self", duration: { minutes: 1 } }] }),
      ]),
      spells("spells-7", 7, 1),
    ],
    "8": [asi("feat-8"), spells("spells-8", 8, 1)],
  },
};

/* ── Draconic Sorcery ── */

const DRAGON_TYPES: [string, string][] = [
  ["acid", "强酸"],
  ["cold", "寒冷"],
  ["fire", "火焰"],
  ["lightning", "闪电"],
  ["poison", "毒素"],
];

export const draconicSorcery: Entity = {
  id: "subclass:draconic-sorcery",
  type: "subclass",
  classId: "class:sorcerer",
  name: t("Draconic Sorcery", "龙族术法"),
  summary: t("Breathe the magic of dragons.", "吐息龙族的魔法。"),
  tags: ["sorcerer"],
  levels: {
    "3": [
      feature("draconic-resilience", t("Draconic Resilience", "龙族体魄"), t("Your HP maximum increases by your Sorcerer level. While not wearing armor, your base AC is 10 + Dex + Cha.", "生命值上限增加等同于术士等级的数值。未着装护甲时，基础 AC 为 10 + 敏捷 + 魅力。"), [
        mod("hp.max", L, { label: t("Draconic Resilience", "龙族体魄") }),
        mod("ac", "10 + @ability.dex.mod + @ability.cha.mod", { op: "base", when: "!@equipped.armor", label: t("Draconic Resilience", "龙族体魄") }),
      ]),
      feature("draconic-spells", t("Draconic Spells", "龙族法术"), t("Always prepared: Alter Self, Chromatic Orb, Command, Dragon's Breath; Fear and Fly at 5; Arcane Eye and Charm Monster at 7.", "始终准备：变身术、繁彩球、命令术、龙息术；5 级恐惧术、飞行术；7 级秘法眼、魅惑怪物。"), [
        ...alwaysPrepared(undefined, "alter-self", "chromatic-orb", "command", "dragons-breath"),
        ...alwaysPrepared(5, "fear", "fly"),
        ...alwaysPrepared(7, "arcane-eye", "charm-monster"),
      ]),
    ],
    "6": [
      feature("elemental-affinity", t("Elemental Affinity", "元素亲和"), t("Choose Acid, Cold, Fire, Lightning or Poison: you have Resistance to it, and add your Cha modifier to one damage roll of spells that deal it.", "选择强酸、寒冷、火焰、闪电或毒素：获得该伤害抗性，并在造成该伤害的法术的一次伤害掷骰中加上魅力调整值。"), [
        {
          type: "choice",
          id: "elemental-affinity-type",
          name: t("Damage Type", "伤害类型"),
          count: 1,
          from: {
            kind: "options",
            options: DRAGON_TYPES.map(([id, zh]) => ({ id, name: t(id[0]!.toUpperCase() + id.slice(1), zh), grants: [tag(`resist:${id}`), tag(`elemental-affinity:${id}`)] })),
          },
        },
      ]),
    ],
  },
};
