import { Engine, makeEvent, type Character, type NewEvent } from "@forge/core";
import { describe, expect, it } from "vitest";
import { srd52 } from "../src";

const engine = new Engine([srd52]);
const bren = engine.fromSample(srd52.samples!.find((s) => s.classId === "class:fighter")!, "zh");
const withEvents = (c: Character, ...evs: NewEvent[]): Character => ({ ...c, play: [...c.play, ...evs.map((e, i) => makeEvent(e, 1_800_000_000_000 + i))] });

describe("buffs", () => {
  it("dice buffs reach the sheet while active, and only then", () => {
    expect(engine.play(bren).sheet.dice).toEqual([]);
    const blessed = engine.play(withEvents(bren, { type: "effect.add", effect: "effect:bless" })).sheet;
    expect(blessed.dice).toMatchObject([{ on: ["attack", "save"], dice: "1d4", label: { zh: "祝福术" } }]);
    const marked = engine.play(withEvents(bren, { type: "effect.add", effect: "effect:bless" }, { type: "effect.add", effect: "effect:hunters-mark" })).sheet;
    expect(marked.dice.map((d) => [d.dice, d.damageType])).toEqual([
      ["1d4", undefined],
      ["1d6", "force"],
    ]);
  });

  it("a persistent buff stays through a long rest; an ordinary one ends", () => {
    const c = withEvents(bren, { type: "effect.add", effect: "effect:bless" }, { type: "effect.add", effect: "effect:mage-armor", persistent: true }, { type: "combat.start" }, { type: "combat.end" }, { type: "rest", kind: "long" });
    expect(engine.play(c).state.effects.map((e) => e.effect)).toEqual(["effect:mage-armor"]);
  });

  it("every class has suggested buffs, and every buff entry is valid", () => {
    const effects = srd52.entities.filter((e) => e.type === "effect" && e.tags?.includes("buff"));
    const suggested = new Set(effects.flatMap((e) => e.tags!.filter((x) => x.startsWith("suggest:")).map((x) => x.slice(8))));
    expect(suggested).toContain("all");
    for (const cls of ["barbarian", "cleric", "druid", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"]) expect(suggested, cls).toContain(cls);
  });
});
