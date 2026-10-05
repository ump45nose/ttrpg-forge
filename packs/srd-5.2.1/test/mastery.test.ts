import { Engine, masteryFacts } from "@forge/core";
import { describe, expect, it } from "vitest";
import { srd52 } from "../src";

const engine = new Engine([srd52]);

describe("weapon mastery at the table", () => {
  const bren = srd52.samples!.find((s) => s.classId === "class:fighter")!;
  const c = engine.fromSample(bren, "zh");
  // pregens carry their kit unequipped in the inventory: give him every weapon he has the mastery of
  const { sheet } = engine.play(c);

  it("the attack carries the ability modifier it uses", () => {
    const sword = sheet.actions.find((a) => a.weapon && a.id.startsWith("weapon:") && a.weapon.properties.includes("heavy"))!;
    expect(sword.weapon!.mod).toBe(sheet.abilities.str.mod);
  });

  it("works out each property's numbers", () => {
    const withMastery = sheet.actions.filter((a) => a.weapon?.mastery);
    expect(withMastery.length).toBeGreaterThan(0);
    for (const a of withMastery) {
      const f = masteryFacts(a, sheet)!;
      expect(f.id).toBe(a.weapon!.mastery);
      if (f.id === "graze") expect(f.missDamage).toEqual({ amount: Math.max(0, a.weapon!.mod), type: a.damage![0]!.type });
      if (f.id === "topple") expect(f.save!.dc).toBe(8 + a.weapon!.mod + sheet.prof);
      if (f.id === "sap") expect(f.nextAttack).toBe("target-disadvantage");
      if (f.id === "slow") expect(f.feet).toBe(10);
    }
    expect(withMastery.some((a) => a.weapon!.mastery === "graze")).toBe(true);
  });

  it("no mastery, no facts", () => {
    const plain = sheet.actions.find((a) => !a.weapon?.mastery)!;
    expect(masteryFacts(plain, sheet)).toBeUndefined();
  });
});
