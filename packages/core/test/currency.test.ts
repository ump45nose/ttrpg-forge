import { describe, expect, it } from "vitest";
import { formatCurrency, fromCp, parseCost, pay, toCp } from "../src";

describe("currency", () => {
  it("reads item prices", () => {
    expect(parseCost("10 GP")).toEqual({ gp: 10 });
    expect(parseCost("5 sp")).toEqual({ sp: 5 });
    expect(parseCost("1,500 GP")).toEqual({ gp: 1500 });
    expect(parseCost("0.5 GP")).toEqual({ sp: 5 });
    expect(parseCost(undefined)).toBeNull();
    expect(parseCost("—")).toBeNull();
  });

  it("converts through copper", () => {
    expect(toCp({ gp: 1, sp: 2, cp: 3, pp: 1, ep: 1 })).toBe(1000 + 100 + 50 + 20 + 3);
    expect(fromCp(1234)).toEqual({ gp: 12, sp: 3, cp: 4 });
  });

  it("pays with the coins that fit before breaking bigger ones", () => {
    // 1 gp owed: the gold piece goes, the copper stays
    expect(pay({ cp: 50, gp: 1 }, 100)).toEqual({ gp: -1 });
    // 5 sp from gold only: one gp is broken and 5 sp come back
    expect(pay({ gp: 3 }, 50)).toEqual({ gp: -1, sp: 5 });
    // mixed: 15 gp from 10 gp and a pile of silver
    expect(pay({ gp: 10, sp: 100 }, 1500)).toEqual({ gp: -10, sp: -50 });
    // 7 cp from 1 sp: change in copper
    expect(pay({ sp: 1 }, 7)).toEqual({ sp: -1, cp: 3 });
  });

  it("refuses what the purse can't cover", () => {
    expect(pay({ gp: 1 }, 101)).toBeNull();
    expect(pay({}, 0)).toEqual({});
  });

  it("formats a purse", () => {
    expect(formatCurrency({ gp: 15, sp: 5 })).toBe("15 gp 5 sp");
    expect(formatCurrency({})).toBe("0 gp");
  });
});
