import { parseCost, toCp, type ItemEntity, type LocalizedText, type PackRegistry } from "@forge/core";
import { isCoinItem } from "./coins";

/**
 * Kinds of shop: what they stock, and the everyday goods shown first. Homebrew items
 * join a shop by carrying its tag (`shop:smith`), so a table's own goods turn up too.
 */
export interface ShopTemplate {
  id: string;
  name: LocalizedText;
  /** Everything this shop may sell (the random stock is drawn from it). */
  stocks: (e: ItemEntity) => boolean;
  /** Always on the shelf, in this order (ids missing from the loaded packs are skipped). */
  common: string[];
  /** How many random goods a restock brings. */
  random: number;
}

const tagged = (e: ItemEntity, ...tags: string[]) => tags.some((t) => e.tags?.includes(t));
const magic = (e: ItemEntity) => tagged(e, "magic");
const own = (id: string) => (e: ItemEntity) => tagged(e, `shop:${id}`);

export const SHOPS: ShopTemplate[] = [
  {
    id: "general",
    name: { en: "General store", zh: "杂货铺" },
    stocks: (e) => own("general")(e) || ((e.itemType === "gear" || e.itemType === "pack") && !magic(e) && !e.consumable),
    common: ["rations", "torch", "rope", "waterskin", "bedroll", "backpack", "tinderbox", "oil", "lantern-hooded", "healers-kit", "crowbar", "arrows", "bolts", "explorers-pack", "dungeoneers-pack"].map((x) => `item:${x}`),
    random: 5,
  },
  {
    id: "smith",
    name: { en: "Blacksmith", zh: "铁匠铺" },
    stocks: (e) => own("smith")(e) || ((e.itemType === "weapon" || e.itemType === "armor") && !magic(e)),
    common: ["dagger", "shortsword", "longsword", "handaxe", "spear", "mace", "shortbow", "longbow", "light-crossbow", "shield", "leather-armor", "chain-shirt", "chain-mail", "arrows", "bolts"].map((x) => `item:${x}`),
    random: 4,
  },
  {
    id: "apothecary",
    name: { en: "Apothecary", zh: "药剂铺" },
    stocks: (e) => own("apothecary")(e) || !!e.consumable || tagged(e, "potion") || ["item:herbalism-kit", "item:healers-kit", "item:vial", "item:poison-basic"].includes(e.id),
    common: ["potion-of-healing", "antitoxin", "healers-kit", "alchemists-fire", "acid", "holy-water", "herbalism-kit", "vial"].map((x) => `item:${x}`),
    random: 3,
  },
  {
    id: "arcane",
    name: { en: "Arcane supplies", zh: "奥术用品店" },
    stocks: (e) => own("arcane")(e) || e.itemType === "focus" || magic(e) || ["item:spellbook", "item:component-pouch", "item:spell-scroll", "item:ink", "item:ink-pen", "item:paper", "item:parchment", "item:book"].includes(e.id),
    common: ["component-pouch", "arcane-focus", "holy-symbol", "druidic-focus", "spellbook", "spell-scroll", "ink", "ink-pen", "parchment"].map((x) => `item:${x}`),
    random: 3,
  },
  {
    id: "crafts",
    name: { en: "Tools & instruments", zh: "工具与乐器" },
    stocks: (e) => own("crafts")(e) || e.itemType === "tool",
    common: ["thieves-tools", "smiths-tools", "herbalism-kit", "calligraphers-supplies", "lute", "dice-set", "playing-cards"].map((x) => `item:${x}`),
    random: 3,
  },
];

const sellable = (e: ItemEntity) => !isCoinItem(e.id) && !!parseCost(e.cost);

/** What a shop could sell from the loaded packs, cheapest first. */
export function shopPool(reg: PackRegistry, shop: ShopTemplate): ItemEntity[] {
  return reg
    .all("item")
    .filter((e) => sellable(e) && shop.stocks(e))
    .sort((a, b) => toCp(parseCost(a.cost)!) - toCp(parseCost(b.cost)!));
}

/** The everyday shelf: the listed goods that exist and have a price, then homebrew goods tagged for this shop. */
export function shopCommon(reg: PackRegistry, shop: ShopTemplate): ItemEntity[] {
  const listed = shop.common.map((id) => reg.getOf("item", id)).filter((e): e is ItemEntity => !!e && sellable(e));
  const extra = reg.all("item").filter((e) => sellable(e) && e.tags?.includes(`shop:${shop.id}`) && !listed.includes(e));
  return [...listed, ...extra];
}

/**
 * A restock: random goods beyond the everyday shelf. Cheaper goods turn up more often
 * (a village smith has more daggers than plate armor). `rng` is injectable for tests.
 */
export function restock(reg: PackRegistry, shop: ShopTemplate, rng: () => number = Math.random): string[] {
  const common = new Set(shop.common);
  const pool = shopPool(reg, shop).filter((e) => !common.has(e.id));
  const weighted = pool.map((e) => ({ id: e.id, w: 1 / (1 + Math.log10(Math.max(1, toCp(parseCost(e.cost)!)))) }));
  const out: string[] = [];
  while (out.length < shop.random && weighted.length) {
    const total = weighted.reduce((n, x) => n + x.w, 0);
    let r = rng() * total;
    const hit = weighted.findIndex((x) => (r -= x.w) <= 0);
    const i = hit < 0 ? weighted.length - 1 : hit;
    out.push(weighted.splice(i, 1)[0]!.id);
  }
  return out;
}
