import type { Ability, BackgroundEntity, Entity, Grant, ItemEntity, LocalizedText, SpeciesEntity } from "@forge/core";
import { ulid } from "ulid";

/**
 * Form <-> entity conversion for the structured homebrew editor. Anything the
 * form doesn't understand is kept in `extra` and written back untouched, so
 * cloning official content and editing it never loses mechanics.
 */

export const L = (s: string): LocalizedText => ({ en: s, zh: s });
/** Unnamed drafts are stored as "?" (names are required by the schema); show them as empty. */
export const plain = (t: LocalizedText | undefined, locale: "en" | "zh") => {
  const s = t === undefined ? "" : typeof t === "string" ? t : (t[locale] ?? t.en);
  return s === "?" ? "" : s;
};

/** Local ids start with a letter after each hyphen so they work inside formula refs (@class.local-h….level). */
/** Keep the original (possibly bilingual) text when the field wasn't touched; otherwise store the new text for both locales. */
export const keepL = (prev: LocalizedText | undefined, locale: "en" | "zh", value: string): LocalizedText | undefined =>
  !value ? undefined : prev !== undefined && plain(prev, locale) === value ? prev : L(value);

export const newLocalId = (type: string) => `${type}:local-h${ulid().toLowerCase().slice(-9)}`;

export interface Kit {
  item: string;
  qty: number;
  equipped?: boolean;
}

export interface BackgroundForm {
  id: string;
  name: string;
  summary: string;
  text: string;
  abilities: Ability[];
  feat: string;
  skills: string[];
  tools: string[];
  kit: Kit[];
  kitGold: number;
  /** Gold offered instead of the kit (2024 default 50). */
  altGold: number;
  extra: Grant[];
  accent?: string;
}

const isEquipmentChoice = (g: Grant) => g.type === "choice" && g.id === "equipment" && g.from.kind === "options";

export function backgroundToForm(e: BackgroundEntity | undefined, locale: "en" | "zh"): BackgroundForm {
  const f: BackgroundForm = { id: e?.id ?? newLocalId("background"), name: plain(e?.name, locale), summary: plain(e?.summary, locale), text: plain(e?.text, locale), abilities: [], feat: "", skills: [], tools: [], kit: [], kitGold: 0, altGold: 50, extra: [], accent: e?.accent };
  for (const g of e?.grants ?? []) {
    if (g.type === "choice" && g.from.kind === "ability") f.abilities = [...g.from.abilities];
    else if (g.type === "grant" && g.entity.startsWith("feat:") && !f.feat) f.feat = g.entity;
    else if (g.type === "proficiency" && g.kind === "skill") f.skills.push(g.key);
    else if (g.type === "proficiency" && g.kind === "tool") f.tools.push(g.key);
    else if (isEquipmentChoice(g) && g.type === "choice" && g.from.kind === "options") {
      const [kit, alt] = g.from.options;
      for (const it of kit?.grants ?? []) {
        if (it.type !== "item") continue;
        if (it.item === "item:gp") f.kitGold += it.qty ?? 1;
        else f.kit.push({ item: it.item, qty: it.qty ?? 1, ...(it.equipped ? { equipped: true } : {}) });
      }
      const altGold = alt?.grants.find((x) => x.type === "item" && x.item === "item:gp");
      if (altGold?.type === "item") f.altGold = altGold.qty ?? 0;
    } else f.extra.push(g);
  }
  return f;
}

export function formToBackground(f: BackgroundForm): BackgroundEntity {
  const grants: Grant[] = [];
  if (f.abilities.length)
    grants.push({
      type: "choice",
      id: "ability",
      name: { en: "Ability Scores", zh: "属性值" },
      text: { en: "Increase one score by 2 and another by 1, or three scores by 1 (max 20).", zh: "一项属性 +2、另一项 +1，或三项各 +1（上限 20）。" },
      count: 1,
      from: { kind: "ability", abilities: f.abilities, patterns: [[2, 1], [1, 1, 1]], cap: 20 },
    });
  if (f.feat) grants.push({ type: "grant", entity: f.feat });
  for (const key of f.skills) grants.push({ type: "proficiency", kind: "skill", key });
  for (const key of f.tools) grants.push({ type: "proficiency", kind: "tool", key });
  if (f.kit.length || f.kitGold || f.altGold) {
    const kitItems: Grant[] = [...f.kit.map((k): Grant => ({ type: "item", item: k.item, qty: k.qty, ...(k.equipped ? { equipped: true } : {}) })), ...(f.kitGold ? [{ type: "item", item: "item:gp", qty: f.kitGold } as Grant] : [])];
    grants.push({
      type: "choice",
      id: "equipment",
      name: { en: "Starting Equipment", zh: "起始装备" },
      count: 1,
      from: {
        kind: "options",
        options: [
          { id: "a", name: { en: "Kit", zh: "装备包" }, grants: kitItems },
          { id: "b", name: { en: `${f.altGold} GP`, zh: `${f.altGold} 金币` }, grants: [{ type: "item", item: "item:gp", qty: f.altGold }] },
          { id: "custom", name: { en: "Custom", zh: "自定义" }, text: { en: "Assemble your own gear under Equipment & Inventory.", zh: "在「装备与背包」中自行添加。" }, grants: [] },
        ],
      },
    });
  }
  grants.push(...f.extra);
  return {
    id: f.id,
    type: "background",
    name: L(f.name || "?"),
    summary: f.summary ? L(f.summary) : undefined,
    text: f.text ? L(f.text) : undefined,
    accent: f.accent,
    tags: ["homebrew"],
    grants,
  };
}

