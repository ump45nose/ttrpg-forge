import type { Entity, ItemEntity, WeaponProps } from "@forge/core";
import { t } from "./helpers";

type W = [id: string, en: string, zh: string, cat: WeaponProps["category"], kind: WeaponProps["kind"], dmg: string, type: string, props: string[], mastery: string, extra?: Partial<WeaponProps>];

const WEAPONS: W[] = [
  ["club", "Club", "短棒", "simple", "melee", "1d4", "bludgeoning", ["light"], "slow"],
  ["dagger", "Dagger", "匕首", "simple", "melee", "1d4", "piercing", ["finesse", "light", "thrown"], "nick", { range: "20/60" }],
  ["greatclub", "Greatclub", "巨棒", "simple", "melee", "1d8", "bludgeoning", ["two-handed"], "push"],
  ["handaxe", "Handaxe", "手斧", "simple", "melee", "1d6", "slashing", ["light", "thrown"], "vex", { range: "20/60" }],
  ["javelin", "Javelin", "标枪", "simple", "melee", "1d6", "piercing", ["thrown"], "slow", { range: "30/120" }],
  ["light-hammer", "Light Hammer", "轻锤", "simple", "melee", "1d4", "bludgeoning", ["light", "thrown"], "nick", { range: "20/60" }],
  ["mace", "Mace", "硬头锤", "simple", "melee", "1d6", "bludgeoning", [], "sap"],
  ["quarterstaff", "Quarterstaff", "长棍", "simple", "melee", "1d6", "bludgeoning", ["versatile"], "topple", { versatile: "1d8" }],
  ["sickle", "Sickle", "镰刀", "simple", "melee", "1d4", "slashing", ["light"], "nick"],
  ["spear", "Spear", "矛", "simple", "melee", "1d6", "piercing", ["thrown", "versatile"], "sap", { range: "20/60", versatile: "1d8" }],
  ["dart", "Dart", "飞镖", "simple", "ranged", "1d4", "piercing", ["finesse", "thrown"], "vex", { range: "20/60" }],
  ["light-crossbow", "Light Crossbow", "轻弩", "simple", "ranged", "1d8", "piercing", ["ammunition", "loading", "two-handed"], "slow", { range: "80/320" }],
  ["shortbow", "Shortbow", "短弓", "simple", "ranged", "1d6", "piercing", ["ammunition", "two-handed"], "vex", { range: "80/320" }],
  ["sling", "Sling", "投石索", "simple", "ranged", "1d4", "bludgeoning", ["ammunition"], "slow", { range: "30/120" }],
  ["battleaxe", "Battleaxe", "战斧", "martial", "melee", "1d8", "slashing", ["versatile"], "topple", { versatile: "1d10" }],
  ["flail", "Flail", "连枷", "martial", "melee", "1d8", "bludgeoning", [], "sap"],
  ["glaive", "Glaive", "长柄刀", "martial", "melee", "1d10", "slashing", ["heavy", "reach", "two-handed"], "graze"],
  ["greataxe", "Greataxe", "巨斧", "martial", "melee", "1d12", "slashing", ["heavy", "two-handed"], "cleave"],
  ["greatsword", "Greatsword", "巨剑", "martial", "melee", "2d6", "slashing", ["heavy", "two-handed"], "graze"],
  ["halberd", "Halberd", "戟", "martial", "melee", "1d10", "slashing", ["heavy", "reach", "two-handed"], "cleave"],
  ["lance", "Lance", "骑枪", "martial", "melee", "1d10", "piercing", ["heavy", "reach", "two-handed"], "topple"],
  ["longsword", "Longsword", "长剑", "martial", "melee", "1d8", "slashing", ["versatile"], "sap", { versatile: "1d10" }],
  ["maul", "Maul", "巨锤", "martial", "melee", "2d6", "bludgeoning", ["heavy", "two-handed"], "topple"],
  ["morningstar", "Morningstar", "钉头锤", "martial", "melee", "1d8", "piercing", [], "sap"],
  ["pike", "Pike", "长矛", "martial", "melee", "1d10", "piercing", ["heavy", "reach", "two-handed"], "push"],
  ["rapier", "Rapier", "刺剑", "martial", "melee", "1d8", "piercing", ["finesse"], "vex"],
  ["scimitar", "Scimitar", "弯刀", "martial", "melee", "1d6", "slashing", ["finesse", "light"], "nick"],
  ["shortsword", "Shortsword", "短剑", "martial", "melee", "1d6", "piercing", ["finesse", "light"], "vex"],
  ["trident", "Trident", "三叉戟", "martial", "melee", "1d8", "piercing", ["thrown", "versatile"], "topple", { range: "20/60", versatile: "1d10" }],
  ["warhammer", "Warhammer", "战锤", "martial", "melee", "1d8", "bludgeoning", ["versatile"], "push", { versatile: "1d10" }],
  ["war-pick", "War Pick", "战镐", "martial", "melee", "1d8", "piercing", ["versatile"], "sap", { versatile: "1d10" }],
  ["whip", "Whip", "鞭", "martial", "melee", "1d4", "slashing", ["finesse", "reach"], "slow"],
  ["blowgun", "Blowgun", "吹箭筒", "martial", "ranged", "1", "piercing", ["ammunition", "loading"], "vex", { range: "25/100" }],
  ["hand-crossbow", "Hand Crossbow", "手弩", "martial", "ranged", "1d6", "piercing", ["ammunition", "light", "loading"], "vex", { range: "30/120" }],
  ["heavy-crossbow", "Heavy Crossbow", "重弩", "martial", "ranged", "1d10", "piercing", ["ammunition", "heavy", "loading", "two-handed"], "push", { range: "100/400" }],
  ["longbow", "Longbow", "长弓", "martial", "ranged", "1d8", "piercing", ["ammunition", "heavy", "two-handed"], "slow", { range: "150/600" }],
  ["musket", "Musket", "火枪", "martial", "ranged", "1d12", "piercing", ["ammunition", "loading", "two-handed"], "slow", { range: "40/120" }],
  ["pistol", "Pistol", "手枪", "martial", "ranged", "1d10", "piercing", ["ammunition", "loading"], "vex", { range: "30/90" }],
];

