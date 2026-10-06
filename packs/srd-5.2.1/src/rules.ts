import type { Entity, Grant } from "@forge/core";
import { CONDITION_TEXT } from "./glossary.generated";
import { RAGE_DAMAGE } from "./classes/barbarian";
import { action, dice, mod, t, tag } from "./helpers";

type C = [id: string, en: string, zh: string, textEn: string, textZh: string, icon: string, grants?: Grant[]];

const CONDITIONS: C[] = [
  ["blinded", "Blinded", "目盲", "Can't see; auto-fail checks needing sight. Attacks against you have Advantage; your attacks have Disadvantage.", "无法视物，需视觉的检定自动失败。对你的攻击具有优势，你的攻击具有劣势。", "eye-off"],
  ["charmed", "Charmed", "魅惑", "Can't attack the charmer or target it with harmful effects; the charmer has Advantage on social checks with you.", "不能攻击魅惑者或以有害效果指定其为目标；魅惑者对你的社交检定具有优势。", "heart"],
  ["deafened", "Deafened", "耳聋", "Can't hear; auto-fail checks needing hearing.", "无法听见，需听觉的检定自动失败。", "ear-off"],
  ["exhaustion", "Exhaustion", "力竭", "Each level: −2 to D20 Tests and −5 ft Speed. Level 6 is death. A Long Rest removes one level.", "每级：D20 检定 −2、速度 −5 尺。6 级死亡。长休移除 1 级。", "battery-low", [mod("speed.walk", -5, { label: t("Exhaustion", "力竭") }), tag("exhaustion")]],
  ["frightened", "Frightened", "恐慌", "Disadvantage on ability checks and attacks while the source is in sight; can't willingly move closer to it.", "恐惧源在视线内时，属性检定和攻击具有劣势；不能主动靠近恐惧源。", "ghost"],
  ["grappled", "Grappled", "受擒", "Speed 0; Disadvantage on attacks against anyone but the grappler; the grappler can drag you.", "速度为 0；攻击擒抱者以外的目标具有劣势；擒抱者可拖动你。", "hand"],
  ["incapacitated", "Incapacitated", "失能", "No actions, Bonus Actions or Reactions; Concentration is broken; can't speak; Disadvantage on Initiative.", "不能执行动作、附赠动作或反应；专注中断；无法说话；先攻具有劣势。", "ban"],
  ["invisible", "Invisible", "隐形", "Advantage on Initiative; concealed; attacks against you have Disadvantage and yours have Advantage.", "先攻具有优势；处于隐蔽状态；对你的攻击具有劣势，你的攻击具有优势。", "eye-closed"],
  ["paralyzed", "Paralyzed", "麻痹", "Incapacitated, Speed 0; fail Str/Dex saves; attacks against you have Advantage; hits within 5 ft are Critical Hits.", "失能且速度为 0；力量与敏捷豁免自动失败；对你的攻击具有优势，5 尺内命中即为重击。", "zap-off"],
  ["petrified", "Petrified", "石化", "Turned to stone: Incapacitated, Resistance to all damage, Immunity to Poisoned.", "化为石头：失能，对所有伤害具有抗性，免疫中毒。", "mountain"],
  ["poisoned", "Poisoned", "中毒", "Disadvantage on attack rolls and ability checks.", "攻击检定与属性检定具有劣势。", "flask"],
  ["prone", "Prone", "倒地", "Can only crawl or spend half your Speed to stand; Disadvantage on attacks; melee attacks against you have Advantage, ranged have Disadvantage.", "只能爬行或花费一半速度起身；攻击具有劣势；5 尺内对你的攻击具有优势，更远则具有劣势。", "arrow-down"],
  ["restrained", "Restrained", "束缚", "Speed 0; Disadvantage on attacks and Dex saves; attacks against you have Advantage.", "速度为 0；攻击与敏捷豁免具有劣势；对你的攻击具有优势。", "link"],
  ["stunned", "Stunned", "震慑", "Incapacitated; fail Str/Dex saves; attacks against you have Advantage.", "失能；力量与敏捷豁免自动失败；对你的攻击具有优势。", "sparkles"],
  ["unconscious", "Unconscious", "昏迷", "Incapacitated and Prone, drop what you hold; fail Str/Dex saves; attacks have Advantage; hits within 5 ft are Critical Hits.", "失能且倒地，掉落手持物；力量与敏捷豁免自动失败；对你的攻击具有优势，5 尺内命中即为重击。", "moon"],
];