export interface Trait {
  name: string;
  text: string;
}

export interface SpeciesForm {
  id: string;
  name: string;
  summary: string;
  text: string;
  sizes: ("small" | "medium" | "large")[];
  speed: number;
  darkvision: number;
  skills: string[];
  resist: string[];
  spells: string[];
  traits: Trait[];
  extra: Grant[];
  accent?: string;
}

const SIZE_NAMES = { small: ["Small", "小型"], medium: ["Medium", "中型"], large: ["Large", "大型"] } as const;

export function speciesToForm(e: SpeciesEntity | undefined, locale: "en" | "zh"): SpeciesForm {
  const sizeText = typeof e?.size === "object" ? e.size.en : (e?.size ?? "Medium");
  const sizes = (["small", "medium", "large"] as const).filter((s) => sizeText.toLowerCase().includes(s));
  const f: SpeciesForm = { id: e?.id ?? newLocalId("species"), name: plain(e?.name, locale), summary: plain(e?.summary, locale), text: plain(e?.text, locale), sizes: sizes.length ? [...sizes] : ["medium"], speed: e?.speed ?? 30, darkvision: 0, skills: [], resist: [], spells: [], traits: [], extra: [], accent: e?.accent };
  for (const g of e?.grants ?? []) {
    if (g.type === "modifier" && g.target === "sense.darkvision" && typeof g.value === "number") f.darkvision = g.value;
    else if (g.type === "proficiency" && g.kind === "skill") f.skills.push(g.key);
    else if (g.type === "tag" && g.tag.startsWith("resist:")) f.resist.push(g.tag.slice(7));
    else if (g.type === "spell" && !g.minLevel && !g.free) f.spells.push(g.spell);
    else if (g.type === "feature" && !g.grants?.length && !g.minLevel) f.traits.push({ name: plain(g.name, locale), text: plain(g.text, locale) });
    else f.extra.push(g);
  }
  return f;
}

export function formToSpecies(f: SpeciesForm): SpeciesEntity {
  const grants: Grant[] = [];
  if (f.darkvision > 0) grants.push({ type: "modifier", target: "sense.darkvision", op: "atLeast", value: f.darkvision, label: { en: "Darkvision", zh: "黑暗视觉" } });
  for (const key of f.skills) grants.push({ type: "proficiency", kind: "skill", key });
  for (const d of f.resist) grants.push({ type: "tag", tag: `resist:${d}`, label: { en: `Resistance: ${d}`, zh: `抗性：${d}` } });
  for (const s of f.spells) grants.push({ type: "spell", spell: s, alwaysPrepared: true });
  f.traits.forEach((tr, i) => tr.name && grants.push({ type: "feature", id: `trait-${i + 1}`, name: L(tr.name), text: tr.text ? L(tr.text) : undefined }));
  grants.push(...f.extra);
  const sizes = f.sizes.length ? f.sizes : (["medium"] as const);
  return {
    id: f.id,
    type: "species",
    name: L(f.name || "?"),
    summary: f.summary ? L(f.summary) : undefined,
    text: f.text ? L(f.text) : undefined,
    size: { en: sizes.map((s) => SIZE_NAMES[s][0]).join(" or "), zh: sizes.map((s) => SIZE_NAMES[s][1]).join("或") },
    speed: f.speed,
    accent: f.accent,
    tags: ["homebrew"],
    grants,
  };
}

