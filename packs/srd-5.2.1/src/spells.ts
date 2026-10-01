import type { Activation, Entity, SpellEntity } from "@forge/core";
import { t } from "./helpers";

type Cast = "A" | "BA" | "R" | "1m" | "10m" | "1h";
const CAST: Record<Cast, [Activation, string, string]> = {
  A: ["action", "Action", "动作"],
  BA: ["bonus", "Bonus Action", "附赠动作"],
  R: ["reaction", "Reaction", "反应"],
  "1m": ["minute", "1 minute", "1 分钟"],
  "10m": ["minute", "10 minutes", "10 分钟"],
  "1h": ["hour", "1 hour", "1 小时"],
};

const SCHOOL_ZH: Record<string, string> = {
  abjuration: "防护",
  conjuration: "咒法",
  divination: "预言",
  enchantment: "惑控",
  evocation: "塑能",
  illusion: "幻术",
  necromancy: "死灵",
  transmutation: "变化",
};

interface Def {
  id: string;
  en: string;
  zh: string;
  level: number;
  school: string;
  cast: Cast;
  range: [string, string];
  comp: string;
  dur: [string, string];
  conc?: boolean;
  ritual?: boolean;
  lists: string[];
  text: [string, string];
  action?: SpellEntity["action"];
  upcast?: SpellEntity["upcast"];
  scaling?: boolean;
}

const INST: [string, string] = ["Instantaneous", "立即"];
const MIN1: [string, string] = ["1 minute", "1 分钟"];
const SELF: [string, string] = ["Self", "自身"];
const TOUCH: [string, string] = ["Touch", "触及"];
const ft = (n: number): [string, string] => [`${n} ft`, `${n} 尺`];

