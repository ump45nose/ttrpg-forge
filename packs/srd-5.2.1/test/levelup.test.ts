import { applyOps, Engine, hpCurrent, makeEvent, PackRegistry, type Character } from "@forge/core";
import { describe, expect, it } from "vitest";
import { srd52 } from "../src";
import { quickBuild } from "./autofill";

const engine = new Engine([srd52]);

function hero(level: number): Character {
  const c = engine.newCharacter("Test");
  c.build = quickBuild(engine, "class:fighter", "subclass:champion", level);
  return c;
}

describe("level up at the table", () => {
  it("average HP: one more fighter level, current HP rises by the same amount", () => {
    const c = hero(3);
    c.play.push(makeEvent({ type: "hp.damage", amount: 7 }, 1));
    const before = engine.play(c);
    c.build = applyOps(c.build, engine.levelUpOps(c.build));
    const after = engine.play(c);
    const con = before.sheet.abilities.con.mod;
    expect(after.sheet.level).toBe(4);
    expect(after.sheet.hpMax - before.sheet.hpMax).toBe(6 + con); // d10 average
    expect(hpCurrent(after.state, after.sheet) - hpCurrent(before.state, before.sheet)).toBe(6 + con);
    // a new level-4 choice (Ability Score Improvement / feat) shows up as pending
    expect(after.sheet.choices.some((ch) => ch.path.includes("@4") && ch.remaining > 0)).toBe(true);
  });

  it("rolled HP is stored on the level and only that level", () => {
    const c = hero(3);
    const hp3 = engine.evaluate(c.build).sheet.hpMax;
    const b = applyOps(c.build, engine.levelUpOps(c.build, 2));
    expect(b.hpMethod).toBe("rolled");
    expect(b.levels.at(-1)).toEqual({ classId: "class:fighter", hp: 2 });
    const con = engine.evaluate(b).sheet.abilities.con.mod;
    expect(engine.evaluate(b).sheet.hpMax - hp3).toBe(2 + con);
  });

  it("max HP at level-up, and switching from max to rolled keeps the earlier levels' max", () => {
    const c = hero(3);
    const avg3 = engine.evaluate(c.build).sheet.hpMax;
    const max3 = engine.evaluate(applyOps(c.build, engine.hpMethodOps(c.build, "max"))).sheet.hpMax;
    expect(max3 - avg3).toBe(2 * (10 - 6)); // fighter d10: levels 2 and 3 at 10 instead of 6
    const maxBuild = applyOps(c.build, engine.hpMethodOps(c.build, "max"));
    // a max level-up on a max build is just another level
    expect(engine.levelUpOps(maxBuild, "max")).toEqual([{ op: "addLevel", classId: "class:fighter" }]);
    const rolled = applyOps(maxBuild, engine.levelUpOps(maxBuild, 3));
    expect(rolled.hpMethod).toBe("rolled");
    expect(rolled.levels.map((l) => l.hp)).toEqual([undefined, 10, 10, 3]);
    const con = engine.evaluate(rolled).sheet.abilities.con.mod;
    expect(engine.evaluate(rolled).sheet.hpMax - max3).toBe(3 + con);
  });

  it("building with rolled HP records each level's die; average clears them", () => {
    const c = hero(4);
    const rolled = applyOps(c.build, engine.hpMethodOps(c.build, "rolled", [7, undefined, 2]));
    expect(rolled.levels.map((l) => l.hp)).toEqual([undefined, 7, undefined, 2]);
    // a level without a roll counts as average (6 for a d10)
    const avg = engine.evaluate(c.build).sheet.hpMax;
    expect(engine.evaluate(rolled).sheet.hpMax - avg).toBe(7 - 6 + (2 - 6));
    const back = applyOps(rolled, engine.hpMethodOps(rolled, "average"));
    expect(back.levels.every((l) => l.hp === undefined)).toBe(true);
    expect(engine.evaluate(back).sheet.hpMax).toBe(avg);
  });

  it("stops at the level cap; house rule 'max HP' ignores the roll", () => {
    const capped = hero(engine.levelCap(hero(1).build));
    expect(engine.levelUpOps(capped.build)).toEqual([]);
    const maxRule = new Engine(new PackRegistry([srd52, { ...emptyPack, systemConfig: { hp: { firstLevel: "max", levelUp: "max" } } }]));
    const c = hero(3);
    const b = applyOps(c.build, maxRule.levelUpOps(c.build, 1));
    expect(b.levels.at(-1)?.hp).toBeUndefined();
    expect(maxRule.evaluate(b).sheet.hpMax - maxRule.evaluate(c.build).sheet.hpMax).toBe(10 + engine.evaluate(b).sheet.abilities.con.mod);
  });
});

const emptyPack = { id: "test:max-hp", version: "1.0.0", system: srd52.system, name: { en: "Max HP" }, license: "test", entities: [] };