export const WEAPON_PROPS = ["ammunition", "finesse", "heavy", "light", "loading", "reach", "thrown", "two-handed", "versatile"] as const;
export const MASTERIES = ["cleave", "graze", "nick", "push", "sap", "slow", "topple", "vex"] as const;
export const RARITIES = ["common", "uncommon", "rare", "very-rare", "legendary", "artifact"] as const;

export interface ItemForm {
  id: string;
  name: string;
  text: string;
  itemType: "gear" | "weapon" | "armor" | "tool";
  weight: number;
  cost: string;
  /** Weapons */
  damage: string;
  damageType: string;
  weaponCategory: "simple" | "martial";
  weaponKind: "melee" | "ranged";
  properties: string[];
  range: string;
  versatile: string;
  mastery: string;
  /** Armor */
  ac: number;
  armorCategory: "light" | "medium" | "heavy" | "shield";
  /** Magic items: "" = mundane. */
  rarity: string;
  attunement: boolean;
  /** Mechanics that apply while the item is equipped. */
  grants: Grant[];
  /** Using it uses one up. */
  consumable: boolean;
  /** What using it does (drink, throw, read...); undefined = not usable. */
  use?: ItemEntity["use"];
}

export function itemToForm(e: ItemEntity | undefined, locale: "en" | "zh"): ItemForm {
  const tags = e?.tags ?? [];
  return {
    id: e?.id ?? newLocalId("item"),
    name: plain(e?.name, locale),
    text: plain(e?.text, locale),
    itemType: (["gear", "weapon", "armor", "tool"].includes(e?.itemType ?? "") ? e?.itemType : "gear") as ItemForm["itemType"],
    weight: e?.weight ?? 0,
    cost: e?.cost ?? "",
    damage: e?.weapon?.damage ?? "1d6",
    damageType: e?.weapon?.damageType ?? "slashing",
    weaponCategory: e?.weapon?.category ?? "simple",
    weaponKind: e?.weapon?.kind ?? "melee",
    properties: e?.weapon?.properties ?? [],
    range: e?.weapon?.range ?? "",
    versatile: e?.weapon?.versatile ?? "",
    mastery: e?.weapon?.mastery ?? "",
    ac: e?.armor?.ac ?? 11,
    armorCategory: (e?.armor?.category as ItemForm["armorCategory"]) ?? "light",
    rarity: tags.find((t) => t.startsWith("rarity:"))?.slice(7) ?? "",
    attunement: tags.includes("attunement"),
    grants: e?.grants ?? [],
    consumable: !!e?.consumable,
    use: e?.use,
  };
}

export function formToItem(f: ItemForm, base?: ItemEntity, locale: "en" | "zh" = "zh"): ItemEntity {
  const keptTags = (base?.tags ?? []).filter((t) => !t.startsWith("rarity:") && t !== "attunement" && t !== "magic" && !["gear", "weapon", "armor", "tool", "homebrew"].includes(t));
  const tags = [...new Set(["homebrew", f.itemType, ...keptTags, ...(f.rarity ? ["magic", `rarity:${f.rarity}`] : []), ...(f.attunement ? ["attunement"] : [])])];
  const out: ItemEntity = {
    ...(base ?? {}),
    id: f.id,
    type: "item",
    // keep pack / focus types the form doesn't offer
    itemType: base && !["gear", "weapon", "armor", "tool"].includes(base.itemType) && f.itemType === "gear" ? base.itemType : f.itemType,
    name: keepL(base?.name, locale, f.name) ?? L("?"),
    text: keepL(base?.text, locale, f.text),
    weight: f.weight || undefined,
    cost: f.cost || undefined,
    tags: f.consumable ? [...tags, "consumable"] : tags.filter((x) => x !== "consumable"),
    grants: f.grants.length ? f.grants : undefined,
    consumable: f.consumable || undefined,
    use: f.use,
  } as ItemEntity;
  if (f.itemType === "weapon")
    out.weapon = {
      ...(base?.weapon ?? {}),
      category: f.weaponCategory,
      kind: f.weaponKind,
      damage: f.damage,
      damageType: f.damageType,
      properties: f.properties,
      range: f.range || undefined,
      versatile: f.properties.includes("versatile") ? f.versatile || undefined : undefined,
      mastery: f.mastery || undefined,
    };
  else delete out.weapon;
  if (f.itemType === "armor") out.armor = { ...(base?.armor ?? {}), category: f.armorCategory, ac: f.ac, dexCap: f.armorCategory === "medium" ? 2 : f.armorCategory === "heavy" ? 0 : undefined } as ItemEntity["armor"];
  else delete out.armor;
  return out;
}

export const isLocalId = (id: string) => id.includes(":local-");
export type { Entity };
