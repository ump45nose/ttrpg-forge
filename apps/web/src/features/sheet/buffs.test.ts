import { Engine } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { quickBuffs, suggestedBuffs } from "./buffs";

const engine = new Engine([srd52]);
const sample = (cls: string) => engine.fromSample(srd52.samples!.find((s) => s.classId === `class:${cls}`)!, "zh");

describe("quick buffs", () => {
  it("suggests the class's own buffs first, then everyone's", () => {
    const c = sample("cleric");
    const s = suggestedBuffs(engine.reg, engine.play(c).sheet);
    expect(s.slice(0, 2)).toEqual(["effect:shield-of-faith", "effect:bless"]);
    expect(s).toContain("effect:guidance");
    expect(s.length).toBeLessThanOrEqual(6);
  });

  it("a character's own list wins over the suggestion, and unknown ids drop out", () => {
    const c = sample("fighter");
    const own = { ...c, meta: { ...c.meta, quickBuffs: [{ effect: "effect:haste", persistent: true }, { effect: "effect:gone" }] } };
    expect(quickBuffs(own, engine.reg, engine.play(own).sheet)).toEqual([{ effect: "effect:haste", persistent: true }]);
    expect(quickBuffs(c, engine.reg, engine.play(c).sheet).map((b) => b.effect)).toEqual(["effect:bless", "effect:guidance"]);
  });
});
