import type { Entity, Grant } from "@forge/core";
import { action, equipmentChoice, feature, gold, item, mod, prof, resource, SHORT_ONE, skillChoice, spellChoice, t, table, tag } from "../helpers";
import { alwaysPrepared, asi, furyChoice, LVL, subclassChoice } from "./common";

/* ───────────────────────── Cleric ───────────────────────── */

const clericCantrips = (id: string, count: number): Grant => spellChoice(id, t("Cantrips", "戏法"), count, "cleric", 0, 0);
const CLERIC_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];

export const cleric: Entity = {
  id: "class:cleric",
  type: "class",
  name: t("Cleric", "牧师"),
  summary: t("A miraculous priest of divine power.", "掌握神圣伟力、能行奇迹的祭司。"),
  text: t(
    "Clerics channel divine magic to heal, protect and smite. They prepare spells from the entire cleric list each day and wield Channel Divinity.",
    "牧师引导神圣魔法来治愈、守护与惩戒。他们每天可从完整的牧师法术列表中准备法术，并能使用引导神力。",
  ),
  hitDie: 8,
  primaryAbility: ["wis"],
  subclassLevel: 3,
  accent: "#e0b43c",
  tags: ["caster"],
  starting: [
    ...prof("save", "wis", "cha"),
    ...prof("armor", "light", "medium", "shield"),
    ...prof("weapon", "simple"),
    skillChoice(2, ["history", "insight", "medicine", "persuasion", "religion"]),
    equipmentChoice("equipment", [
      { id: "a", name: t("Chain Shirt, Shield & Mace", "链甲衫、盾牌与硬头锤"), items: [item("chain-shirt", 1, true), item("shield", 1, true), item("mace", 1, true), item("holy-symbol"), item("priests-pack"), gold(7)] },
      { id: "b", name: t("110 GP", "110 金币"), items: [gold(110)] },
    ]),
  ],
  multiclass: [...prof("armor", "light", "medium", "shield")],
  levels: {
    "1": [
      {
        type: "spellcasting",
        classId: "class:cleric",
        ability: "wis",
        progression: "full",
        list: "cleric",
        mode: "prepared",
        cantrips: `${table(LVL("cleric"), [3, 3, 3, 4, 4, 4, 4, 4, 4, 5])} + @tag.thaumaturge`,
        prepared: table(LVL("cleric"), CLERIC_PREPARED),
      },
      clericCantrips("cantrips", 3),
      {
        type: "choice",
        id: "divine-order",
        name: t("Divine Order", "神圣职能"),
        count: 1,
        from: {
          kind: "options",
          options: [
            {
              id: "protector",
              name: t("Protector", "守护者"),
              text: t("Trained for battle: Martial weapons and Heavy armor.", "受过战斗训练：军用武器与重甲熟练。"),
              grants: [...prof("weapon", "martial"), ...prof("armor", "heavy")],
            },
            {
              id: "thaumaturge",
              name: t("Thaumaturge", "神术师"),
              text: t("One extra cantrip, and add your Wis modifier (min +1) to Int (Arcana or Religion) checks.", "额外一道戏法，并在智力（奥秘或宗教）检定中加上感知调整值（至少 +1）。"),
              grants: [
                tag("thaumaturge"),
                clericCantrips("cantrip", 1),
                mod("skill.arcana", "max(1, @ability.wis.mod)", { label: t("Thaumaturge", "神术师") }),
                mod("skill.religion", "max(1, @ability.wis.mod)", { label: t("Thaumaturge", "神术师") }),
              ],
            },
          ],
        },
      },
    ],
    "2": [
      feature("channel-divinity", t("Channel Divinity", "引导神力"), t("Channel divine energy for magical effects. Regain one use on a Short Rest and all on a Long Rest.", "引导神圣能量产生魔法效果。短休恢复一次，长休全部恢复。"), [
        resource("channel-divinity", t("Channel Divinity", "引导神力"), table(LVL("cleric"), [0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4]), SHORT_ONE),
        action({
          id: "divine-spark",
          name: t("Divine Spark", "神圣火花"),
          activation: "action",
          category: "feature",
          cost: [{ resource: "channel-divinity" }],
          range: t("30 ft", "30 尺"),
          text: t("Heal a creature, or force a Con save: Radiant or Necrotic damage, half on success.", "治疗一名生物，或令其进行体质豁免：光耀或黯蚀伤害，成功减半。"),
          heal: { dice: `[[${LVL("cleric")} >= 18 ? 4 : ${LVL("cleric")} >= 13 ? 3 : ${LVL("cleric")} >= 7 ? 2 : 1]]d8 + @ability.wis.mod` },
          save: { ability: "con", dc: "@spell.cleric.dc", onSave: "half" },
          damage: [{ dice: `[[${LVL("cleric")} >= 18 ? 4 : ${LVL("cleric")} >= 13 ? 3 : ${LVL("cleric")} >= 7 ? 2 : 1]]d8 + @ability.wis.mod`, type: "radiant" }],
        }),
        action({
          id: "turn-undead",
          name: t("Turn Undead", "驱散不死"),
          activation: "action",
          category: "feature",
          cost: [{ resource: "channel-divinity" }],
          range: t("30 ft", "30 尺"),
          text: t("Each Undead within 30 ft makes a Wis save or is Frightened and Incapacitated for 1 minute (until damaged).", "30 尺内的不死生物进行感知豁免，失败则恐慌并失能 1 分钟（受伤即终止）。"),
          save: { ability: "wis", dc: "@spell.cleric.dc", onSave: "none" },
        }),
      ]),
    ],
    "3": [subclassChoice("cleric")],
    "4": [asi(), clericCantrips("cantrips-4", 1)],
    "5": [
      feature("sear-undead", t("Sear Undead", "焚灼不死"), t("Turn Undead also deals Radiant damage equal to a number of d8s equal to your Wis modifier (min 1).", "驱散不死同时造成若干 d8 光耀伤害，骰数等于感知调整值（至少 1）。"), [
        action({ id: "sear-undead", name: t("Sear Undead", "焚灼不死"), activation: "special", category: "feature", tags: ["rider"], trigger: t("When you use Turn Undead", "使用驱散不死时"), damage: [{ dice: "[[max(1, @ability.wis.mod)]]d8", type: "radiant" }] }),
      ]),
    ],
    "7": [
      feature("blessed-strikes", t("Blessed Strikes", "受祝击"), t("Choose Divine Strike (once per turn, +1d8 Necrotic or Radiant damage on a weapon hit) or Potent Spellcasting (add Wis to Cleric cantrip damage).", "选择神圣打击（每回合一次，武器命中时额外 1d8 黯蚀或光耀伤害）或强力施法（牧师戏法伤害加感知调整值）。"), [
        furyChoice("blessed-strikes-choice", t("Blessed Strikes", "受祝击"), "cleric", { id: "divine-strike", en: "Divine Strike", zh: "神圣打击", dice: "1d8", type: "radiant", textEn: "Once per turn, +1d8 Necrotic or Radiant damage on a weapon hit.", textZh: "每回合一次，武器攻击命中时额外造成 1d8 黯蚀或光耀伤害。" }),
      ]),
    ],
    "8": [asi("feat-8")],
  },
};

