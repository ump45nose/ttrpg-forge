import { ABILITIES, type Entity, type Grant } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, LONG_ALL, masteryChoice, mod, prof, resource, SHORT_ONE, skillChoice, t, table, tag } from "../helpers";
import { alwaysPrepared, asi, LVL, MARTIAL_MELEE, SIMPLE, subclassChoice } from "./common";

/* ───────────────────────── Paladin ───────────────────────── */

const L = LVL("paladin");
const PALADIN_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const CD = [{ resource: "channel-divinity" }];
const CHA_MIN1 = "max(1, @ability.cha.mod)";
const ONCE_FREE = { max: 1, recovery: LONG_ALL };

/**
 * Fighting Style for half-casters: any Fighting Style feat, or the class's own casting alternative
 * (Blessed Warrior / Druidic Warrior), which is a feat only that class can take.
 */
export const styleChoice = (alt: string): Grant => ({
  type: "choice",
  id: "fighting-style",
  name: t("Fighting Style", "战斗风格"),
  count: 1,
  from: { kind: "entity", entityType: "feat", anyTags: ["fighting-style", alt] },
});

/** "Blessed Warrior" / "Druidic Warrior": two cantrips from another list, cast with this class's ability. */
export const warriorCantrips = (id: string, en: string, zh: string, cls: string, list: string, ability: "cha" | "wis", textEn: string, textZh: string): Entity => ({
  id: `feat:${id}`,
  type: "feat",
  category: "fighting-style",
  name: t(en, zh),
  summary: t(textEn, textZh),
  tags: [id],
  prereq: { formula: `@class.${cls}.level >= 2`, text: t(`${cls[0]!.toUpperCase()}${cls.slice(1)} only`, "仅限本职业") },
  grants: [{ type: "choice", id: "cantrips", name: t("Cantrips", "戏法"), count: 2, from: { kind: "entity", entityType: "spell", tags: [list], maxLevel: 0, spell: { ability } } }],
});

export const blessedWarrior = warriorCantrips("blessed-warrior", "Blessed Warrior", "受祝福的勇士", "paladin", "cleric", "cha", "Learn two Cleric cantrips; they count as Paladin spells and use Charisma.", "习得两道牧师戏法，视为圣武士法术，以魅力施法。");