/**
 * Buffs that change your own sheet while active: spells cast on you, class features
 * you switch on. `suggest` lists the classes whose players reach for it most (offered
 * as the character's quick buff switches); "all" is everyone's.
 */
type E = [id: string, en: string, zh: string, textEn: string, textZh: string, icon: string, grants: Grant[], suggest?: string[]];

const WEAPON = ["melee", "ranged"] as ("melee" | "ranged")[];

const EFFECTS: E[] = [
  ["bless", "Bless", "祝福术", "Add 1d4 to attack rolls and saving throws.", "攻击检定与豁免检定额外加 1d4。", "sparkle", [tag("bless"), dice(["attack", "save"], "1d4", { label: t("Bless", "祝福术") })], ["all"]],
  ["guidance", "Guidance", "神导术", "Add 1d4 to ability checks using the skill chosen when the spell was cast.", "使用施法时选定技能的属性检定额外加 1d4。", "compass", [dice(["check"], "1d4", { label: t("Guidance", "神导术") })], ["all"]],
  ["bane", "Bane", "灾祸术", "Subtract 1d4 from attack rolls and saving throws.", "攻击检定与豁免检定减去 1d4。", "skull", [dice(["attack", "save"], "-1d4", { label: t("Bane", "灾祸术") })]],
  ["bardic-inspiration", "Bardic Inspiration", "吟游激励", "Once: after rolling a D20 Test, add the Bardic Inspiration die (d6; d8 from bard level 5, d10 from 10, d12 from 15).", "一次：在掷出 D20 检定后加上激励骰（d6；吟游诗人 5 级 d8、10 级 d10、15 级 d12）。", "music", [dice(["attack", "save", "check"], "1d6", { once: true, label: t("Bardic Inspiration", "吟游激励") })]],
  ["shield", "Shield", "护盾术", "+5 AC until the start of your next turn.", "直到你下回合开始，AC +5。", "shield", [mod("ac", 5)], ["wizard"]],
  ["mage-armor", "Mage Armor", "法师护甲", "Base AC 13 + Dex while not wearing armor (8 hours).", "未着甲时基础 AC 为 13 + 敏捷（8 小时）。", "shirt", [mod("ac", "13 + @ability.dex.mod", { op: "base", when: "!@equipped.armor" })], ["wizard", "sorcerer"]],
  ["shield-of-faith", "Shield of Faith", "虔诚护盾", "+2 AC.", "AC +2。", "shield-plus", [mod("ac", 2)], ["cleric", "paladin"]],
  ["barkskin", "Barkskin", "树肤术", "Your AC can't be less than 17 (1 hour).", "你的 AC 不低于 17（1 小时）。", "leaf", [mod("ac", 17, { op: "atLeast", label: t("Barkskin", "树肤术") })], ["druid"]],
  ["warding-bond", "Warding Bond", "守护联结", "+1 AC and saving throws, Resistance to all damage; the caster takes the same damage you do.", "AC 与豁免 +1，对所有伤害具有抗性；施法者承受与你相同的伤害。", "link", [mod("ac", 1), ...(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => mod(`save.${a}`, 1, { label: t("Warding Bond", "守护联结") }))]],
  ["haste", "Haste", "加速术", "+2 AC, doubled Speed, Advantage on Dex saves, one extra limited action.", "AC +2，速度翻倍，敏捷豁免具有优势，额外一个受限动作。", "wind", [mod("ac", 2), tag("haste"), tag("adv:save.dex")]],
  ["longstrider", "Longstrider", "大步奔行", "+10 ft Speed (1 hour).", "速度 +10 尺（1 小时）。", "footprints", [mod("speed.walk", 10, { label: t("Longstrider", "大步奔行") })], ["druid", "ranger"]],
  ["pass-without-trace", "Pass without Trace", "行动无踪", "+10 to Dexterity (Stealth) checks.", "敏捷（隐匿）检定 +10。", "footprints", [mod("skill.stealth", 10, { label: t("Pass without Trace", "行动无踪") })]],
  ["aid", "Aid", "援助术", "+5 HP maximum.", "生命值上限 +5。", "heart-pulse", [mod("hp.max", 5)]],
  ["heroism", "Heroism", "英雄气概", "Immune to Frightened; at the start of each of your turns gain Temporary HP equal to the caster's spellcasting modifier.", "免疫恐慌；你每个回合开始时获得等同于施法者施法属性调整值的临时生命值。", "crown", [tag("immune:frightened")]],
  ["magic-weapon", "Magic Weapon", "魔化武器", "+1 to attack and damage rolls with the weapon (1 hour).", "该武器的攻击检定与伤害掷骰 +1（1 小时）。", "sword", [mod("attack.melee", 1, { label: t("Magic Weapon", "魔化武器") }), mod("attack.ranged", 1, { label: t("Magic Weapon", "魔化武器") }), mod("damage.melee", 1, { label: t("Magic Weapon", "魔化武器") }), mod("damage.ranged", 1, { label: t("Magic Weapon", "魔化武器") })]],
  ["enlarge", "Enlarge", "变巨术", "Large size; Advantage on Strength checks and saves; weapon and Unarmed Strike hits deal +1d4 damage.", "体型变为大型；力量检定与豁免具有优势；武器与徒手打击命中额外造成 1d4 伤害。", "maximize", [tag("adv:check.str"), tag("adv:save.str"), dice(["damage"], "1d4", { kinds: WEAPON, label: t("Enlarge", "变巨术") })]],
  ["divine-favor", "Divine Favor", "神恩", "Your weapon attacks deal an extra 1d4 Radiant damage on a hit (1 minute).", "你的武器攻击命中时额外造成 1d4 光耀伤害（1 分钟）。", "sun", [dice(["damage"], "1d4", { damageType: "radiant", kinds: WEAPON, label: t("Divine Favor", "神恩") })], ["paladin"]],
  ["hunters-mark", "Hunter's Mark", "猎人印记", "Hits on the marked creature deal an extra 1d6 Force damage; Advantage on Perception and Survival checks to find it.", "命中被标记的生物时额外造成 1d6 力场伤害；寻找它的察觉与求生检定具有优势。", "crosshair", [dice(["damage"], "1d6", { damageType: "force", label: t("Hunter's Mark (marked target)", "猎人印记（被标记目标）") })], ["ranger"]],
  ["hex", "Hex", "脆弱诅咒", "Hits on the cursed creature deal an extra 1d6 Necrotic damage; it has Disadvantage on checks with the chosen ability.", "命中受诅咒的生物时额外造成 1d6 黯蚀伤害；它使用选定属性的检定具有劣势。", "moon", [dice(["damage"], "1d6", { damageType: "necrotic", label: t("Hex (cursed target)", "脆弱诅咒（受诅咒目标）") })], ["warlock"]],
  ["protection-from-evil-and-good", "Protection from Evil and Good", "防护善恶", "Aberrations, Celestials, Elementals, Fey, Fiends and Undead have Disadvantage on attacks against you; you can't be charmed, frightened or possessed by them.", "异怪、天界生物、元素、精类、邪魔与不死生物对你的攻击具有劣势；它们无法魅惑、恐吓或附身于你。", "shield", []],
  ["blur", "Blur", "朦胧术", "Attack rolls against you have Disadvantage unless the attacker doesn't rely on sight.", "对你的攻击检定具有劣势（不依赖视觉的攻击者除外）。", "eye-off", []],
  ["fly", "Fly", "飞行术", "Fly Speed 60 ft.", "飞行速度 60 尺。", "feather", [mod("speed.fly", 60, { op: "atLeast" })]],
  ["dodge", "Dodge", "闪避", "Until your next turn: attacks against you have Disadvantage, Advantage on Dex saves.", "直到你下回合开始：对你的攻击具有劣势，敏捷豁免具有优势。", "wind", [tag("adv:save.dex")], ["monk"]],
  ["rage", "Rage", "狂暴", "Resistance to Bludgeoning, Piercing and Slashing; Rage Damage on Strength attacks; Advantage on Strength checks and saves.", "钝击、穿刺、挥砍伤害抗性；力量攻击获得狂暴伤害加值；力量检定与豁免具有优势。", "flame", [
    tag("raging"),
    tag("resist:bludgeoning"),
    tag("resist:piercing"),
    tag("resist:slashing"),
    tag("adv:check.str"),
    tag("adv:save.str"),
    mod("damage.melee", RAGE_DAMAGE, { label: t("Rage Damage", "狂暴伤害") }),
  ], ["barbarian"]],
  ["reckless-attack", "Reckless Attack", "鲁莽攻击", "This turn: Advantage on Strength-based attack rolls; attacks against you have Advantage until your next turn.", "本回合：基于力量的攻击检定具有优势；直到你下回合开始，对你的攻击具有优势。", "flame", [tag("adv:attack.str")], ["barbarian"]],
  ["steady-aim", "Steady Aim", "稳定瞄准", "Advantage on your next attack roll this turn (you haven't moved, Speed 0 until the turn ends).", "本回合下一次攻击检定具有优势（未移动，回合结束前速度为 0）。", "crosshair", [tag("adv:attack")], ["rogue"]],
  ["sacred-weapon", "Sacred Weapon", "圣洁武器", "Add your Cha modifier (min +1) to attack rolls with the weapon; it can deal Radiant damage and sheds light.", "该武器的攻击检定加上魅力调整值（至少 +1），可造成光耀伤害并发光。", "sun", [mod("attack.melee", "max(1, @ability.cha.mod)", { label: t("Sacred Weapon", "圣洁武器") })], ["paladin"]],
  ["innate-sorcery", "Innate Sorcery", "先天术法", "+1 Sorcerer spell save DC and Advantage on Sorcerer spell attack rolls for 1 minute.", "1 分钟内术士法术豁免 DC +1，术士法术攻击检定具有优势。", "sparkles", [mod("spell.dc", 1, { label: t("Innate Sorcery", "先天术法") }), tag("adv:attack.spell")], ["sorcerer"]],
  ["draconic-flight", "Draconic Flight", "龙翼飞行", "Fly Speed equal to your Speed for 10 minutes.", "10 分钟内获得等同于速度的飞行速度。", "feather", [mod("speed.fly", "@speed.walk", { op: "atLeast" })]],
  ["large-form", "Large Form", "巨型形态", "Large size, Advantage on Str checks, +10 ft Speed for 10 minutes.", "10 分钟内体型变为大型，力量检定具有优势，速度 +10 尺。", "maximize", [mod("speed.walk", 10)]],
  ["stonecunning", "Stonecunning", "石工知识", "Tremorsense 60 ft for 10 minutes while on stone.", "站在石面上时，10 分钟内获得 60 尺震颤感知。", "radar", [tag("tremorsense")]],
];

