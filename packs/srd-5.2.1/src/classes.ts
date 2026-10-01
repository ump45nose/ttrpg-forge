import type { Entity, Grant } from "@forge/core";
import {
  action,
  equipmentChoice,
  feature,
  featChoice,
  gold,
  item,
  LONG_ALL,
  masteryChoice,
  mod,
  prof,
  resource,
  SHORT_ALL,
  SHORT_ONE,
  skillChoice,
  spellChoice,
  t,
  table,
  tag,
} from "./helpers";

const asi = (): Grant => featChoice("feat", ["general"], t("Ability Score Improvement / Feat", "属性值提升 / 专长"));

const subclassChoice = (cls: string): Grant => ({
  type: "choice",
  id: "subclass",
  name: t("Subclass", "子职业"),
  count: 1,
  from: { kind: "entity", entityType: "subclass", tags: [cls] },
});

const LVL = (cls: string) => `@class.${cls}.level`;

/* ───────────────────────── Fighter ───────────────────────── */

const fighter: Entity = {
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
  accent: "#b45309",
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
  },
};

const champion: Entity = {
  id: "subclass:champion",
  type: "subclass",
  classId: "class:fighter",
  name: t("Champion", "勇士"),
  summary: t("Raw physical power honed to deadly perfection.", "将纯粹的肉体力量磨砺至致命的完美。"),
  tags: ["fighter"],
  levels: {
    "3": [
      feature("improved-critical", t("Improved Critical", "精通重击"), t("Your attack rolls with weapons and Unarmed Strikes score a Critical Hit on a 19 or 20.", "武器与徒手打击的攻击检定掷出 19 或 20 即为重击。"), [mod("crit.bonus", 1, { op: "atLeast", label: t("Improved Critical", "精通重击") })]),
      feature("remarkable-athlete", t("Remarkable Athlete", "卓越运动员"), t("Advantage on Initiative and Str (Athletics) checks. After a Critical Hit, move up to half your Speed without provoking Opportunity Attacks.", "先攻与力量（运动）检定具有优势。重击后可移动至多一半速度且不引发借机攻击。")),
    ],
  },
};

/* ───────────────────────── Rogue ───────────────────────── */

const ROGUE_MARTIAL = ["item:rapier", "item:scimitar", "item:shortsword", "item:hand-crossbow", "item:whip"];
const SIMPLE = ["club", "dagger", "greatclub", "handaxe", "javelin", "light-hammer", "mace", "quarterstaff", "sickle", "spear", "dart", "light-crossbow", "shortbow", "sling"].map((x) => `item:${x}`);
const ROGUE_SKILLS = ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "persuasion", "sleight-of-hand", "stealth"];

const rogue: Entity = {
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
  accent: "#334155",
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
  },
};

const thief: Entity = {
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

/* ───────────────────────── Cleric ───────────────────────── */

const clericCantrips = (id: string, count: number): Grant => spellChoice(id, t("Cantrips", "戏法"), count, "cleric", 0, 0);
const CLERIC_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];

const cleric: Entity = {
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
  accent: "#ca8a04",
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
  },
};

const lifeDomain: Entity = {
  id: "subclass:life-domain",
  type: "subclass",
  classId: "class:cleric",
  name: t("Life Domain", "生命领域"),
  summary: t("Masters of healing who keep their allies on their feet.", "治疗大师，让盟友始终屹立。"),
  tags: ["cleric"],
  levels: {
    "3": [
      feature("disciple-of-life", t("Disciple of Life", "生命门徒"), t("Healing spells of level 1+ restore an extra 2 + the slot's level HP.", "1 环及以上的治疗法术额外恢复 2 + 法术位环阶的生命值。"), [tag("disciple-of-life")]),
      feature("life-domain-spells", t("Life Domain Spells", "生命领域法术"), t("Always prepared: Aid, Bless, Cure Wounds, Lesser Restoration.", "始终准备：援助术、祝福术、疗伤术、次级复原术。"), [
        { type: "spell", spell: "spell:aid", alwaysPrepared: true },
        { type: "spell", spell: "spell:bless", alwaysPrepared: true },
        { type: "spell", spell: "spell:cure-wounds", alwaysPrepared: true },
        { type: "spell", spell: "spell:lesser-restoration", alwaysPrepared: true },
      ]),
      feature("preserve-life", t("Preserve Life", "保存生命"), t("Channel Divinity: restore HP equal to five times your Cleric level, divided among Bloodied creatures within 30 ft (up to half their max).", "引导神力：恢复等同于牧师等级五倍的生命值，分配给 30 尺内浴血的生物（至多恢复到其上限一半）。"), [
        action({ id: "preserve-life", name: t("Preserve Life", "保存生命"), activation: "action", category: "feature", cost: [{ resource: "channel-divinity" }], heal: { dice: `[[5 * ${LVL("cleric")}]]` } }),
      ]),
    ],
    "5": [
      feature("life-domain-spells-5", t("Life Domain Spells (5)", "生命领域法术（5）"), t("Always prepared: Mass Healing Word, Revivify.", "始终准备：群体治愈真言、复生术。"), [
        { type: "spell", spell: "spell:mass-healing-word", alwaysPrepared: true },
        { type: "spell", spell: "spell:revivify", alwaysPrepared: true },
      ]),
    ],
  },
};

/* ───────────────────────── Wizard ───────────────────────── */

const WIZARD_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25];
const book = (id: string, count: number, maxLevel: number) => spellChoice(id, t("Spellbook", "法术书"), count, "wizard", 1, maxLevel);

const wizard: Entity = {
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
  accent: "#4338ca",
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
  },
};

const evoker: Entity = {
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
  },
};

export const classes: Entity[] = [fighter, champion, rogue, thief, cleric, lifeDomain, wizard, evoker];
