import type { Entity, EntityType, LocalizedText } from "@forge/core";
import { defaultClassForm, formToClass, formToSubclass, slugOf } from "./classTemplate";
import { featToForm, formToFeat, formToRule, formToSpell, ruleToForm, spellToForm } from "./contentTemplates";
import { backgroundToForm, formToBackground, formToItem, formToSpecies, itemToForm, newLocalId, speciesToForm } from "./templates";

/** Entity types the Workshop can author. */
export const WORKSHOP_TYPES = ["class", "subclass", "spell", "feat", "species", "background", "item", "rule"] as const satisfies readonly EntityType[];
export type WorkshopType = (typeof WORKSHOP_TYPES)[number];
export const isWorkshopType = (t: string): t is WorkshopType => (WORKSHOP_TYPES as readonly string[]).includes(t);

/** A new, valid entity of the type, with `preset` fields (spell level and list, parent class...) merged in. */
export function blankEntity(type: WorkshopType, preset: Partial<Entity> | undefined, locale: "en" | "zh"): Entity {
  const id = newLocalId(type);
  const e: Entity = (() => {
    switch (type) {
      case "class":
        return formToClass(defaultClassForm(id), undefined, locale);
      case "subclass":
        return formToSubclass({ id, name: "", summary: "", text: "", classId: "class:fighter", levels: {}, tags: [] }, undefined, locale);
      case "spell":
        return formToSpell({ ...spellToForm(undefined, locale), id }, undefined, locale);
      case "feat":
        return formToFeat({ ...featToForm(undefined, locale), id }, undefined, locale);
      case "rule":
        return formToRule({ ...ruleToForm(undefined, locale), id }, undefined, locale);
      case "background":
        return formToBackground({ ...backgroundToForm(undefined, locale), id });
      case "species":
        return formToSpecies({ ...speciesToForm(undefined, locale), id });
      case "item":
        return formToItem({ ...itemToForm(undefined, locale), id }, undefined, locale);
    }
  })();
  const merged = { ...e, ...(preset ?? {}), id } as Entity;
  // a subclass preset only names the class: derive the tag the class's choice filters on
  if (merged.type === "subclass") merged.tags = [slugOf(merged.classId)];
  return merged;
}

const suffix = (name: LocalizedText, mark: string): LocalizedText =>
  typeof name === "string" ? `${name}${mark}` : Object.fromEntries(Object.entries(name).map(([k, v]) => [k, `${v}${mark}`])) as LocalizedText;

/**
 * Copy under a new id. Class formulas refer to the class by id (`@class.fighter.level`,
 * `@spell.fighter.dc`, the subclass choice's tag), so those references follow the copy.
 */
export function cloneEntity(base: Entity): Entity {
  const id = newLocalId(base.type);
  let json = JSON.stringify(base);
  if (base.type === "class") {
    const from = slugOf(base.id);
    const to = slugOf(id);
    const esc = from.replace(/[-]/g, "\\-");
    json = json
      .replace(new RegExp(`@class\\.${esc}\\.`, "g"), `@class.${to}.`)
      .replace(new RegExp(`@spell\\.${esc}\\.`, "g"), `@spell.${to}.`)
      .replace(new RegExp(`"classId":"class:${esc}"`, "g"), `"classId":"${id}"`);
  }
  const copy = JSON.parse(json) as Entity;
  if (copy.type === "class")
    for (const gs of Object.values(copy.levels))
      for (const g of gs) if (g.type === "choice" && g.id === "subclass" && g.from.kind === "entity") g.from.tags = [slugOf(id)];
  return { ...copy, id, name: suffix(base.name, "*"), source: base.id };
}

/** Same id: saved into a user pack, it replaces the original everywhere (a house rule). */
export const overrideEntity = (base: Entity): Entity => structuredClone(base);
