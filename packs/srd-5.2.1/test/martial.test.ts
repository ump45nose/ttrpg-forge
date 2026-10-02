import { describe, expect, it } from "vitest";
import { applyOps, emptyBuild, Engine, localize, type Build, type BuildOp, type Sheet } from "@forge/core";
import { srd52 } from "../src";

const engine = new Engine([srd52]);
const choose = (choices: Record<string, string[]>): BuildOp[] => Object.entries(choices).map(([path, selected]) => ({ op: "setChoice", path, selected }));
const action = (s: Sheet, name: string) => s.actions.find((a) => localize(a.name, "en") === name);

function clean(build: Build): Sheet {
  const r = engine.evaluate(build);
  expect(r.issues.filter((i) => i.severity === "error").map((i) => `${i.path}: ${localize(i.message, "en")}`)).toEqual([]);
  expect(r.sheet.choices.filter((c) => c.remaining > 0).map((c) => c.path)).toEqual([]);
  expect(r.sheet.warnings).toEqual([]);
  return r.sheet;
}

function playing(build: Build, effects: string[]): Sheet {
  const c = engine.newCharacter("Test");
  c.build = build;
  c.play = effects.map((effect, i) => ({ id: `e${i}`, at: i, type: "effect.add", effect }));
  return engine.play(c).sheet;
}

const asi = (cls: string, level: number, id: string, ability: string[]) => ({
  [`class:${cls}@${level}/${id}`]: ["feat:ability-score-improvement"],
  [`class:${cls}@${level}/${id}=feat:ability-score-improvement/ability`]: ability,
});

function barbarian(): Build {
  return applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } },
    { op: "setSpecies", id: "species:orc" },
    { op: "setBackground", id: "background:soldier" },
    { op: "setClass", id: "class:barbarian" },
    { op: "setLevel", level: 8 },
    ...choose({
      "global/languages": ["orc", "giant"],
      "background:soldier/ability": ["str:2", "con:1"],
      "background:soldier/gaming-set": ["item:dice-set"],
      "background:soldier/equipment": ["b"],
      "class:barbarian/skills": ["athletics", "perception"],
      "class:barbarian/equipment": ["a"],
      "class:barbarian@1/weapon-mastery": ["item:greataxe", "item:handaxe"],
      "class:barbarian@3/subclass": ["subclass:path-of-the-berserker"],
      "class:barbarian@3/primal-knowledge/primal-knowledge-skill": ["survival"],
      ...asi("barbarian", 4, "feat", ["str:2"]),
      "class:barbarian@4/weapon-mastery-4": ["item:javelin"],
      ...asi("barbarian", 8, "feat-8", ["con:2"]),
    }),
  ]);
}

function monk(): Build {
  return applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 } },
    { op: "setSpecies", id: "species:dwarf" },
    { op: "setBackground", id: "background:criminal" },
    { op: "setClass", id: "class:monk" },
    { op: "setLevel", level: 8 },
    ...choose({
      "global/languages": ["dwarvish", "elvish"],
      "background:criminal/ability": ["dex:2", "con:1"],
      "background:criminal/equipment": ["b"],
      "class:monk/skills": ["acrobatics", "insight"],
      "class:monk/tool": ["item:flute"],
      "class:monk/equipment": ["a"],
      "class:monk@3/subclass": ["subclass:warrior-of-the-open-hand"],
      ...asi("monk", 4, "feat", ["dex:1", "wis:1"]),
      ...asi("monk", 8, "feat-8", ["wis:2"]),
    }),
  ]);
}

