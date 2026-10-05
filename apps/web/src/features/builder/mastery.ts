import type { ChoiceCandidate, PackRegistry } from "@forge/core";

export interface MasteryGroup {
  /** Mastery property id ("sap", "vex"...), or "" for weapons without one. */
  mastery: string;
  candidates: ChoiceCandidate[];
}

/** The mastery property a weapon item carries ("sap" for a longsword). */
export const masteryOf = (reg: PackRegistry, itemId: string): string => {
  const e = reg.get(itemId);
  return (e?.type === "item" && e.weapon?.mastery) || "";
};

/**
 * Weapon-mastery picks grouped by the property they unlock, so each group can say once
 * what that property does. Groups follow the order the properties first appear.
 */
export function groupByMastery(candidates: ChoiceCandidate[], reg: PackRegistry): MasteryGroup[] {
  const groups = new Map<string, ChoiceCandidate[]>();
  for (const c of candidates) {
    const m = masteryOf(reg, c.id);
    groups.set(m, [...(groups.get(m) ?? []), c]);
  }
  const out = [...groups].map(([mastery, cs]) => ({ mastery, candidates: cs }));
  // weapons without a property last
  return [...out.filter((g) => g.mastery), ...out.filter((g) => !g.mastery)];
}
