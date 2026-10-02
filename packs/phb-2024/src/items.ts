import type { Entity, ItemEntity, LocalizedText } from "@forge/core";
import type { PhbBenefit, PhbItem } from "./data";
import { bi, enOf, slug } from "./util";

/** PHB English name -> existing SRD id where the slugs differ. */
const ID_ALIAS: Record<string, string> = {
  "clothes-travelers": "travelers-clothes",
  "clothes-fine": "fine-clothes",
  warpick: "war-pick",
};

/** Variants listed inside the Gaming Set / Musical Instrument entries, in PHB order. */
const VARIANTS: Record<string, [id: string, en: string][]> = {
  "Gaming Set": [
    ["dice-set", "Dice Set"],
    ["dragonchess-set", "Dragonchess Set"],
    ["playing-cards", "Playing Card Set"],
    ["three-dragon-ante-set", "Three-Dragon Ante Set"],
  ],
  "Musical Instrument": [
    ["bagpipes", "Bagpipes"],
    ["drum", "Drum"],
    ["dulcimer", "Dulcimer"],
    ["flute", "Flute"],
    ["horn", "Horn"],
    ["lute", "Lute"],
    ["lyre", "Lyre"],
    ["pan-flute", "Pan Flute"],
    ["shawm", "Shawm"],
    ["viol", "Viol"],
  ],
};

export const itemId = (en: string) => `item:${ID_ALIAS[slug(en)] ?? slug(en)}`;

export interface ItemIndex {
  entities: Entity[];
  /** Chinese item name -> id (for parsing background kits). */
  byZh: Map<string, string>;
  /** "gaming" / "instrument" / "artisan" -> tool ids for "choose one ..." proficiencies. */
  toolGroups: Record<"gaming" | "instrument" | "artisan", string[]>;
}

export function buildItems(items: PhbItem[], masteries: PhbBenefit[] | undefined, base: Map<string, Entity>): ItemIndex {
  const out: Entity[] = [];
  const byZh = new Map<string, string>();
  const toolGroups: ItemIndex["toolGroups"] = { gaming: [], instrument: [], artisan: [] };
  const named = (id: string, en: string, zh: string): LocalizedText => bi(enOf(base.get(id)?.name) ?? en, zh);

  for (const it of items) {
    const id = itemId(it.en);
    const prev = base.get(id) as ItemEntity | undefined;
    byZh.set(it.zh, id);
    const common = { id, type: "item" as const, name: named(id, it.en, it.zh), cost: prev?.cost ?? it.cost ?? undefined, weight: prev?.weight ?? it.weight ?? undefined };
    if (it.kind === "weapon") {
      out.push({
        ...prev,
        ...common,
        itemType: "weapon",
        tags: prev?.tags ?? ["weapon", it.category, it.range, ...it.properties],
        weapon: prev?.weapon ?? {
          category: it.category,
          kind: it.range,
          damage: it.damage,
          damageType: it.damageType,
          properties: it.properties,
          mastery: it.mastery ?? undefined,
          range: it.rangeText ?? undefined,
          versatile: it.versatile ?? undefined,
        },
      });
    } else if (it.kind === "armor") {
      out.push({
        ...prev,
        ...common,
        itemType: "armor",
        tags: prev?.tags ?? ["armor", it.category],
        armor: prev?.armor ?? {
          category: it.category,
          ac: it.ac,
          dexCap: it.category === "medium" ? 2 : it.category === "heavy" ? 0 : undefined,
          strength: it.strength ?? undefined,
          stealthDisadvantage: it.stealthDisadvantage || undefined,
        },
      });
    } else {
      const itemType = prev?.itemType ?? (it.kind === "tool" ? "tool" : /Pack$/.test(it.en) ? "pack" : /Focus|Holy Symbol/.test(it.en) ? "focus" : "gear");
      const variants = VARIANTS[it.en];
      if (it.kind === "tool" && !variants) (/(Supplies|Tools|Utensils)$/.test(it.en) && !/Thieves|Navigator/.test(it.en) ? toolGroups.artisan : []).push(id);
      if (variants) {
        // the umbrella entry is just text; each variant becomes a real item
        const group = it.en === "Gaming Set" ? toolGroups.gaming : toolGroups.instrument;
        variants.forEach(([vid, ven], i) => {
          const v = it.variants?.[i];
          if (!v) return;
          const fullId = `item:${vid}`;
          group.push(fullId);
          byZh.set(v.zh, fullId);
          out.push({ ...base.get(fullId), id: fullId, type: "item", itemType: "tool", name: named(fullId, ven, v.zh), cost: v.cost ?? undefined, text: bi(undefined, it.text), tags: ["tool", it.en === "Gaming Set" ? "gaming-set" : "instrument"] } as Entity);
        });
        continue;
      }
      out.push({ ...prev, ...common, itemType, text: it.text ? bi(enOf(prev?.text), it.text) : prev?.text, tags: prev?.tags ?? [itemType] } as Entity);
    }
  }

  for (const m of masteries ?? []) {
    const id = `mastery:${slug(m.en ?? "")}`;
    const prev = base.get(id);
    if (prev) out.push({ ...prev, name: bi(enOf(prev.name), m.zh), text: bi(enOf(prev.text), m.text) });
  }
  return { entities: out, byZh, toolGroups };
}
