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
