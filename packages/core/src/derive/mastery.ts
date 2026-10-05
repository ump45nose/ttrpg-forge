import type { ResolvedAction, Sheet } from "./sheet";

/** The numbers a weapon's mastery property needs at the table, worked out for this attack. */
export interface MasteryFacts {
  id: string;
  /** Graze: damage dealt on a miss (the attack's ability modifier). */
  missDamage?: { amount: number; type: string };
  /** Topple: the Constitution save the target makes. */
  save?: { ability: "con"; dc: number };
  /** Push / Slow: feet moved or taken away. */
  feet?: number;
  /** Who gets the edge on the next attack: Vex → you (advantage), Sap → the target (disadvantage). */
  nextAttack?: "you-advantage" | "target-disadvantage";
  /** Cleave / Nick: an extra attack, once per turn. */
  extraAttack?: "cleave" | "nick";
}

export function masteryFacts(action: ResolvedAction, sheet: Sheet): MasteryFacts | undefined {
  const m = action.weapon?.mastery;
  if (!m || !action.weapon) return undefined;
  const mod = action.weapon.mod;
  const type = action.damage?.[0]?.type ?? "";
  switch (m) {
    case "graze":
      return { id: m, missDamage: { amount: Math.max(0, mod), type } };
    case "topple":
      return { id: m, save: { ability: "con", dc: 8 + mod + sheet.prof } };
    case "push":
    case "slow":
      return { id: m, feet: 10 };
    case "vex":
      return { id: m, nextAttack: "you-advantage" };
    case "sap":
      return { id: m, nextAttack: "target-disadvantage" };
    case "cleave":
    case "nick":
      return { id: m, extraAttack: m };
    default:
      return { id: m };
  }
}
