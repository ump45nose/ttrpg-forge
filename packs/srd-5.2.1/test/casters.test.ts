import { describe, expect, it } from "vitest";
import { Engine, localize, type Build, type Sheet } from "@forge/core";
import { srd52 } from "../src";
import { quickBuild } from "./autofill";

const engine = new Engine([srd52]);
const action = (s: Sheet, name: string) => s.actions.find((a) => localize(a.name, "en") === name);
const res = (s: Sheet) => Object.fromEntries(s.resources.map((x) => [x.id, x.max]));
const spellIds = (s: Sheet) => s.spells.map((x) => x.spellId);

function clean(build: Build): Sheet {
  const r = engine.evaluate(build);
  expect(r.issues.filter((i) => i.severity === "error").map((i) => `${i.path}: ${localize(i.message, "en")}`)).toEqual([]);
  expect(r.sheet.choices.filter((c) => c.remaining > 0).map((c) => c.path)).toEqual([]);
  expect(r.sheet.warnings).toEqual([]);
  return r.sheet;
}

const SUBCLASSES = engine.reg.all("subclass").map((s) => [s.classId, s.id] as const);

describe("every SRD class and subclass reaches level 8", () => {
  it.each(SUBCLASSES)("%s / %s", (cls, sub) => {
    for (const level of [1, 3, 5, 8]) clean(quickBuild(engine, cls, level >= 3 ? sub : undefined, level));
  });
});

describe("bard", () => {
  const s = clean(quickBuild(engine, "class:bard", "subclass:college-of-lore", 8));
  it("inspiration, jack of all trades", () => {
    expect(res(s)["bardic-inspiration"]).toBe(Math.max(1, s.abilities.cha.mod));
    expect(s.resources.find((r) => r.id === "bardic-inspiration")?.recovery.map((r) => r.on)).toContain("short");
    expect(localize(action(s, "Bardic Inspiration")?.text, "en")).toContain("1d8");
    const unskilled = Object.entries(s.skills).find(([, v]) => !v.prof)!;
    const ability = engine.reg.system.skills[unskilled[0]]!.ability;
    expect(unskilled[1].value).toBe(s.abilities[ability].mod + 1);
  });
  it("lore: cutting words and magical discoveries", () => {
    expect(action(s, "Cutting Words")?.activation).toBe("reaction");
    const disc = s.spells.filter((x) => x.path.includes("magical-discoveries"));
    expect(disc).toHaveLength(2);
    expect(disc.every((x) => x.alwaysPrepared && x.classId === "class:bard")).toBe(true);
  });
});

describe("druid", () => {
  const land = (level: number) =>
    clean(quickBuild(engine, "class:druid", "subclass:circle-of-the-land", level, { "class:druid@3/subclass=subclass:circle-of-the-land@3/circle-of-the-land-spells/land": ["arid"] }));
  it("wild shape and land spells by level", () => {
    const s5 = land(5);
    expect(res(s5)["wild-shape"]).toBe(2);
    expect(spellIds(s5)).toEqual(expect.arrayContaining(["spell:blur", "spell:fireball", "spell:speak-with-animals"]));
    expect(spellIds(s5)).not.toContain("spell:blight");
    const s8 = land(8);
    expect(res(s8)["wild-shape"]).toBe(3);
    expect(spellIds(s8)).toContain("spell:blight");
    expect(action(s8, "Land's Aid")?.damage?.[0]?.dice).toBe("2d6");
  });
  it("magician gets an extra cantrip", () => {
    const s = clean(quickBuild(engine, "class:druid", undefined, 1, { "class:druid@1/primal-order": ["magician"] }));
    expect(s.spells.filter((x) => x.level === 0 && x.classId === "class:druid")).toHaveLength(3);
  });
});