const DEFS: Def[] = [
  /* ── cantrips ── */
  { id: "fire-bolt", en: "Fire Bolt", zh: "火焰箭", level: 0, school: "evocation", cast: "A", range: ft(120), comp: "V, S", dur: INST, lists: ["wizard", "species"], scaling: true,
    text: ["Ranged spell attack; 1d10 Fire damage. Flammable objects ignite.", "远程法术攻击，造成 1d10 火焰伤害。易燃物会被点燃。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "1d10", type: "fire" }] } },
  { id: "ray-of-frost", en: "Ray of Frost", zh: "冷冻射线", level: 0, school: "evocation", cast: "A", range: ft(60), comp: "V, S", dur: INST, lists: ["wizard"], scaling: true,
    text: ["Ranged spell attack; 1d8 Cold damage and the target's Speed drops by 10 ft until your next turn.", "远程法术攻击，造成 1d8 寒冷伤害，目标速度降低 10 尺直到你下回合开始。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "1d8", type: "cold" }] } },
  { id: "shocking-grasp", en: "Shocking Grasp", zh: "电爪", level: 0, school: "evocation", cast: "A", range: TOUCH, comp: "V, S", dur: INST, lists: ["wizard"], scaling: true,
    text: ["Melee spell attack; 1d8 Lightning damage and the target can't make Opportunity Attacks until its next turn.", "近战法术攻击，造成 1d8 闪电伤害，目标直到其下回合开始前不能进行借机攻击。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "1d8", type: "lightning" }] } },
  { id: "chill-touch", en: "Chill Touch", zh: "颤栗之触", level: 0, school: "necromancy", cast: "A", range: TOUCH, comp: "V, S", dur: INST, lists: ["wizard", "species"], scaling: true,
    text: ["Melee spell attack; 1d10 Necrotic damage and the target can't regain HP until the end of your next turn.", "近战法术攻击，造成 1d10 黯蚀伤害，目标直到你下回合结束前无法恢复生命值。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "1d10", type: "necrotic" }] } },
  { id: "poison-spray", en: "Poison Spray", zh: "毒气喷溅", level: 0, school: "necromancy", cast: "A", range: ft(30), comp: "V, S", dur: INST, lists: ["wizard", "species"], scaling: true,
    text: ["Ranged spell attack; 1d12 Poison damage.", "远程法术攻击，造成 1d12 毒素伤害。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "1d12", type: "poison" }] } },
  { id: "acid-splash", en: "Acid Splash", zh: "酸液飞溅", level: 0, school: "evocation", cast: "A", range: ft(60), comp: "V, S", dur: INST, lists: ["wizard"], scaling: true,
    text: ["Each creature in a 5-ft-radius Sphere makes a Dex save or takes 1d6 Acid damage.", "半径 5 尺球形内的每个生物进行敏捷豁免，失败受到 1d6 强酸伤害。"],
    action: { save: { ability: "dex", dc: 0, onSave: "none" }, damage: [{ dice: "1d6", type: "acid" }] } },
  { id: "light", en: "Light", zh: "光亮术", level: 0, school: "evocation", cast: "A", range: TOUCH, comp: "V, M", dur: ["1 hour", "1 小时"], lists: ["wizard", "cleric"],
    text: ["An object sheds Bright Light in a 20-ft radius and Dim Light for 20 ft more.", "一个物体发出半径 20 尺的明亮光照，并在外延 20 尺发出微光。"] },
  { id: "mage-hand", en: "Mage Hand", zh: "法师之手", level: 0, school: "conjuration", cast: "A", range: ft(30), comp: "V, S", dur: MIN1, lists: ["wizard"],
    text: ["A spectral hand manipulates objects up to 10 lb. Control it with a Magic action.", "召唤一只幽灵手操纵至多 10 磅的物体，以魔法动作控制。"] },
  { id: "minor-illusion", en: "Minor Illusion", zh: "次级幻象", level: 0, school: "illusion", cast: "A", range: ft(30), comp: "S, M", dur: MIN1, lists: ["wizard", "species"],
    text: ["Create a sound or a 5-ft-cube image. An Investigation check (your spell DC) reveals it.", "制造一个声音或 5 尺立方的影像。以智力（调查）检定对抗你的法术 DC 可识破。"] },
  { id: "prestidigitation", en: "Prestidigitation", zh: "魔法伎俩", level: 0, school: "transmutation", cast: "A", range: ft(10), comp: "V, S", dur: ["Up to 1 hour", "至多 1 小时"], lists: ["wizard", "species"],
    text: ["Minor magical tricks: sparks, cleaning, chilling, flavoring, small marks or trinkets.", "细微的魔法小把戏：火花、清洁、冷热、调味、留下小记号或小饰物。"] },
  { id: "dancing-lights", en: "Dancing Lights", zh: "舞光术", level: 0, school: "illusion", cast: "A", range: ft(120), comp: "V, S, M", dur: MIN1, conc: true, lists: ["wizard", "species"],
    text: ["Up to four torch-like lights you can move 60 ft as a Bonus Action.", "制造至多四团火炬般的光，可用附赠动作移动 60 尺。"] },
  { id: "mending", en: "Mending", zh: "修复术", level: 0, school: "transmutation", cast: "1m", range: TOUCH, comp: "V, S, M", dur: INST, lists: ["wizard", "cleric", "species"],
    text: ["Repair a single break or tear in an object.", "修复物体上的一处破损。"] },
  { id: "guidance", en: "Guidance", zh: "神导术", level: 0, school: "divination", cast: "A", range: TOUCH, comp: "V, S", dur: MIN1, conc: true, lists: ["cleric"],
    text: ["Choose a skill; a willing creature adds 1d4 to ability checks using it.", "选择一项技能，一名自愿生物使用该技能的属性检定额外加 1d4。"] },
  { id: "sacred-flame", en: "Sacred Flame", zh: "圣火术", level: 0, school: "evocation", cast: "A", range: ft(60), comp: "V, S", dur: INST, lists: ["cleric"], scaling: true,
    text: ["Dex save or 1d8 Radiant damage; the target gains no benefit from Half or Three-Quarters Cover.", "目标进行敏捷豁免，失败受到 1d8 光耀伤害；半掩护和四分之三掩护对此无效。"],
    action: { save: { ability: "dex", dc: 0, onSave: "none" }, damage: [{ dice: "1d8", type: "radiant" }] } },
  { id: "thaumaturgy", en: "Thaumaturgy", zh: "奇术", level: 0, school: "transmutation", cast: "A", range: ft(30), comp: "V", dur: ["Up to 1 minute", "至多 1 分钟"], lists: ["cleric", "species"],
    text: ["Minor wonders: booming voice, flickering flames, tremors, eerie sounds.", "细微奇迹：洪亮嗓音、火焰闪烁、轻微震动、诡异声响。"] },
  { id: "spare-the-dying", en: "Spare the Dying", zh: "维生术", level: 0, school: "necromancy", cast: "BA", range: ft(15), comp: "V, S", dur: INST, lists: ["cleric"],
    text: ["A creature at 0 HP becomes Stable. Range doubles at levels 5, 11 and 17.", "使生命值为 0 的生物进入稳定状态。射程在 5、11、17 级时翻倍。"] },
  { id: "druidcraft", en: "Druidcraft", zh: "德鲁伊伎俩", level: 0, school: "transmutation", cast: "A", range: ft(30), comp: "V, S", dur: INST, lists: ["species"],
    text: ["Minor nature effects: weather sensing, blooming flowers, harmless sensory effects.", "细微的自然效果：预知天气、使花朵绽放、无害的感官效果。"] },

  /* ── 1st level ── */
  { id: "magic-missile", en: "Magic Missile", zh: "魔法飞弹", level: 1, school: "evocation", cast: "A", range: ft(120), comp: "V, S", dur: INST, lists: ["wizard"],
    text: ["Three darts automatically hit, each dealing 1d4 + 1 Force damage.", "三枚飞弹自动命中，每枚造成 1d4+1 力场伤害。"],
    action: { damage: [{ dice: "3d4+3", type: "force" }] }, upcast: { damage: "1d4+1", text: t("+1 dart per slot level above 1", "每高于 1 环一级多一枚飞弹") } },
  { id: "shield", en: "Shield", zh: "护盾术", level: 1, school: "abjuration", cast: "R", range: SELF, comp: "V, S", dur: ["1 round", "1 轮"], lists: ["wizard"],
    text: ["Trigger: you are hit or targeted by Magic Missile. +5 AC until the start of your next turn.", "触发：被攻击命中或成为魔法飞弹目标。直到你下回合开始，AC +5。"],
    action: { trigger: t("When hit by an attack or targeted by Magic Missile", "被攻击命中或成为魔法飞弹目标时"), applies: [{ effect: "effect:shield", target: "self", duration: { rounds: 1 } }] } },
  { id: "mage-armor", en: "Mage Armor", zh: "法师护甲", level: 1, school: "abjuration", cast: "A", range: TOUCH, comp: "V, S, M", dur: ["8 hours", "8 小时"], lists: ["wizard"],
    text: ["A creature not wearing armor has a base AC of 13 + its Dex modifier.", "未着甲生物的基础 AC 变为 13 + 敏捷调整值。"],
    action: { applies: [{ effect: "effect:mage-armor", target: "self", duration: { hours: 8 } }] } },
  { id: "sleep", en: "Sleep", zh: "睡眠术", level: 1, school: "enchantment", cast: "A", range: ft(60), comp: "V, S, M", dur: MIN1, conc: true, lists: ["wizard"],
    text: ["Creatures in a 5-ft-radius Sphere make Wis saves or are Incapacitated, then Unconscious if they fail again.", "半径 5 尺球形内的生物进行感知豁免，失败则失能，若再次失败则陷入昏迷。"],
    action: { save: { ability: "wis", dc: 0, onSave: "none" } } },
  { id: "burning-hands", en: "Burning Hands", zh: "燃烧之手", level: 1, school: "evocation", cast: "A", range: SELF, comp: "V, S", dur: INST, lists: ["wizard"],
    text: ["15-ft Cone. Dex save: 3d6 Fire damage, half on success.", "15 尺锥形。敏捷豁免：3d6 火焰伤害，成功减半。"],
    action: { save: { ability: "dex", dc: 0, onSave: "half" }, damage: [{ dice: "3d6", type: "fire" }] }, upcast: { damage: "1d6" } },
  { id: "thunderwave", en: "Thunderwave", zh: "雷鸣波", level: 1, school: "evocation", cast: "A", range: SELF, comp: "V, S", dur: INST, lists: ["wizard"],
    text: ["15-ft Cube. Con save: 2d8 Thunder damage and pushed 10 ft; half and no push on success.", "15 尺立方。体质豁免：2d8 雷鸣伤害并被推离 10 尺；成功则减半且不被推离。"],
    action: { save: { ability: "con", dc: 0, onSave: "half" }, damage: [{ dice: "2d8", type: "thunder" }] }, upcast: { damage: "1d8" } },
  { id: "chromatic-orb", en: "Chromatic Orb", zh: "繁彩球", level: 1, school: "evocation", cast: "A", range: ft(90), comp: "V, S, M", dur: INST, lists: ["wizard"],
    text: ["Ranged spell attack; 3d8 damage of a type you choose (Acid, Cold, Fire, Lightning, Poison, Thunder).", "远程法术攻击，造成 3d8 自选类型伤害（强酸/寒冷/火焰/闪电/毒素/雷鸣）。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "3d8", type: "chosen" }] }, upcast: { damage: "1d8" } },
  { id: "detect-magic", en: "Detect Magic", zh: "侦测魔法", level: 1, school: "divination", cast: "A", range: SELF, comp: "V, S", dur: ["10 minutes", "10 分钟"], conc: true, ritual: true, lists: ["wizard", "cleric", "species"],
    text: ["Sense magic within 30 ft and see auras around magical creatures and objects.", "感知 30 尺内的魔法，并看见魔法生物与物品的灵光。"] },
  { id: "feather-fall", en: "Feather Fall", zh: "羽落术", level: 1, school: "transmutation", cast: "R", range: ft(60), comp: "V, M", dur: MIN1, lists: ["wizard"],
    text: ["Up to five falling creatures descend 60 ft per round and take no falling damage.", "至多五个下落的生物每轮下降 60 尺，且不受坠落伤害。"],
    action: { trigger: t("When you or a creature within 60 ft falls", "你或 60 尺内的生物坠落时") } },
  { id: "find-familiar", en: "Find Familiar", zh: "寻获魔宠", level: 1, school: "conjuration", cast: "1h", range: ft(10), comp: "V, S, M", dur: ["Instantaneous", "立即"], ritual: true, lists: ["wizard"],
    text: ["Gain the service of a familiar spirit in an animal form.", "获得一只以动物形态出现的魔宠灵体的效劳。"] },
  { id: "charm-person", en: "Charm Person", zh: "魅惑人类", level: 1, school: "enchantment", cast: "A", range: ft(30), comp: "V, S", dur: ["1 hour", "1 小时"], lists: ["wizard"],
    text: ["A Humanoid makes a Wis save (Advantage if you're fighting it) or is Charmed by you.", "一名类人生物进行感知豁免（若你正与其战斗则具有优势），失败则被你魅惑。"],
    action: { save: { ability: "wis", dc: 0, onSave: "none" } } },
  { id: "identify", en: "Identify", zh: "鉴定术", level: 1, school: "divination", cast: "1m", range: TOUCH, comp: "V, S, M", dur: INST, ritual: true, lists: ["wizard"],
    text: ["Learn the properties of a magic item or the spells affecting a creature.", "得知一件魔法物品的性质，或影响某生物的法术。"] },
  { id: "cure-wounds", en: "Cure Wounds", zh: "疗伤术", level: 1, school: "abjuration", cast: "A", range: TOUCH, comp: "V, S", dur: INST, lists: ["cleric"],
    text: ["A creature regains 2d8 + your spellcasting modifier HP.", "一名生物恢复 2d8 + 你施法属性调整值的生命值。"],
    action: { heal: { dice: "2d8 + @spellmod" } }, upcast: { heal: "2d8" } },
  { id: "healing-word", en: "Healing Word", zh: "治愈真言", level: 1, school: "abjuration", cast: "BA", range: ft(60), comp: "V", dur: INST, lists: ["cleric"],
    text: ["A creature you can see regains 2d4 + your spellcasting modifier HP.", "一名可见生物恢复 2d4 + 你施法属性调整值的生命值。"],
    action: { heal: { dice: "2d4 + @spellmod" } }, upcast: { heal: "2d4" } },
  { id: "bless", en: "Bless", zh: "祝福术", level: 1, school: "enchantment", cast: "A", range: ft(30), comp: "V, S, M", dur: MIN1, conc: true, lists: ["cleric"],
    text: ["Up to three creatures add 1d4 to attack rolls and saving throws.", "至多三名生物的攻击检定和豁免检定额外加 1d4。"],
    action: { applies: [{ effect: "effect:bless", target: "target", duration: { rounds: 10 } }] }, upcast: { text: t("+1 creature per slot level above 1", "每高于 1 环一级多一名目标") } },
  { id: "guiding-bolt", en: "Guiding Bolt", zh: "光导箭", level: 1, school: "evocation", cast: "A", range: ft(120), comp: "V, S", dur: ["1 round", "1 轮"], lists: ["cleric"],
    text: ["Ranged spell attack; 4d6 Radiant damage and the next attack roll against the target has Advantage.", "远程法术攻击，造成 4d6 光耀伤害，下一次对目标的攻击检定具有优势。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "4d6", type: "radiant" }] }, upcast: { damage: "1d6" } },
  { id: "inflict-wounds", en: "Inflict Wounds", zh: "致伤术", level: 1, school: "necromancy", cast: "A", range: TOUCH, comp: "V, S", dur: INST, lists: ["cleric"],
    text: ["Con save: 2d10 Necrotic damage, half on success.", "体质豁免：2d10 黯蚀伤害，成功减半。"],
    action: { save: { ability: "con", dc: 0, onSave: "half" }, damage: [{ dice: "2d10", type: "necrotic" }] }, upcast: { damage: "1d10" } },
  { id: "sanctuary", en: "Sanctuary", zh: "庇护术", level: 1, school: "abjuration", cast: "BA", range: ft(30), comp: "V, S, M", dur: MIN1, lists: ["cleric"],
    text: ["Attackers must succeed on a Wis save or choose a new target.", "试图攻击受术者的生物须通过感知豁免，否则须另选目标。"] },
  { id: "shield-of-faith", en: "Shield of Faith", zh: "虔诚护盾", level: 1, school: "abjuration", cast: "BA", range: ft(60), comp: "V, S, M", dur: ["10 minutes", "10 分钟"], conc: true, lists: ["cleric"],
    text: ["A creature gains +2 AC.", "一名生物 AC +2。"],
    action: { applies: [{ effect: "effect:shield-of-faith", target: "self", duration: { minutes: 10 } }] } },
  { id: "command", en: "Command", zh: "命令术", level: 1, school: "enchantment", cast: "A", range: ft(60), comp: "V", dur: ["1 round", "1 轮"], lists: ["cleric"],
    text: ["Wis save or the target follows a one-word command (Approach, Drop, Flee, Grovel, Halt) on its next turn.", "目标进行感知豁免，失败则在其下回合执行一个单字命令（过来、放下、逃跑、趴下、站住）。"],
    action: { save: { ability: "wis", dc: 0, onSave: "none" } } },
  { id: "faerie-fire", en: "Faerie Fire", zh: "妖火", level: 1, school: "evocation", cast: "A", range: ft(60), comp: "V", dur: MIN1, conc: true, lists: ["species"],
    text: ["Creatures in a 20-ft Cube make a Dex save or are outlined in light; attacks against them have Advantage.", "20 尺立方内的生物进行敏捷豁免，失败则被光芒勾勒，对其的攻击具有优势。"],
    action: { save: { ability: "dex", dc: 0, onSave: "none" } } },
  { id: "longstrider", en: "Longstrider", zh: "大步奔行", level: 1, school: "transmutation", cast: "A", range: TOUCH, comp: "V, S, M", dur: ["1 hour", "1 小时"], lists: ["species"],
    text: ["A creature's Speed increases by 10 ft.", "一名生物速度提高 10 尺。"] },
  { id: "false-life", en: "False Life", zh: "虚假生命", level: 1, school: "necromancy", cast: "A", range: SELF, comp: "V, S, M", dur: INST, lists: ["wizard", "species"],
    text: ["Gain 2d4 + 4 Temporary HP.", "获得 2d4+4 临时生命值。"], action: { heal: { dice: "2d4+4" } }, upcast: { heal: "5" } },
  { id: "ray-of-sickness", en: "Ray of Sickness", zh: "致病射线", level: 1, school: "necromancy", cast: "A", range: ft(60), comp: "V, S", dur: INST, lists: ["wizard", "species"],
    text: ["Ranged spell attack; 2d8 Poison damage and the target has the Poisoned condition until your next turn ends.", "远程法术攻击，造成 2d8 毒素伤害，目标中毒直到你下回合结束。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "2d8", type: "poison" }] }, upcast: { damage: "1d8" } },
  { id: "hellish-rebuke", en: "Hellish Rebuke", zh: "炼狱叱喝", level: 1, school: "evocation", cast: "R", range: ft(60), comp: "V, S", dur: INST, lists: ["species"],
    text: ["Trigger: you take damage from a creature. It makes a Dex save: 2d10 Fire damage, half on success.", "触发：你受到某生物的伤害。该生物进行敏捷豁免：2d10 火焰伤害，成功减半。"],
    action: { trigger: t("When a creature you can see damages you", "被你可见的生物造成伤害时"), save: { ability: "dex", dc: 0, onSave: "half" }, damage: [{ dice: "2d10", type: "fire" }] }, upcast: { damage: "1d10" } },
  { id: "speak-with-animals", en: "Speak with Animals", zh: "动物交谈", level: 1, school: "divination", cast: "A", range: SELF, comp: "V, S", dur: ["10 minutes", "10 分钟"], ritual: true, lists: ["species"],
    text: ["Comprehend and verbally communicate with Beasts.", "能够理解野兽并与之言语交流。"] },
  { id: "ray-of-enfeeblement", en: "Ray of Enfeeblement", zh: "衰弱射线", level: 2, school: "necromancy", cast: "A", range: ft(60), comp: "V, S", dur: MIN1, conc: true, lists: ["wizard", "species"],
    text: ["Con save or the target deals 1d8 less damage with Str-based attacks and has Disadvantage on Str checks.", "体质豁免，失败则目标力量攻击伤害减少 1d8，力量检定具有劣势。"],
    action: { save: { ability: "con", dc: 0, onSave: "none" } } },

  /* ── 2nd level ── */
  { id: "misty-step", en: "Misty Step", zh: "迷踪步", level: 2, school: "conjuration", cast: "BA", range: SELF, comp: "V", dur: INST, lists: ["wizard", "species"],
    text: ["Teleport up to 30 ft to an unoccupied space you can see.", "传送至多 30 尺到你可见的空位。"] },
  { id: "scorching-ray", en: "Scorching Ray", zh: "灼热射线", level: 2, school: "evocation", cast: "A", range: ft(120), comp: "V, S", dur: INST, lists: ["wizard"],
    text: ["Three rays; make a ranged spell attack for each, 2d6 Fire damage per hit.", "三道射线，每道进行一次远程法术攻击，每次命中造成 2d6 火焰伤害。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "2d6", type: "fire" }] }, upcast: { text: t("+1 ray per slot level above 2", "每高于 2 环一级多一道射线") } },
  { id: "shatter", en: "Shatter", zh: "粉碎音波", level: 2, school: "evocation", cast: "A", range: ft(60), comp: "V, S, M", dur: INST, lists: ["wizard"],
    text: ["10-ft-radius Sphere. Con save: 3d8 Thunder damage, half on success.", "半径 10 尺球形。体质豁免：3d8 雷鸣伤害，成功减半。"],
    action: { save: { ability: "con", dc: 0, onSave: "half" }, damage: [{ dice: "3d8", type: "thunder" }] }, upcast: { damage: "1d8" } },
  { id: "hold-person", en: "Hold Person", zh: "人类定身术", level: 2, school: "enchantment", cast: "A", range: ft(60), comp: "V, S, M", dur: MIN1, conc: true, lists: ["wizard", "cleric", "species"],
    text: ["A Humanoid makes a Wis save or is Paralyzed; it repeats the save at the end of each of its turns.", "一名类人生物进行感知豁免，失败则麻痹；其每回合结束时可重复豁免。"],
    action: { save: { ability: "wis", dc: 0, onSave: "none" } }, upcast: { text: t("+1 target per slot level above 2", "每高于 2 环一级多一名目标") } },
  { id: "invisibility", en: "Invisibility", zh: "隐形术", level: 2, school: "illusion", cast: "A", range: TOUCH, comp: "V, S, M", dur: ["1 hour", "1 小时"], conc: true, lists: ["wizard"],
    text: ["A creature has the Invisible condition until it attacks, deals damage or casts a spell.", "一名生物隐形，直到其攻击、造成伤害或施法。"],
    action: { applies: [{ effect: "condition:invisible", target: "target" }] } },
  { id: "mirror-image", en: "Mirror Image", zh: "镜影术", level: 2, school: "illusion", cast: "A", range: SELF, comp: "V, S", dur: MIN1, lists: ["wizard"],
    text: ["Three illusory duplicates; each attack against you may hit a duplicate instead (d6 roll of 3+ per duplicate).", "制造三个幻象分身；攻击你时，每个分身以 d6 掷出 3 以上即可转移该攻击。"] },
  { id: "darkness", en: "Darkness", zh: "黑暗术", level: 2, school: "evocation", cast: "A", range: ft(60), comp: "V, M", dur: ["10 minutes", "10 分钟"], conc: true, lists: ["wizard", "species"],
    text: ["Magical Darkness fills a 15-ft-radius Sphere.", "半径 15 尺球形内充满魔法黑暗。"] },
  { id: "aid", en: "Aid", zh: "援助术", level: 2, school: "abjuration", cast: "A", range: ft(30), comp: "V, S, M", dur: ["8 hours", "8 小时"], lists: ["cleric"],
    text: ["Up to three creatures' HP maximum and current HP increase by 5.", "至多三名生物的生命值上限与当前生命值各提高 5。"],
    action: { applies: [{ effect: "effect:aid", target: "target", duration: { hours: 8 } }] }, upcast: { text: t("+5 HP per slot level above 2", "每高于 2 环一级额外 +5") } },
  { id: "lesser-restoration", en: "Lesser Restoration", zh: "次级复原术", level: 2, school: "abjuration", cast: "BA", range: TOUCH, comp: "V, S", dur: INST, lists: ["cleric"],
    text: ["End one condition on a creature: Blinded, Deafened, Paralyzed or Poisoned.", "终止一名生物身上的一种状态：目盲、耳聋、麻痹或中毒。"] },
  { id: "spiritual-weapon", en: "Spiritual Weapon", zh: "灵体武器", level: 2, school: "evocation", cast: "BA", range: ft(60), comp: "V, S", dur: MIN1, conc: true, lists: ["cleric"],
    text: ["Create a floating spectral weapon; melee spell attack for 1d8 + spellcasting modifier Force damage, again as a Bonus Action on later turns.", "召唤漂浮的灵体武器，近战法术攻击造成 1d8 + 施法调整值力场伤害；之后回合可用附赠动作再次攻击。"],
    action: { attack: { bonus: 0, kind: "spell" }, damage: [{ dice: "1d8 + @spellmod", type: "force" }] }, upcast: { damage: "1d8" } },
  { id: "prayer-of-healing", en: "Prayer of Healing", zh: "治疗祷言", level: 2, school: "abjuration", cast: "10m", range: ft(30), comp: "V", dur: INST, lists: ["cleric"],
    text: ["Up to five creatures each regain 2d8 + your spellcasting modifier HP.", "至多五名生物各恢复 2d8 + 你施法调整值的生命值。"],
    action: { heal: { dice: "2d8 + @spellmod" } }, upcast: { heal: "1d8" } },
  { id: "silence", en: "Silence", zh: "沉默术", level: 2, school: "illusion", cast: "A", range: ft(120), comp: "V, S", dur: ["10 minutes", "10 分钟"], conc: true, ritual: true, lists: ["cleric"],
    text: ["No sound in a 20-ft-radius Sphere; spells with Verbal components can't be cast inside.", "半径 20 尺球形内完全无声，无法施放含言语成分的法术。"] },
  { id: "pass-without-trace", en: "Pass without Trace", zh: "行动无踪", level: 2, school: "abjuration", cast: "A", range: SELF, comp: "V, S, M", dur: ["1 hour", "1 小时"], conc: true, lists: ["species"],
    text: ["You and allies within 30 ft gain +10 to Stealth checks and leave no tracks.", "你与 30 尺内的盟友隐匿检定 +10，且不留痕迹。"] },

  /* ── 3rd level ── */
  { id: "fireball", en: "Fireball", zh: "火球术", level: 3, school: "evocation", cast: "A", range: ft(150), comp: "V, S, M", dur: INST, lists: ["wizard"],
    text: ["20-ft-radius Sphere. Dex save: 8d6 Fire damage, half on success.", "半径 20 尺球形。敏捷豁免：8d6 火焰伤害，成功减半。"],
    action: { save: { ability: "dex", dc: 0, onSave: "half" }, damage: [{ dice: "8d6", type: "fire" }] }, upcast: { damage: "1d6" } },
  { id: "lightning-bolt", en: "Lightning Bolt", zh: "闪电束", level: 3, school: "evocation", cast: "A", range: SELF, comp: "V, S, M", dur: INST, lists: ["wizard"],
    text: ["100-ft Line. Dex save: 8d6 Lightning damage, half on success.", "100 尺直线。敏捷豁免：8d6 闪电伤害，成功减半。"],
    action: { save: { ability: "dex", dc: 0, onSave: "half" }, damage: [{ dice: "8d6", type: "lightning" }] }, upcast: { damage: "1d6" } },
  { id: "counterspell", en: "Counterspell", zh: "法术反制", level: 3, school: "abjuration", cast: "R", range: ft(60), comp: "S", dur: INST, lists: ["wizard"],
    text: ["Trigger: a creature casts a spell. It makes a Con save; on a failure the spell dissipates.", "触发：某生物施法。该生物进行体质豁免，失败则法术失效。"],
    action: { trigger: t("When a creature within 60 ft casts a spell", "60 尺内的生物施法时"), save: { ability: "con", dc: 0, onSave: "none" } } },
  { id: "fly", en: "Fly", zh: "飞行术", level: 3, school: "transmutation", cast: "A", range: TOUCH, comp: "V, S, M", dur: ["10 minutes", "10 分钟"], conc: true, lists: ["wizard"],
    text: ["A willing creature gains a Fly Speed of 60 ft.", "一名自愿生物获得 60 尺飞行速度。"],
    action: { applies: [{ effect: "effect:fly", target: "self" }] }, upcast: { text: t("+1 target per slot level above 3", "每高于 3 环一级多一名目标") } },
  { id: "haste", en: "Haste", zh: "加速术", level: 3, school: "transmutation", cast: "A", range: ft(30), comp: "V, S, M", dur: MIN1, conc: true, lists: ["wizard"],
    text: ["Target's Speed doubles, +2 AC, Advantage on Dex saves, and an extra limited action each turn. Lethargic when it ends.", "目标速度翻倍、AC +2、敏捷豁免具有优势，并每回合获得一个额外受限动作。法术结束时陷入倦怠。"],
    action: { applies: [{ effect: "effect:haste", target: "self", duration: { rounds: 10 } }] } },
  { id: "dispel-magic", en: "Dispel Magic", zh: "解除魔法", level: 3, school: "abjuration", cast: "A", range: ft(120), comp: "V, S", dur: INST, lists: ["wizard", "cleric"],
    text: ["End spells of 3rd level or lower on a target; higher ones need an ability check (DC 10 + spell level).", "终止目标身上 3 环及以下的法术；更高环需进行施法属性检定（DC 10 + 法术环阶）。"] },
  { id: "spirit-guardians", en: "Spirit Guardians", zh: "灵体卫士", level: 3, school: "conjuration", cast: "A", range: SELF, comp: "V, S, M", dur: ["10 minutes", "10 分钟"], conc: true, lists: ["cleric"],
    text: ["15-ft Emanation: enemies' Speed is halved; Wis save or 3d8 Radiant/Necrotic damage, half on success.", "15 尺光环：敌人速度减半；感知豁免，失败受到 3d8 光耀/黯蚀伤害，成功减半。"],
    action: { save: { ability: "wis", dc: 0, onSave: "half" }, damage: [{ dice: "3d8", type: "radiant" }] }, upcast: { damage: "1d8" } },
  { id: "revivify", en: "Revivify", zh: "复生术", level: 3, school: "necromancy", cast: "A", range: TOUCH, comp: "V, S, M (300 GP diamond)", dur: INST, lists: ["cleric"],
    text: ["A creature that died within the last minute returns to life with 1 HP.", "使一分钟内死亡的生物复活，恢复 1 点生命值。"] },
  { id: "mass-healing-word", en: "Mass Healing Word", zh: "群体治愈真言", level: 3, school: "abjuration", cast: "BA", range: ft(60), comp: "V", dur: INST, lists: ["cleric"],
    text: ["Up to six creatures each regain 2d4 + your spellcasting modifier HP.", "至多六名生物各恢复 2d4 + 你施法调整值的生命值。"],
    action: { heal: { dice: "2d4 + @spellmod" } }, upcast: { heal: "1d4" } },
  { id: "beacon-of-hope", en: "Beacon of Hope", zh: "希望信标", level: 3, school: "abjuration", cast: "A", range: ft(30), comp: "V, S", dur: MIN1, conc: true, lists: ["cleric"],
    text: ["Allies have Advantage on Wis saves and Death Saves and regain maximum HP from healing.", "盟友的感知豁免与死亡豁免具有优势，治疗时恢复最大值。"] },
];

export const spells: Entity[] = DEFS.map((d): SpellEntity => {
  const [activation, en, zh] = CAST[d.cast];
  return {
    id: `spell:${d.id}`,
    type: "spell",
    name: t(d.en, d.zh),
    summary: t(d.text[0], d.text[1]),
    text: t(d.text[0], d.text[1]),
    tags: [...d.lists, d.school, ...(d.conc ? ["concentration"] : []), ...(d.ritual ? ["ritual"] : [])],
    level: d.level,
    school: d.school,
    castingTime: t(en, zh),
    activation,
    range: t(d.range[0], d.range[1]),
    components: d.comp,
    duration: t(d.conc ? `Concentration, ${d.dur[0]}` : d.dur[0], d.conc ? `专注，${d.dur[1]}` : d.dur[1]),
    concentration: d.conc,
    ritual: d.ritual,
    cantripScaling: d.scaling,
    action: d.action,
    upcast: d.upcast,
  };
});

export const SCHOOLS = SCHOOL_ZH;
