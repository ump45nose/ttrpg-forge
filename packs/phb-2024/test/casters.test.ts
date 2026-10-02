import { Engine, localize, type Sheet } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { quickBuild } from "../../srd-5.2.1/test/autofill";
import { buildPhbPack, type PhbData } from "../src";

const files = import.meta.glob<PhbData>("../src/generated/phb.json", { eager: true, import: "default" });
const data = Object.values(files)[0];

describe.skipIf(!data)("PHB 2024 spellcasting classes", () => {
  const { pack } = buildPhbPack(data!);
  const engine = new Engine([srd52, pack]);
  const act = (s: Sheet, zh: string) => s.actions.find((a) => localize(a.name, "zh") === zh);
  const ids = (s: Sheet) => s.spells.map((x) => x.spellId);
  const sheetOf = (cls: string, sub?: string, level = 8, extra: Record<string, string[]> = {}) => engine.evaluate(quickBuild(engine, `class:${cls}`, sub, level, extra));

  const CASTERS = ["bard", "cleric", "druid", "sorcerer", "wizard", "paladin", "ranger", "warlock"];
  const subs = CASTERS.flatMap((cls) => engine.reg.all("subclass").filter((s) => s.classId === `class:${cls}`).map((s) => [cls, s.id] as const));

  it("each caster class has four subclasses", () => {
    for (const cls of CASTERS) expect(subs.filter(([c]) => c === cls), cls).toHaveLength(4);
  });

  it.each(subs)("%s / %s derives cleanly at 8 with PHB text", (cls, id) => {
    const { sheet, issues } = sheetOf(cls, id);
    expect(issues.filter((i) => i.severity === "error").map((i) => `${i.path}: ${localize(i.message, "en")}`)).toEqual([]);
    expect(sheet.choices.filter((c) => c.remaining > 0).map((c) => c.path)).toEqual([]);
    expect(sheet.warnings).toEqual([]);
    for (const f of sheet.features.filter((x) => x.source.entityId === id || x.source.entityId === `class:${cls}`)) {
      expect(localize(f.name, "zh"), `${id} ${f.id}`).not.toBe(localize(f.name, "en"));
      expect(f.text, `${id} ${f.id}`).toBeTruthy();
    }
  });

  it("options take their PHB names: metamagic, primal order", () => {
    const { sheet } = sheetOf("sorcerer", "subclass:draconic-sorcery");
    const mm = sheet.choices.find((c) => c.path.endsWith("metamagic-options"))!;
    const opts = mm.choice.from.kind === "options" ? mm.choice.from.options : [];
    expect(opts.map((o) => localize(o.name, "zh"))).toContain("谨慎法术");
    expect(localize(opts[0]!.text, "zh")).toContain("术法点");
    const druid = sheetOf("druid", "subclass:circle-of-the-moon", 1);
    const po = druid.sheet.choices.find((c) => c.path.endsWith("primal-order"))!;
    expect(po.choice.from.kind === "options" && po.choice.from.options.map((o) => localize(o.name, "zh"))).toEqual(["术师", "卫士"]);
  });

  it("light domain: spells by level, radiance of the dawn", () => {
    const s5 = sheetOf("cleric", "subclass:light-domain", 5).sheet;
    expect(ids(s5)).toEqual(expect.arrayContaining(["spell:fireball", "spell:faerie-fire"]));
    expect(ids(s5)).not.toContain("spell:wall-of-fire");
    const s8 = sheetOf("cleric", "subclass:light-domain").sheet;
    expect(ids(s8)).toContain("spell:wall-of-fire");
    expect(act(s8, "黎明曙光")?.damage?.[0]?.dice).toBe("2d10+8");
    expect(s8.resources.find((r) => r.id === "warding-flare")?.recovery.map((r) => r.on)).toContain("short");
  });

  it("stars, abjurer, valor", () => {
    const stars = sheetOf("druid", "subclass:circle-of-the-stars").sheet;
    expect(stars.resources.some((r) => r.kind === "spell-free")).toBe(true);
    const abj = sheetOf("wizard", "subclass:abjurer").sheet;
    expect(abj.resources.find((r) => r.id === "arcane-ward")?.max).toBe(16 + abj.abilities.int.mod);
    const valor = sheetOf("bard", "subclass:college-of-valor").sheet;
    expect(valor.proficiencies.some((p) => p.kind === "armor" && p.key === "medium")).toBe(true);
  });

  it("invocations take PHB text; paladin, ranger and warlock subclasses", () => {
    const wl = sheetOf("warlock", "subclass:archfey-patron").sheet;
    const inv = wl.choices.find((c) => c.path.endsWith("invocations"))!;
    expect(inv.count).toBe(6);
    const opts = inv.choice.from.kind === "options" ? inv.choice.from.options : [];
    expect(localize(opts.find((o) => o.id === "agonizing-blast")!.name, "zh")).toBe("苦痛魔爆");
    expect(wl.pact).toEqual({ count: 2, level: 4 });
    expect(wl.resources.some((r) => r.kind === "spell-free" && localize(r.name, "en") === "Misty Step")).toBe(true);
    const glory = sheetOf("paladin", "subclass:oath-of-glory").sheet;
    expect(glory.speed.walk).toBe(30 + 10);
    const gloom = sheetOf("ranger", "subclass:gloom-stalker").sheet;
    expect(gloom.senses.darkvision).toBe(60);
    expect(gloom.proficiencies.some((p) => p.kind === "save" && p.key === "wis")).toBe(true);
  });
});
