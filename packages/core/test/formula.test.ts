import { describe, expect, it } from "vitest";
import { evaluate, formulaRefs, resolveTemplate, FormulaError } from "../src";

const vars: Record<string, number> = { "ability.dex.mod": 3, prof: 2, "class.cleric.level": 5, "skill.sleight-of-hand": 7, "equipped.armor": 0 };
const r = (p: string) => vars[p];

describe("formula", () => {
  it("arithmetic & precedence", () => {
    expect(evaluate("10 + @ability.dex.mod * 2", r)).toBe(16);
    expect(evaluate("(10 + @ability.dex.mod) * 2", r)).toBe(26);
    expect(evaluate("-@prof + 1", r)).toBe(-1);
    expect(evaluate("7 / 2", r)).toBe(3.5);
    expect(evaluate("floor(7 / 2)", r)).toBe(3);
  });
  it("booleans, comparisons, ternary", () => {
    expect(evaluate("!@equipped.armor && @ability.dex.mod >= 3", r)).toBe(1);
    expect(evaluate("@class.cleric.level >= 6 ? 3 : 2", r)).toBe(2);
    expect(evaluate("if(@prof == 2, 10, 20)", r)).toBe(10);
  });
  it("hyphenated refs vs minus", () => {
    expect(evaluate("@skill.sleight-of-hand", r)).toBe(7);
    expect(evaluate("@prof-1", r)).toBe(1);
  });
  it("table()", () => {
    expect(evaluate("table(@class.cleric.level, 4,5,6,7,9,10)", r)).toBe(9);
    expect(evaluate("table(99, 1,2,3)", r)).toBe(3);
    expect(evaluate("table(0, 1,2,3)", r)).toBe(1);
  });
  it("errors", () => {
    expect(() => evaluate("@nope", r)).toThrow(FormulaError);
    expect(evaluate("@nope + 1", r, { onUnknown: () => 0 })).toBe(1);
    expect(() => evaluate("1 +", r)).toThrow(FormulaError);
    expect(() => evaluate("evil(1)", r)).toThrow(/Unknown function/);
  });
  it("refs & templates", () => {
    expect(formulaRefs("max(@a.b, @c) + @a.b").sort()).toEqual(["a.b", "c"]);
    expect(resolveTemplate("1d8 + @ability.dex.mod", r)).toBe("1d8 + 3");
    expect(resolveTemplate("[[@prof * 2]]d6", r)).toBe("4d6");
    expect(resolveTemplate("1d4 + @neg", (p) => (p === "neg" ? -1 : undefined))).toBe("1d4 - 1");
  });
});