type A = [id: string, en: string, zh: string, cat: "light" | "medium" | "heavy" | "shield", ac: number, extra?: { strength?: number; stealthDisadvantage?: boolean }];

const ARMOR: A[] = [
  ["padded-armor", "Padded Armor", "棉甲", "light", 11, { stealthDisadvantage: true }],
  ["leather-armor", "Leather Armor", "皮甲", "light", 11],
  ["studded-leather-armor", "Studded Leather Armor", "镶钉皮甲", "light", 12],
  ["hide-armor", "Hide Armor", "兽皮甲", "medium", 12],
  ["chain-shirt", "Chain Shirt", "链甲衫", "medium", 13],
  ["scale-mail", "Scale Mail", "鳞甲", "medium", 14, { stealthDisadvantage: true }],
  ["breastplate", "Breastplate", "胸甲", "medium", 14],
  ["half-plate-armor", "Half Plate Armor", "半身板甲", "medium", 15, { stealthDisadvantage: true }],
  ["ring-mail", "Ring Mail", "环甲", "heavy", 14, { stealthDisadvantage: true }],
  ["chain-mail", "Chain Mail", "链甲", "heavy", 16, { strength: 13, stealthDisadvantage: true }],
  ["splint-armor", "Splint Armor", "板条甲", "heavy", 17, { strength: 15, stealthDisadvantage: true }],
  ["plate-armor", "Plate Armor", "全身板甲", "heavy", 18, { strength: 15, stealthDisadvantage: true }],
  ["shield", "Shield", "盾牌", "shield", 2],
];

type G = [id: string, en: string, zh: string, type?: ItemEntity["itemType"]];