describe("golden: L8 orc berserker barbarian", () => {
  const s = clean(barbarian());
  it("unarmored defense, speed and hp", () => {
    expect(s.abilities.str.score).toBe(19);
    expect(s.abilities.con.score).toBe(17);
    expect(s.ac).toBe(10 + 1 + 3);
    expect(s.speed.walk).toBe(30 + 10);
    expect(s.hpMax).toBe(12 + 7 * 7 + 3 * 8);
  });
  it("rage resource and action", () => {
    expect(s.resources.find((r) => r.id === "rage")?.max).toBe(4);
    expect(action(s, "Rage")?.available).toBe(true);
    expect(localize(action(s, "Rage")?.text, "en")).toBe("Rage Damage +2.");
    expect(action(s, "Frenzy")?.damage?.[0]?.dice).toBe("2d6");
  });
  it("rage adds damage and resistances in play", () => {
    const raging = playing(barbarian(), ["effect:rage"]);
    const axe = raging.actions.find((a) => a.weapon && localize(a.name, "en") === "Greataxe")!;
    expect(axe.attack?.bonus).toBe(4 + 3);
    expect(axe.damage?.[0]?.dice).toBe("1d12+6");
    expect(raging.tags).toEqual(expect.arrayContaining(["resist:slashing", "adv:save.str"]));
  });
  it("advantage tags", () => {
    expect(s.tags).toEqual(expect.arrayContaining(["adv:save.dex", "adv:initiative"]));
  });
});

describe("golden: L8 dwarf open hand monk", () => {
  const s = clean(monk());
  it("unarmored defense and movement", () => {
    expect(s.abilities.dex.score).toBe(18);
    expect(s.abilities.wis.score).toBe(17);
    expect(s.ac).toBe(10 + 4 + 3);
    expect(s.speed.walk).toBe(30 + 15);
  });
  it("martial arts die and dex on monk weapons", () => {
    expect(action(s, "Unarmed Strike (Martial Arts)")?.attack?.bonus).toBe(4 + 3);
    expect(action(s, "Unarmed Strike (Martial Arts)")?.damage?.[0]?.dice).toBe("1d8+4");
    const spear = s.actions.find((a) => a.weapon && localize(a.name, "en") === "Spear")!;
    expect(spear.attack?.bonus).toBe(7);
    expect(spear.damage?.[0]?.dice).toBe("1d8+4");
  });
  it("focus features", () => {
    const r = Object.fromEntries(s.resources.map((x) => [x.id, x.max]));
    expect(r).toMatchObject({ focus: 8, "uncanny-metabolism": 1, "wholeness-of-body": 3 });
    expect(action(s, "Stunning Strike")?.save).toMatchObject({ ability: "con", dc: 14 });
    expect(localize(action(s, "Slow Fall")?.text, "en")).toBe("Reduce falling damage by 40.");
  });
  it("armor turns off unarmored features", () => {
    const b = applyOps(monk(), [{ op: "addItem", entry: { key: "armor", item: "item:leather-armor", qty: 1, equipped: true } }]);
    const a = engine.evaluate(b).sheet;
    expect(a.ac).toBe(11 + 4);
    expect(a.speed.walk).toBe(30);
  });
});

describe("fighter and rogue reach level 8", () => {
  it("champion fighter 8", () => {
    const b = applyOps(emptyBuild(), [
      { op: "setAbilities", method: "standard", scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } },
      { op: "setSpecies", id: "species:dwarf" },
      { op: "setBackground", id: "background:soldier" },
      { op: "setClass", id: "class:fighter" },
      { op: "setLevel", level: 8 },
      ...choose({
        "global/languages": ["dwarvish", "giant"],
        "background:soldier/ability": ["str:2", "con:1"],
        "background:soldier/gaming-set": ["item:dice-set"],
        "background:soldier/equipment": ["b"],
        "class:fighter/skills": ["perception", "survival"],
        "class:fighter/equipment": ["a"],
        "class:fighter@1/fighting-style": ["feat:great-weapon-fighting"],
        "class:fighter@1/weapon-mastery": ["item:greatsword", "item:longsword", "item:javelin"],
        "class:fighter@3/subclass": ["subclass:champion"],
        ...asi("fighter", 4, "feat", ["str:2"]),
        "class:fighter@4/weapon-mastery-4": ["item:flail"],
        ...asi("fighter", 6, "feat-6", ["con:2"]),
        "class:fighter@3/subclass=subclass:champion@7/additional-fighting-style": ["feat:defense"],
        ...asi("fighter", 8, "feat-8", ["con:1", "dex:1"]),
      }),
    ]);
    const s = clean(b);
    expect(s.ac).toBe(16 + 1);
    expect(s.tags).toContain("adv:initiative");
  });
});
