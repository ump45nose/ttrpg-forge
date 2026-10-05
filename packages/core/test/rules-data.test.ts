import { describe, expect, it } from "vitest";
import { applyOps, Engine, parseRulePack, pointBuyCost, type RulePack } from "../src";
import { fixturePack } from "./fixture";

const houseRules = (over: Partial<RulePack>): RulePack => ({ id: "house", version: "1", system: "dnd5e-2024", name: "House", entities: [], ...over });

describe("system config", () => {
  it("defaults come from the base system", () => {
    const e = new Engine([fixturePack]);
    expect(e.reg.system.pointBuy.budget).toBe(27);
    expect(e.reg.system.profBonus(5)).toBe(3);
    expect(e.reg.system.cantripTier(5)).toBe(2);
    expect(e.reg.system.pactSlots(3)).toEqual({ count: 2, level: 2 });
  });

  it("packs deep-merge overrides in load order", () => {
    const a = houseRules({ id: "a", systemConfig: { pointBuy: { budget: 30 }, maxLevel: 8 } });
    const b = houseRules({ id: "b", systemConfig: { pointBuy: { max: 16 } } });
    const e = new Engine([fixturePack, a, b]);
    expect(e.reg.system.pointBuy).toMatchObject({ budget: 30, min: 8, max: 15 + 1 });
    expect(e.reg.system.pointBuy.cost[15]).toBe(9);
    expect(e.reg.system.maxLevel).toBe(8);
    expect(e.reg.statsOf("a")?.systemConfig).toBe(true);
  });

  it("point buy validation follows the configured budget", () => {
    const e = new Engine([fixturePack, houseRules({ systemConfig: { pointBuy: { budget: 30 } } })]);
    const scores = { str: 15, dex: 15, con: 15, int: 10, wis: 8, cha: 8 };
    expect(pointBuyCost(scores, e.reg.system)).toBe(29);
    const b = applyOps(e.newCharacter("x").build, [{ op: "setAbilities", method: "pointbuy", scores }]);
    expect(e.evaluate(b).issues.some((i) => i.code === "pointbuy-budget")).toBe(false);
    const base = new Engine([fixturePack]);
    expect(base.evaluate(b).issues.some((i) => i.code === "pointbuy-budget")).toBe(true);
  });

  it("raising the point-buy max continues the cost curve, so 16+ can be bought", () => {
    const e = new Engine([fixturePack, houseRules({ systemConfig: { pointBuy: { budget: 32, max: 17 } } })]);
    expect(e.reg.system.pointBuy.cost).toMatchObject({ 15: 9, 16: 12, 17: 15 });
    const scores = { str: 17, dex: 14, con: 13, int: 10, wis: 8, cha: 8 };
    expect(pointBuyCost(scores, e.reg.system)).toBe(29);
    const b = applyOps(e.newCharacter("x").build, [{ op: "setAbilities", method: "pointbuy", scores }]);
    const codes = e.evaluate(b).issues.map((i) => i.code);
    expect(codes).not.toContain("pointbuy-range");
    expect(codes).not.toContain("pointbuy-budget");
    // the default rules still stop at 15, and say so
    const range = new Engine([fixturePack]).evaluate(b).issues.find((i) => i.code === "pointbuy-range");
    expect(range?.message).toMatchObject({ en: "Point buy scores must be 8–15" });
  });

  it("costs a pack writes itself win over the continued curve", () => {
    const e = new Engine([fixturePack, houseRules({ systemConfig: { pointBuy: { max: 16, cost: { 16: 10 } } } })]);
    expect(e.reg.system.pointBuy.cost[16]).toBe(10);
  });

  it("HP house rule: max hit die every level", () => {
    const ops = [{ op: "setClass", id: "class:fighter" } as const, { op: "setLevel", level: 3 } as const];
    const avg = new Engine([fixturePack]);
    const max = new Engine([fixturePack, houseRules({ systemConfig: { hp: { levelUp: "max" } } })]);
    const b = applyOps(avg.newCharacter("x").build, ops);
    // con 13 (+1): avg 10+6+6+3 = 25, max 10+10+10+3 = 33
    expect(avg.evaluate(b).sheet.hpMax).toBe(25);
    expect(max.evaluate(b).sheet.hpMax).toBe(33);
  });
});

describe("entity patches", () => {
  it("set merges fields and grant edits add/remove", () => {
    const pack = houseRules({
      patches: [
        { target: "class:fighter", set: { hitDie: 12, id: "hacked" }, levels: { "2": { remove: [{ type: "feature", id: "action-surge" }] } } },
        { target: "species:dwarf", grants: { remove: [{ type: "tag", id: "resist:poison" }], add: [{ type: "tag", tag: "resist:fire" }] } },
        { target: "class:nope" },
      ],
    });
    const e = new Engine([fixturePack, pack]);
    const f = e.reg.getOf("class", "class:fighter")!;
    expect(f.hitDie).toBe(12);
    expect(f.id).toBe("class:fighter");
    expect(f.levels["2"]).toEqual([]);
    const tags = e.reg.getOf("species", "species:dwarf")!.grants!.filter((g) => g.type === "tag");
    expect(tags).toEqual([{ type: "tag", tag: "resist:fire" }]);
    expect(e.reg.statsOf("house")).toMatchObject({ patches: 2, missingTargets: ["class:nope"] });
    // the source pack is untouched
    expect(fixturePack.entities.find((x) => x.id === "class:fighter")).toMatchObject({ hitDie: 10 });
  });

  it("patched content flows into the sheet", () => {
    const e = new Engine([fixturePack, houseRules({ patches: [{ target: "class:fighter", set: { hitDie: 12 } }] })]);
    const b = applyOps(e.newCharacter("x").build, [{ op: "setClass", id: "class:fighter" }]);
    expect(e.evaluate(b).sheet.hpMax).toBe(13);
  });

  it("override counts are reported", () => {
    const e = new Engine([fixturePack, houseRules({ entities: [{ id: "species:human", type: "species", name: "Human+", size: "Medium", speed: 35 }] })]);
    expect(e.reg.statsOf("house")).toMatchObject({ entities: 1, overrides: 1 });
    expect(e.reg.packOf("species:human")).toBe("house");
  });

  it("zod accepts packs with config and patches", () => {
    const r = parseRulePack(houseRules({ systemConfig: { maxLevel: 8, pointBuy: { budget: 30 } }, patches: [{ target: "x", levels: { "3": { add: [] } } }] }));
    expect(r.ok).toBe(true);
    expect(parseRulePack(houseRules({ systemConfig: { maxLevel: 0 } })).ok).toBe(false);
  });
});

describe("start level", () => {
  it("first class pick creates the planned number of levels", () => {
    const e = new Engine([fixturePack]);
    const c = e.newCharacter("x", { level: 3 });
    const b = applyOps(c.build, [{ op: "setClass", id: "class:fighter" }]);
    expect(b.levels).toHaveLength(3);
    expect(e.evaluate(b).sheet.choices.some((ch) => ch.path.endsWith("/subclass"))).toBe(true);
    // switching class keeps the level count
    expect(applyOps(b, [{ op: "setClass", id: "class:wizard" }]).levels).toHaveLength(3);
  });

  it("is clamped to the system level cap", () => {
    const e = new Engine([fixturePack, houseRules({ systemConfig: { maxLevel: 8 } })]);
    expect(e.newCharacter("x", { level: 12 }).build.startLevel).toBe(8);
  });
});