const GEAR: G[] = [
  ["gp", "Gold Piece", "金币"],
  ["arrows", "Arrows", "箭矢"],
  ["bolts", "Crossbow Bolts", "弩矢"],
  ["quiver", "Quiver", "箭袋"],
  ["holy-symbol", "Holy Symbol", "圣徽", "focus"],
  ["arcane-focus", "Arcane Focus", "奥术法器", "focus"],
  ["druidic-focus", "Druidic Focus", "德鲁伊法器", "focus"],
  ["spellbook", "Spellbook", "法术书"],
  ["robe", "Robe", "长袍"],
  ["travelers-clothes", "Traveler's Clothes", "旅行者服装"],
  ["crowbar", "Crowbar", "撬棍"],
  ["pouch", "Pouch", "钱袋"],
  ["book", "Book", "书"],
  ["parchment", "Parchment", "羊皮纸"],
  ["healers-kit", "Healer's Kit", "医疗包"],
  ["dungeoneers-pack", "Dungeoneer's Pack", "地城探索套组", "pack"],
  ["burglars-pack", "Burglar's Pack", "窃贼套组", "pack"],
  ["priests-pack", "Priest's Pack", "牧师套组", "pack"],
  ["scholars-pack", "Scholar's Pack", "学者套组", "pack"],
  ["explorers-pack", "Explorer's Pack", "探险家套组", "pack"],
  ["entertainers-pack", "Entertainer's Pack", "艺人套组", "pack"],
  ["thieves-tools", "Thieves' Tools", "盗贼工具", "tool"],
  ["calligraphers-supplies", "Calligrapher's Supplies", "书法家工具", "tool"],
  ["dice-set", "Dice Set", "骰子组", "tool"],
  ["playing-cards", "Playing Card Set", "扑克牌组", "tool"],
  ["herbalism-kit", "Herbalism Kit", "草药工具", "tool"],
  ["smiths-tools", "Smith's Tools", "铁匠工具", "tool"],
  ["lute", "Lute", "鲁特琴", "tool"],
];

const MASTERY: Record<string, [string, string, string, string]> = {
  cleave: ["Cleave", "劈砍", "On a melee hit, make one extra attack against a second creature within 5 ft of the first (once per turn); don't add your ability modifier to its damage unless negative.", "近战命中后，可对首个目标 5 尺内的另一生物再攻击一次（每回合一次）；该次伤害不加属性调整值（负值除外）。"],
  graze: ["Graze", "擦伤", "If your attack misses, the target still takes damage equal to your ability modifier.", "攻击未命中时，目标仍受到等同于你所用属性调整值的伤害。"],
  nick: ["Nick", "迅击", "The extra attack from the Light property can be made as part of the Attack action instead of a Bonus Action (once per turn).", "轻型武器的额外攻击可作为攻击动作的一部分进行，而非附赠动作（每回合一次）。"],
  push: ["Push", "推离", "On a hit, push a Large or smaller target up to 10 ft straight away from you.", "命中后，可将大型或更小的目标直线推离你至多 10 尺。"],
  sap: ["Sap", "削弱", "On a hit, the target has Disadvantage on its next attack roll before the start of your next turn.", "命中后，目标在你下回合开始前的下一次攻击检定具有劣势。"],
  slow: ["Slow", "迟缓", "On a hit that deals damage, reduce the target's Speed by 10 ft until the start of your next turn.", "命中并造成伤害后，目标速度降低 10 尺，直到你下回合开始。"],
  topple: ["Topple", "掀翻", "On a hit, the target makes a Con save (DC 8 + ability mod + proficiency) or falls Prone.", "命中后，目标须进行体质豁免（DC 8 + 属性调整值 + 熟练加值），失败则倒地。"],
  vex: ["Vex", "侵扰", "On a hit that deals damage, you have Advantage on your next attack roll against that creature before the end of your next turn.", "命中并造成伤害后，你在下回合结束前对该生物的下一次攻击检定具有优势。"],
};

export const items: Entity[] = [
  ...WEAPONS.map(([id, en, zh, category, kind, damage, damageType, properties, mastery, extra]): Entity => ({
    id: `item:${id}`,
    type: "item",
    itemType: "weapon",
    name: t(en, zh),
    tags: ["weapon", category, kind, ...properties],
    weapon: { category, kind, damage, damageType, properties, mastery, ...extra },
  })),
  ...ARMOR.map(([id, en, zh, category, ac, extra]): Entity => ({
    id: `item:${id}`,
    type: "item",
    itemType: "armor",
    name: t(en, zh),
    tags: ["armor", category],
    armor: { category, ac, dexCap: category === "medium" ? 2 : undefined, ...extra },
  })),
  ...GEAR.map(([id, en, zh, itemType]): Entity => ({ id: `item:${id}`, type: "item", itemType: itemType ?? "gear", name: t(en, zh), tags: [itemType ?? "gear"] })),
  ...Object.entries(MASTERY).map(([id, [en, zh, ten, tzh]]): Entity => ({
    id: `mastery:${id}`,
    type: "effect",
    name: t(en, zh),
    text: t(ten, tzh),
    tags: ["mastery-property"],
  })),
];
