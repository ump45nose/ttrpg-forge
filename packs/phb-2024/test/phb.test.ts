import { applyOps, emptyBuild, Engine, localize, parseRulePack, type BuildOp } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { buildPhbPack, type PhbData } from "../src";

// the generated data is local-only; without it there is nothing to test
const files = import.meta.glob<PhbData>("../src/generated/phb.json", { eager: true, import: "default" });
const data = Object.values(files)[0];

describe.skipIf(!data)("PHB 2024 pack (local data)", () => {
  const { pack, unresolved } = buildPhbPack(data!);
  const engine = new Engine([srd52, pack]);
  const zh = (id: string) => localize(engine.reg.get(id)?.name, "zh");
  const choose = (c: Record<string, string[]>): BuildOp[] => Object.entries(c).map(([path, selected]) => ({ op: "setChoice", path, selected }));

  it("maps every background field", () => {
    console.log("unresolved:", unresolved);
    expect(unresolved).toEqual([]);
  });

  it("is a valid rule pack", () => {
    const r = parseRulePack(JSON.parse(JSON.stringify(pack)));
    expect(r.ok ? [] : r.errors.slice(0, 5)).toEqual([]);
  });

  it("covers the book", () => {
    expect(engine.reg.all("spell").length).toBeGreaterThanOrEqual(380);
    expect(engine.reg.all("background").length).toBe(16);
    expect(engine.reg.all("species").length).toBe(10);
    expect(engine.reg.all("feat").filter((f) => f.category === "origin").length).toBeGreaterThanOrEqual(12);
  });

  it("uses PHB names but keeps SRD mechanics", () => {
    expect(zh("spell:fire-bolt")).toBe("火焰箭");
    expect(zh("item:plate-armor")).toBe("板甲");
    expect(engine.reg.getOf("spell", "spell:fire-bolt")?.action?.damage?.[0]?.dice).toBe("1d10");
    expect(engine.reg.getOf("spell", "spell:fireball")?.action?.save?.ability).toBe("dex");
  });

  it("guesses mechanics for PHB-only spells", () => {
    const hadar = engine.reg.getOf("spell", "spell:arms-of-hadar");
    expect(hadar?.action?.save).toMatchObject({ ability: "str", onSave: "half" });
    expect(hadar?.action?.damage?.[0]).toEqual({ dice: "2d6", type: "necrotic" });
    expect(hadar?.upcast?.damage).toBe("1d6");
  });

  it("builds an aasimar farmer fighter at level 3", () => {
    const b = applyOps(emptyBuild(3), [
      { op: "setClass", id: "class:fighter" },
      { op: "setSpecies", id: "species:aasimar" },
      { op: "setBackground", id: "background:farmer" },
      { op: "setAbilities", method: "standard", scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } },
      ...choose({ "species:aasimar/size": ["medium"], "background:farmer/ability": ["str:2", "con:1"], "background:farmer/equipment": ["a"] }),
    ]);
    const { sheet, issues } = engine.evaluate(b);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    // fighter d10 (10 + 6 + 6) + CON 15 (+2 per level) + Tough (2 per level)
    expect(sheet.hpMax).toBe(22 + 2 * 3 + 2 * 3);
    expect(sheet.items.some((i) => i.item === "item:sickle")).toBe(true);
    expect(sheet.proficiency("tool", "item:carpenters-tools")).toBeTruthy();
    expect(sheet.resources.some((r) => r.id === "healing-hands")).toBe(true);
    expect(sheet.spells.find((s) => s.spellId === "spell:light")?.ability).toBe("cha");
  });

  it("lineage spells use the chosen ability", () => {
    const b = applyOps(emptyBuild(5), [
      { op: "setClass", id: "class:fighter" },
      { op: "setSpecies", id: "species:elf" },
      { op: "setAbilities", method: "standard", scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } },
      ...choose({ "species:elf/lineage": ["high-elf"], "species:elf/spell-ability": ["wis"] }),
    ]);
    const s = engine.evaluate(b).sheet;
    expect(s.spells.find((x) => x.spellId === "spell:misty-step")?.ability).toBe("wis");
  });
});