describe("sorcerer", () => {
  const s = clean(quickBuild(engine, "class:sorcerer", "subclass:draconic-sorcery", 8));
  it("points, metamagic and known spells", () => {
    expect(res(s)["sorcery-points"]).toBe(8);
    expect(s.actions.filter((a) => a.costs.some((c) => "resource" in c && c.resource === "sorcery-points"))).not.toHaveLength(0);
    const known = s.spells.filter((x) => x.classId === "class:sorcerer" && !x.alwaysPrepared);
    expect(known.filter((x) => x.level > 0)).toHaveLength(12);
    expect(known.filter((x) => x.level === 0)).toHaveLength(5);
    expect(spellIds(s)).toEqual(expect.arrayContaining(["spell:dragons-breath", "spell:fear", "spell:charm-monster"]));
  });
  it("draconic resilience", () => {
    expect(s.hpMax).toBe(6 + 7 * 4 + 8 * s.abilities.con.mod + 8);
    expect(s.ac).toBe(10 + s.abilities.dex.mod + s.abilities.cha.mod);
  });
  it("innate sorcery raises the DC in play", () => {
    const c = engine.newCharacter("T");
    c.build = quickBuild(engine, "class:sorcerer", "subclass:draconic-sorcery", 8);
    const dc = engine.play(c).sheet.spellcasting[0]!.dc;
    c.play = [{ id: "e", at: 0, type: "effect.add", effect: "effect:innate-sorcery" }];
    expect(engine.play(c).sheet.spellcasting[0]!.dc).toBe(dc + 1);
  });
});

describe("cleric and wizard reach level 8", () => {
  it("life cleric 8", () => {
    const s = clean(quickBuild(engine, "class:cleric", "subclass:life-domain", 8, { "class:cleric@7/blessed-strikes/blessed-strikes-choice": ["divine-strike"] }));
    expect(spellIds(s)).toEqual(expect.arrayContaining(["spell:aura-of-life", "spell:death-ward", "spell:revivify"]));
    expect(action(s, "Divine Strike")?.damage?.[0]?.dice).toBe("1d8");
    expect(res(s)["channel-divinity"]).toBe(3);
  });
  it("evoker 8", () => {
    const s = clean(quickBuild(engine, "class:wizard", "subclass:evoker", 8));
    const book = s.spells.filter((x) => x.classId === "class:wizard" && x.level > 0);
    expect(book.length).toBe(6 + 2 * 7 + 2 + 1 + 1);
  });
});

describe("paladin, ranger and warlock", () => {
  it("devotion paladin 8: lay on hands, aura, smite", () => {
    const s = clean(quickBuild(engine, "class:paladin", "subclass:oath-of-devotion", 8));
    expect(res(s)["lay-on-hands"]).toBe(40);
    expect(res(s)["channel-divinity"]).toBe(2);
    const cha = Math.max(1, s.abilities.cha.mod);
    expect(s.abilities.wis.save).toBe(s.abilities.wis.mod + s.prof + cha);
    expect(s.spells.find((x) => x.spellId === "spell:divine-smite")?.freeResource).toBeTruthy();
    expect(s.spellcasting[0]?.mode).toBe("prepared");
    expect(s.slots).toEqual([4, 3]);
  });
  it("blessed warrior is paladin-only", () => {
    const pal = engine.evaluate(quickBuild(engine, "class:paladin", undefined, 2)).sheet;
    expect(engine.options(pal, "class:paladin@2/fighting-style").find((c) => c.id === "feat:blessed-warrior")?.valid).toBe(true);
    const ftr = engine.evaluate(quickBuild(engine, "class:fighter", undefined, 1)).sheet;
    expect(engine.options(ftr, "class:fighter@1/fighting-style").map((c) => c.id)).not.toContain("feat:blessed-warrior");
  });
  it("hunter ranger 8: favored enemy, roving", () => {
    const s = clean(quickBuild(engine, "class:ranger", "subclass:hunter", 8));
    expect(s.resources.find((r) => r.kind === "spell-free" && localize(r.name, "en") === "Hunter's Mark")?.max).toBe(3);
    expect(s.speed.walk).toBe(40);
    expect(s.speed.climb).toBe(40);
  });
  it("fiend warlock 8: pact magic and invocations", () => {
    const s = clean(quickBuild(engine, "class:warlock", "subclass:fiend-patron", 8));
    expect(s.pact).toEqual({ count: 2, level: 4 });
    expect(s.choices.find((c) => c.path.endsWith("invocations"))?.selected).toHaveLength(6);
    expect(spellIds(s)).toEqual(expect.arrayContaining(["spell:fire-shield", "spell:suggestion"]));
    expect(s.spells.filter((x) => x.classId === "class:warlock" && !x.alwaysPrepared && x.level > 0)).toHaveLength(9);
  });
  it("invocation prerequisites", () => {
    const s = engine.evaluate(quickBuild(engine, "class:warlock", undefined, 2)).sheet;
    const opts = engine.options(s, "class:warlock@1/eldritch-invocations/invocations");
    expect(opts.find((o) => o.id === "devils-sight")?.valid).toBe(true);
    expect(opts.find((o) => o.id === "thirsting-blade")?.valid).toBe(false);
  });
});
