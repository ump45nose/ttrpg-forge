import { Engine, type ChoiceCandidate } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { groupByMastery, masteryOf } from "./mastery";

const cand = (id: string): ChoiceCandidate => ({ id, name: id, selected: false, valid: true });

describe("weapon mastery picker", () => {
  const reg = new Engine([srd52]).reg;

  it("knows each weapon's property", () => {
    expect(masteryOf(reg, "item:longsword")).toBe("sap");
    expect(masteryOf(reg, "item:dagger")).toBe("nick");
    expect(masteryOf(reg, "item:nothing")).toBe("");
  });

  it("groups picks by the property they unlock, with the unknown ones last", () => {
    const groups = groupByMastery([cand("item:longsword"), cand("item:nothing"), cand("item:dagger"), cand("item:mace")], reg);
    expect(groups.map((g) => g.mastery)).toEqual(["sap", "nick", ""]);
    expect(groups[0]!.candidates.map((c) => c.id)).toEqual(["item:longsword", "item:mace"]);
  });

  it("every property has a description entity to show", () => {
    for (const m of ["cleave", "graze", "nick", "push", "sap", "slow", "topple", "vex"]) expect(reg.get(`mastery:${m}`)?.text).toBeTruthy();
  });
});
