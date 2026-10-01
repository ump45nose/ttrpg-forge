import { describe, expect, it } from "vitest";
import { diceStats, parseDice, presetRng, roll, seededRng, DiceError } from "../src";

describe("dice", () => {
  it("parses expressions", () => {
    expect(parseDice("2d6+3")).toEqual([
      { kind: "dice", sign: 1, count: 2, sides: 6 },
      { kind: "const", sign: 1, value: 3 },
    ]);
    expect(parseDice("4d6dl1")[0]).toMatchObject({ count: 4, sides: 6, keep: { mode: "dl", n: 1 } });
    expect(parseDice("d%")[0]).toMatchObject({ count: 1, sides: 100 });
    expect(() => parseDice("2x6")).toThrow(DiceError);
    expect(() => parseDice("")).toThrow(DiceError);
  });
  it("rolls with preset dice", () => {
    const r = roll("1d20+5", { rng: presetRng([17]) });
    expect(r.total).toBe(22);
    expect(r.natural).toBe(17);
    expect(r.crit).toBe(false);
  });
  it("advantage keeps highest, disadvantage lowest", () => {
    expect(roll("1d20+2", { advantage: true, rng: presetRng([4, 15]) }).total).toBe(17);
    expect(roll("1d20+2", { disadvantage: true, rng: presetRng([4, 15]) }).total).toBe(6);
    const both = roll("1d20", { advantage: true, disadvantage: true, rng: presetRng([9]) });
    expect(both.terms[0]).toMatchObject({ count: 1 });
  });
  it("nat 20 crit and custom crit range", () => {
    expect(roll("1d20", { rng: presetRng([20]) }).crit).toBe(true);
    expect(roll("1d20", { rng: presetRng([19]), critRange: 19 }).crit).toBe(true);
    expect(roll("1d20", { rng: presetRng([1]) }).fumble).toBe(true);
  });
  it("crit doubles dice, not modifiers", () => {
    const r = roll("1d8+3", { crit: true, rng: presetRng([5, 6]) });
    expect(r.total).toBe(14);
  });
  it("4d6 drop lowest", () => {
    const r = roll("4d6dl1", { rng: presetRng([3, 1, 6, 4]) });
    expect(r.total).toBe(13);
  });
  it("seeded rng is in range and deterministic", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 200; i++) {
      const x = a(20);
      expect(x).toBe(b(20));
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(20);
    }
  });
  it("stats", () => {
    expect(diceStats("2d6+3")).toEqual({ min: 5, max: 15, avg: 10 });
  });
});