export const lifeDomain: Entity = {
  id: "subclass:life-domain",
  type: "subclass",
  classId: "class:cleric",
  name: t("Life Domain", "生命领域"),
  summary: t("Masters of healing who keep their allies on their feet.", "治疗大师，让盟友始终屹立。"),
  tags: ["cleric"],
  levels: {
    "3": [
      feature("disciple-of-life", t("Disciple of Life", "生命门徒"), t("Healing spells of level 1+ restore an extra 2 + the slot's level HP.", "1 环及以上的治疗法术额外恢复 2 + 法术位环阶的生命值。"), [tag("disciple-of-life")]),
      feature("life-domain-spells", t("Life Domain Spells", "生命领域法术"), t("Always prepared: Aid, Bless, Cure Wounds, Lesser Restoration; Mass Healing Word and Revivify at 5; Aura of Life and Death Ward at 7.", "始终准备：援助术、祝福术、疗伤术、次级复原术；5 级群体治愈真言、复生术；7 级生命灵光、防死结界。"), [
        ...alwaysPrepared(undefined, "aid", "bless", "cure-wounds", "lesser-restoration"),
        ...alwaysPrepared(5, "mass-healing-word", "revivify"),
        ...alwaysPrepared(7, "aura-of-life", "death-ward"),
      ]),
      feature("preserve-life", t("Preserve Life", "保存生命"), t("Channel Divinity: restore HP equal to five times your Cleric level, divided among Bloodied creatures within 30 ft (up to half their max).", "引导神力：恢复等同于牧师等级五倍的生命值，分配给 30 尺内浴血的生物（至多恢复到其上限一半）。"), [
        action({ id: "preserve-life", name: t("Preserve Life", "保存生命"), activation: "action", category: "feature", cost: [{ resource: "channel-divinity" }], heal: { dice: `[[5 * ${LVL("cleric")}]]` } }),
      ]),
    ],
    "6": [
      feature("blessed-healer", t("Blessed Healer", "神祝医者"), t("When a spell slot spell restores HP to another creature, you regain 2 + the slot's level HP.", "以法术位施展的法术为他人恢复生命值时，你也恢复 2 + 法术位环阶的生命值。"), [tag("blessed-healer")]),
    ],
  },
};
