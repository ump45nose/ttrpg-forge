import type { ActionDef, Grant } from "@forge/core";
import { srdHelpers } from "@forge/pack-srd52";
import type { PhbSubclass } from "./data";
import { slug } from "./util";

/**
 * Mechanics for PHB subclasses the SRD doesn't have. Only ids, numbers and short action names live
 * here; every feature's name and full text are attached from the generated PHB data by matching
 * the feature id against the slug of its English heading.
 */
export interface OverlayContext {
  sc: PhbSubclass;
  artisan: string[];
  classSkills: string[];
}
export type SubclassOverlay = (ctx: OverlayContext) => Record<string, Grant[]>;

/** Feature placeholder: name/text come from the PHB. */
export const f = (en: string, grants: Grant[] = []): Grant => ({ type: "feature", id: slug(en), name: { en, zh: en }, grants });
export const act = (a: Omit<ActionDef, "category"> & { category?: ActionDef["category"] }): Grant => srdHelpers.action({ category: "feature", ...a });

/** A feature that also carries feature tags (e.g. "attacks:2" for Extra Attack). */
export const tagged = (g: Grant, tags: string[]): Grant => ({ ...g, tags } as Grant);