export const paladin: Entity = {
  id: "class:paladin",
  type: "class",
  name: t("Paladin", "圣武士"),
  summary: t("A devout warrior bound by a sacred oath.", "受神圣誓言约束的虔诚战士。"),
  text: t(
    "Paladins pair martial skill with divine magic: Lay on Hands heals, Divine Smite burns foes, and from 6th level their Aura of Protection bolsters every nearby ally's saves.",
    "圣武士将武艺与神圣魔法结合：圣疗治愈伤口，至圣斩灼烧敌人，6 级起守护灵光为附近盟友的豁免加值。",
  ),
  hitDie: 10,
  primaryAbility: ["str", "cha"],
  subclassLevel: 3,
  accent: "#ca8a04",
  tags: ["martial", "caster"],
  starting: [
    ...prof("save", "wis", "cha"),
    ...prof("armor", "light", "medium", "heavy", "shield"),
    ...prof("weapon", "simple", "martial"),
    skillChoice(2, ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"]),
    equipmentChoice("equipment", [
      { id: "a", name: t("Chain Mail, Shield & Longsword", "链甲、盾牌与长剑"), items: [item("chain-mail", 1, true), item("shield", 1, true), item("longsword", 1, true), item("javelin", 6), item("holy-symbol"), item("priests-pack"), gold(9)] },
      { id: "b", name: t("150 GP", "150 金币"), items: [gold(150)] },
    ]),
  ],
  multiclass: [...prof("armor", "light", "medium", "shield"), ...prof("weapon", "martial")],
  levels: {
    "1": [
      feature("lay-on-hands", t("Lay on Hands", "圣疗"), t("A pool of healing equal to five times your Paladin level, refilled on a Long Rest. Bonus Action: touch a creature to restore HP from the pool, or spend 5 to remove the Poisoned condition.", "拥有等于圣武士等级五倍的治疗池，长休补满。以附赠动作触碰一名生物，从池中恢复其生命值，或消耗 5 点移除中毒状态。"), [
        resource("lay-on-hands", t("Lay on Hands", "圣疗"), `5 * ${L}`, LONG_ALL),
        action({ id: "lay-on-hands", name: t("Lay on Hands", "圣疗"), activation: "bonus", category: "feature", range: t("Touch", "触及"), text: t("Restore any number of HP from the pool.", "从治疗池中恢复任意数量的生命值。") }),
      ]),
      {
        type: "spellcasting",
        classId: "class:paladin",
        ability: "cha",
        progression: "half",
        list: "paladin",
        mode: "prepared",
        prepared: table(L, PALADIN_PREPARED),
      },
      masteryChoice(2, [...SIMPLE, ...MARTIAL_MELEE]),
    ],
    "2": [
      styleChoice("blessed-warrior"),
      feature("paladins-smite", t("Paladin's Smite", "圣武斩"), t("Divine Smite is always prepared, and you can cast it once per Long Rest without a spell slot.", "始终准备着至圣斩，并可每次长休一次无需法术位地施展。"), [
        { type: "spell", spell: "spell:divine-smite", alwaysPrepared: true, free: ONCE_FREE },
      ]),
    ],
    "3": [
      subclassChoice("paladin"),
      feature("channel-divinity", t("Channel Divinity", "引导神力"), t("Twice per Short Rest (one use back on a Short Rest, all on a Long Rest). Divine Sense: Bonus Action, sense Celestials, Fiends and Undead within 60 ft for 10 minutes.", "可使用两次（短休恢复一次，长休全部恢复）。神圣感知：以附赠动作，10 分钟内感知 60 尺内的天界生物、邪魔与不死生物。"), [
        resource("channel-divinity", t("Channel Divinity", "引导神力"), table(L, [0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 3]), SHORT_ONE),
        action({ id: "divine-sense", name: t("Divine Sense", "神圣感知"), activation: "bonus", category: "feature", cost: CD, range: t("60 ft", "60 尺"), duration: t("10 minutes", "10 分钟") }),
      ]),
    ],
    "4": [asi()],
    "5": [
      feature("extra-attack", t("Extra Attack", "额外攻击"), t("Attack twice whenever you take the Attack action.", "执行攻击动作时可攻击两次。"), [tag("extra-attack")], { tags: ["attacks:2"] }),
      feature("faithful-steed", t("Faithful Steed", "信实坐骑"), t("Find Steed is always prepared, and you can cast it once per Long Rest without a spell slot.", "始终准备着寻获坐骑，并可每次长休一次无需法术位地施展。"), [
        { type: "spell", spell: "spell:find-steed", alwaysPrepared: true, free: ONCE_FREE },
      ]),
    ],
    "6": [
      feature("aura-of-protection", t("Aura of Protection", "守护灵光"), t("You and allies in your 10-ft Emanation add your Cha modifier (min +1) to saving throws while you aren't Incapacitated.", "未失能时，你与 10 尺光环内的盟友豁免检定加上你的魅力调整值（至少 +1）。"), [
        tag("aura-of-protection"),
        ...ABILITIES.map((a) => mod(`save.${a}`, CHA_MIN1, { label: t("Aura of Protection", "守护灵光") })),
      ]),
    ],
    "8": [asi("feat-8")],
  },
};

export const devotionOath: Entity = {
  id: "subclass:oath-of-devotion",
  type: "subclass",
  classId: "class:paladin",
  name: t("Oath of Devotion", "奉献之誓"),
  summary: t("The ideals of justice, virtue and order.", "坚守正义、美德与秩序的理想。"),
  tags: ["paladin"],
  levels: {
    "3": [
      feature("oath-of-devotion-spells", t("Oath of Devotion Spells", "奉献之誓法术"), t("Always prepared: Protection from Evil and Good, Shield of Faith; Aid and Zone of Truth at 5.", "始终准备：防护善恶、虔诚护盾；5 级援助术、诚实之域。"), [
        ...alwaysPrepared(undefined, "protection-from-evil-and-good", "shield-of-faith"),
        ...alwaysPrepared(5, "aid", "zone-of-truth"),
      ]),
      feature("sacred-weapon", t("Sacred Weapon", "圣洁武器"), t("When you take the Attack action, expend Channel Divinity: for 10 minutes add your Cha modifier (min +1) to attack rolls with a melee weapon you hold; it can deal Radiant damage and sheds light.", "执行攻击动作时消耗一次引导神力：10 分钟内持握的近战武器攻击检定加魅力调整值（至少 +1），可造成光耀伤害并发光。"), [
        action({ id: "sacred-weapon", name: t("Sacred Weapon", "圣洁武器"), activation: "special", category: "feature", cost: CD, trigger: t("You take the Attack action", "执行攻击动作时"), applies: [{ effect: "effect:sacred-weapon", target: "self", duration: { minutes: 10 } }] }),
      ]),
    ],
    "7": [
      feature("aura-of-devotion", t("Aura of Devotion", "奉献灵光"), t("You and allies in your Aura of Protection have Immunity to the Charmed condition.", "你与守护灵光内的盟友免疫魅惑状态。"), [tag("immune:charmed")]),
    ],
  },
};
