import { describe, expect, it } from "vitest";
import {
  applyOps,
  canUse,
  concentrationDC,
  emptyBuild,
  Engine,
  hpCurrent,
  makeEvent,
  redoTarget,
  resourceRemaining,
  slotsRemaining,
  undoTarget,
  type Character,
  type NewEvent,
} from "../src";
import { fixturePack } from "./fixture";

const engine = new Engine([fixturePack]);

function character(classId: "class:fighter" | "class:wizard", level: number): Character {
  const c = engine.newCharacter("Test");
  c.build = applyOps(emptyBuild(), [
    { op: "setSpecies", id: "species:dwarf" },
    { op: "setClass", id: classId },
    { op: "setLevel", level },
    {
      op: "setChoice",
      path: "class:wizard@1/spellbook",
      selected: ["spell:magic-missile", "spell:shield", "spell:sleep", "spell:detect-magic", "spell:mage-armor", "spell:burning-hands"],
    },
    { op: "setPrepared", classId: "class:wizard", spells: ["spell:magic-missile", "spell:sleep", "spell:detect-magic"] },
  ]);
  return c;
}

let t = 1_700_000_000_000;
const push = (c: Character, e: NewEvent) => {
  const ev = makeEvent(e, t++);
  c.play.push(ev);
  return ev;
};

describe("play: hp", () => {
  it("damage, temp hp absorb first, heal caps at max", () => {
    const c = character("class:fighter", 1);
    const max = engine.play(c).sheet.hpMax; // 10 + 1 con + 1 toughness
    expect(max).toBe(12);
    push(c, { type: "hp.damage", amount: 4 });
    push(c, { type: "hp.temp", amount: 5 });
    push(c, { type: "hp.temp", amount: 3 }); // temp hp don't stack
    push(c, { type: "hp.damage", amount: 7 });
    let { sheet, state } = engine.play(c);
    expect(state.temp).toBe(0);
    expect(hpCurrent(state, sheet)).toBe(12 - 4 - 2);
    push(c, { type: "hp.damage", amount: 99 });
    ({ sheet, state } = engine.play(c));
    expect(hpCurrent(state, sheet)).toBe(0);
    push(c, { type: "hp.heal", amount: 3 });
    ({ sheet, state } = engine.play(c));
    expect(hpCurrent(state, sheet)).toBe(3);
  });
});

describe("play: resources & rests", () => {
  it("actions spend resources, block when empty, rests restore", () => {
    const c = character("class:fighter", 2);
    const { sheet } = engine.play(c);
    const sw = sheet.actions.find((a) => a.name === "Second Wind")!;
    push(c, { type: "action.use", action: sw.id, costs: sw.costs });
    push(c, { type: "action.use", action: sw.id, costs: sw.costs });
    let { state } = engine.play(c);
    expect(resourceRemaining(state, sheet, "second-wind")).toBe(0);
    expect(canUse(sw, state, sheet).ok).toBe(false);
    push(c, { type: "rest", kind: "short" });
    ({ state } = engine.play(c));
    expect(resourceRemaining(state, sheet, "second-wind")).toBe(1);
    push(c, { type: "rest", kind: "long" });
    ({ state } = engine.play(c));
    expect(resourceRemaining(state, sheet, "second-wind")).toBe(2);
  });

  it("action economy warns (does not block) in combat and resets on turn start", () => {
    const c = character("class:fighter", 1);
    const { sheet } = engine.play(c);
    const sword = sheet.actions.find((a) => a.id.startsWith("weapon:"))!;
    push(c, { type: "combat.start" });
    push(c, { type: "action.use", action: sword.id, costs: sword.costs });
    let { state } = engine.play(c);
    const check = canUse(sword, state, sheet);
    expect(check.ok).toBe(true);
    expect(check.warnings).toHaveLength(1);
    push(c, { type: "turn.start" });
    ({ state } = engine.play(c));
    expect(state.economy.action).toBe(false);
    expect(state.round).toBe(2);
  });

  it("spell slots with upcasting", () => {
    const c = character("class:wizard", 3);
    const { sheet } = engine.play(c);
    const mm = sheet.actions.find((a) => a.name === "Magic Missile")!;
    push(c, { type: "action.use", action: mm.id, costs: mm.costs, slotLevel: 2 });
    push(c, { type: "action.use", action: mm.id, costs: mm.costs });
    const { state } = engine.play(c);
    expect(slotsRemaining(state, sheet)).toEqual([3, 1]);
  });
});

describe("play: effects & concentration", () => {
  it("active effects feed back into the sheet and expire", () => {
    const c = character("class:fighter", 1);
    const before = engine.play(c).sheet.ac;
    push(c, { type: "combat.start" });
    push(c, { type: "effect.add", effect: "effect:haste", rounds: 1 });
    expect(engine.play(c).sheet.ac).toBe(before + 2);
    push(c, { type: "turn.start" });
    expect(engine.play(c).sheet.ac).toBe(before);
  });

  it("a new concentration effect ends the previous one", () => {
    const c = character("class:wizard", 1);
    const { sheet } = engine.play(c);
    const sleep = sheet.actions.find((a) => a.name === "Sleep")!;
    const detect = sheet.actions.find((a) => a.name === "Detect Magic")!;
    push(c, { type: "action.use", action: sleep.id, costs: sleep.costs, effects: [{ effect: "sleep", concentration: true }] });
    push(c, { type: "action.use", action: detect.id, costs: [], effects: [{ effect: "detect-magic", concentration: true }] });
    const { state } = engine.play(c);
    expect(state.effects.map((e) => e.effect)).toEqual(["detect-magic"]);
    expect(state.concentration?.source).toBe("detect-magic");
    expect(concentrationDC(9)).toBe(10);
    expect(concentrationDC(44)).toBe(22);
    expect(concentrationDC(100)).toBe(30);
  });
});

describe("play: undo / redo / idempotency", () => {
  it("revert toggles events", () => {
    const c = character("class:fighter", 1);
    push(c, { type: "hp.damage", amount: 5 });
    const hit = push(c, { type: "hp.damage", amount: 3 });
    expect(undoTarget(c.play)).toBe(hit.id);
    push(c, { type: "revert", target: hit.id });
    let { state } = engine.play(c);
    expect(state.damage).toBe(5);
    expect(redoTarget(c.play)).toBe(hit.id);
    push(c, { type: "revert", target: hit.id });
    ({ state } = engine.play(c));
    expect(state.damage).toBe(8);
    expect(redoTarget(c.play)).toBeUndefined();
  });

  it("duplicate events (double taps / sync echoes) apply once", () => {
    const c = character("class:fighter", 1);
    const e = push(c, { type: "hp.damage", amount: 2 });
    c.play.push({ ...e });
    expect(engine.play(c).state.damage).toBe(2);
  });
});