export const conditions: Entity[] = [
  ...CONDITIONS.map(([id, en, zh, ten, tzh, icon, grants]): Entity => ({
    id: `condition:${id}`,
    type: "condition",
    name: t(en, zh),
    summary: t(ten, tzh),
    text: CONDITION_TEXT[`condition:${id}`] ?? t(ten, tzh),
    icon,
    tags: ["condition"],
    grants,
  })),
  ...EFFECTS.map(([id, en, zh, ten, tzh, icon, grants, suggest = []]): Entity => ({ id: `effect:${id}`, type: "effect", name: t(en, zh), text: t(ten, tzh), icon, tags: ["buff", ...suggest.map((c) => `suggest:${c}`)], grants })),
];

const basic = (id: string, en: string, zh: string, activation: "action" | "bonus" | "reaction", textEn: string, textZh: string, extra = {}) =>
  action({ id, name: t(en, zh), activation, category: "basic", text: t(textEn, textZh), ...extra });

/** Every character gets these: SRD actions, unarmed strike, languages. */
export const globalGrants: Grant[] = [
  basic("attack", "Attack", "攻击", "action", "Attack with a weapon or an Unarmed Strike.", "以武器或徒手打击进行攻击。"),
  basic("dash", "Dash", "疾走", "action", "Gain extra movement equal to your Speed this turn.", "本回合获得等同于你速度的额外移动距离。"),
  basic("disengage", "Disengage", "撤离", "action", "Your movement doesn't provoke Opportunity Attacks this turn.", "本回合你的移动不会引发借机攻击。"),
  basic("dodge", "Dodge", "闪避", "action", "Until your next turn, attacks against you have Disadvantage and you have Advantage on Dex saves.", "直到你下回合开始，对你的攻击具有劣势，你的敏捷豁免具有优势。"),
  basic("help", "Help", "协助", "action", "Give an ally Advantage on an ability check, or on an attack against an enemy within 5 ft of you.", "使盟友的一次属性检定、或对你 5 尺内敌人的一次攻击具有优势。"),
  basic("hide", "Hide", "躲藏", "action", "Dex (Stealth) check DC 15 while Heavily Obscured or behind cover to become Invisible.", "在重度遮蔽或掩护后进行 DC 15 的敏捷（隐匿）检定，成功则隐形。"),
  basic("influence", "Influence", "交涉", "action", "Urge a monster to do something with a Cha or Wis check.", "以魅力或感知检定劝说生物去做某事。"),
  basic("magic", "Magic", "魔法", "action", "Cast a spell, use a magic item or a magical feature.", "施展法术、使用魔法物品或魔法特性。"),
  basic("ready", "Ready", "预备", "action", "Prepare an action to take as a Reaction when a trigger occurs.", "准备一个动作，在触发条件发生时以反应执行。"),
  basic("search", "Search", "搜索", "action", "Make a Wis check (Insight, Medicine, Perception or Survival).", "进行一次感知检定（洞悉、医药、察觉或求生）。"),
  basic("study", "Study", "研究", "action", "Make an Int check (Arcana, History, Investigation, Nature or Religion).", "进行一次智力检定（奥秘、历史、调查、自然或宗教）。"),
  basic("utilize", "Utilize", "使用", "action", "Use a nonmagical object.", "使用一件非魔法物品。"),
  basic("opportunity-attack", "Opportunity Attack", "借机攻击", "reaction", "When a creature you can see leaves your reach, make one melee attack against it.", "当你可见的生物离开你的触及范围时，对其进行一次近战攻击。", {
    trigger: t("A creature leaves your reach", "生物离开你的触及范围"),
  }),
  action({
    id: "unarmed-strike",
    name: t("Unarmed Strike", "徒手打击"),
    activation: "action",
    category: "attack",
    text: t("Punch, kick or headbutt. Alternatively Grapple or Shove (Str/Dex save DC 8 + Str + PB).", "拳打、脚踢或头撞。也可改为擒抱或推撞（力量/敏捷豁免 DC 8 + 力量 + 熟练）。"),
    attack: { bonus: "@ability.str.mod + @prof + @attack.melee", kind: "melee" },
    damage: [{ dice: "1 + @ability.str.mod", type: "bludgeoning" }],
    tags: ["unarmed"],
  }),
  { type: "proficiency", kind: "language", key: "common" },
  {
    type: "choice",
    id: "languages",
    name: t("Languages", "语言"),
    text: t("You know Common and two other standard languages.", "你掌握通用语及另外两门标准语言。"),
    count: 2,
    from: { kind: "proficiency", profKind: "language", keys: ["common-sign", "draconic", "dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling", "orc"] },
  },
];
