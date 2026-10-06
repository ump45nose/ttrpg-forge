import { attackParts, damageParts, Engine, flatTotal, localize, makeEvent, partsExpr, ridersFor, testParts, type Character, type NewEvent, type RollPart, type RulePack, type Sheet } from "@forge/core";
import { describe, expect, it } from "vitest";
import { srd52 } from "../src";

// a stand-in for Great Weapon Master: +prof damage with Heavy weapons
const gwm: RulePack = {
  id: "test:gwm",
  version: "1.0.0",
  system: "dnd5e-2024",
  name: "test",
  entities: [{ id: "effect:test-gwm", type: "effect", name: { en: "GWM", zh: "巨武器大师" }, grants: [{ type: "dice", on: ["damage"], dice: "@prof", properties: ["heavy"], label: { en: "GWM", zh: "巨武器大师" } }] }],
} as RulePack;
const engine = new Engine([srd52, gwm]);
const sample = (cls: string) => engine.fromSample(srd52.samples!.find((s) => s.classId === cls)!, "zh");
const withEvents = (c: Character, ...evs: NewEvent[]): Character => ({ ...c, play: [...c.play, ...evs.map((e, i) => makeEvent(e, 1_800_000_000_000 + i))] });
const said = (parts: RollPart[]) => parts.map((p) => `${p.dice ?? (p.value! >= 0 ? `+${p.value}` : p.value)} ${localize(p.label, "zh")}`);
const weapon = (sheet: Sheet, zh: string) => sheet.actions.find((a) => a.weapon && localize(a.name, "zh") === zh)!;

describe("roll breakdowns for real dice", () => {
  it("a greatsword attack and its damage, part by part, add up to the sheet's numbers", () => {
    const sheet = engine.play(sample("class:fighter")).sheet;
    const sword = weapon(sheet, "巨剑");
    const attack = attackParts(sheet, sword);
    expect(said(attack)).toEqual(["1d20 d20", `+${sword.weapon!.mod} 力量调整值`, `+${sheet.prof} 熟练加值`]);
    expect(flatTotal(attack)).toBe(sword.attack!.bonus);
    const damage = damageParts(sheet, sword);
    expect(said(damage)[0]).toBe("2d6 武器伤害骰");
    expect(damage[0]!.damageType).toBe("slashing");
    expect(partsExpr(damage)).toBe(sword.damage![0]!.dice.replace(/\s/g, ""));
  });

  it("effect dice join the rolls they belong to: Bless on attacks and saves, GWM only on heavy weapons", () => {
    const sheet = engine.play(withEvents(sample("class:fighter"), { type: "effect.add", effect: "effect:bless" }, { type: "effect.add", effect: "effect:test-gwm" })).sheet;
    const sword = weapon(sheet, "巨剑");
    expect(attackParts(sheet, sword).at(-1)).toMatchObject({ dice: "1d4", bonus: true, label: { zh: "祝福术" } });
    expect(damageParts(sheet, sword).at(-1)).toMatchObject({ value: sheet.prof, bonus: true, label: { zh: "巨武器大师" } });
    const light = sheet.actions.find((a) => a.weapon && !a.weapon.properties.includes("heavy"))!;
    expect(damageParts(sheet, light).some((p) => p.bonus)).toBe(false);
    const save = testParts(sheet, "save.str", "save");
    expect(said(save)).toContain("1d4 祝福术");
    expect(said(save)[1]).toMatch(/力量调整值$/);
    expect(flatTotal(save)).toBe(sheet.abilities.str.save);
    expect(partsExpr(save)).toBe(`1d20+1d4+${sheet.abilities.str.save}`);
  });

  it("skill checks name their ability and proficiency; Guidance offers its die", () => {
    const sheet = engine.play(withEvents(sample("class:rogue"), { type: "effect.add", effect: "effect:guidance" })).sheet;
    const stealth = testParts(sheet, "skill.stealth", "check");
    expect(said(stealth).slice(1, 3)).toEqual([`+${sheet.abilities.dex.mod} 敏捷调整值`, `+${sheet.prof * 2} 专精`]);
    expect(stealth.at(-1)).toMatchObject({ dice: "1d4", label: { zh: "神导术" } });
    expect(flatTotal(stealth)).toBe(sheet.skills.stealth!.value);
  });

  it("Sneak Attack is offered after weapon hits, not on spells", () => {
    const sheet = engine.play(sample("class:rogue")).sheet;
    const bow = sheet.actions.find((a) => a.weapon)!;
    expect(ridersFor(sheet, bow).map((r) => localize(r.name, "zh"))).toContain("偷袭");
    const wizard = engine.play(sample("class:wizard")).sheet;
    const bolt = wizard.actions.find((a) => a.spell && a.attack)!;
    expect(ridersFor(wizard, bolt)).toEqual([]);
    expect(said(attackParts(wizard, bolt)).slice(1, 3)).toEqual([`+${wizard.abilities.int.mod} 智力调整值`, `+${wizard.prof} 熟练加值`]);
  });
});
