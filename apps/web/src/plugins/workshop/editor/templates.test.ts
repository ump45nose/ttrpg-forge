import { applyOps, CharacterSchema, emptyBuild, Engine, EntitySchema, Glossary, localize, type BackgroundEntity, type Build, type RulePack, type SpeciesEntity } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { backgroundToForm, formToBackground, formToItem, formToSpecies, itemToForm, newLocalId, speciesToForm } from "./templates";

const base = new Engine([srd52]);
const local = (entities: RulePack["entities"]): RulePack => ({ id: "local:homebrew", version: "1", system: srd52.system, name: "Local", entities });

describe("homebrew templates", () => {
  it("background form round-trips every official background", () => {
    for (const bg of base.reg.all("background")) {
      const back = formToBackground(backgroundToForm(bg, "zh"));
      expect(EntitySchema.safeParse(back).success, bg.id).toBe(true);
      const kinds = (e: BackgroundEntity) => (e.grants ?? []).map((g) => (g.type === "choice" ? `choice:${g.id}` : g.type === "proficiency" ? `${g.kind}:${g.key}` : g.type === "grant" ? g.entity : g.type)).sort();
      expect(kinds(back)).toEqual(kinds(bg));
    }
  });

  it("species form keeps mechanics it doesn't model", () => {
    for (const sp of base.reg.all("species")) {
      const back = formToSpecies(speciesToForm(sp, "en"));
      expect(EntitySchema.safeParse(back).success, sp.id).toBe(true);
      const count = (e: SpeciesEntity) => (e.grants ?? []).filter((g) => g.type !== "feature").length;
      expect(count(back)).toBeGreaterThanOrEqual(count(sp));
    }
  });

  it("a cloned background with changed skills derives, and survives a JSON round-trip", () => {
    const f = backgroundToForm(base.reg.getOf("background", "background:acolyte"), "zh");
    const clone = formToBackground({ ...f, id: newLocalId("background"), name: "侍僧（村规）", skills: ["insight", "history"] });
    const item = formToItem({ ...itemToForm(undefined, "zh"), name: "秘银链甲", itemType: "armor", armorCategory: "medium", ac: 15 });
    const engine = new Engine([srd52, local([clone, item])]);

    const build: Build = applyOps(emptyBuild(3), [
      { op: "setClass", id: "class:fighter" },
      { op: "setBackground", id: clone.id },
      { op: "setAbilities", method: "standard", scores: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 } },
      { op: "addItem", entry: { key: "k1", item: item.id, qty: 1, equipped: true } },
    ]);
    const s1 = engine.evaluate(build).sheet;
    expect(s1.proficiencies.some((p) => p.kind === "skill" && p.key === "history")).toBe(true);
    expect(s1.proficiencies.some((p) => p.kind === "skill" && p.key === "religion")).toBe(false);
    expect(s1.ac).toBe(15 + 2);

    // export bundle -> import on a fresh engine
    const bundle = JSON.parse(JSON.stringify({ ...engine.newCharacter("X", { level: 3 }), build, homebrew: [clone, item] }));
    expect(CharacterSchema.safeParse(bundle).success).toBe(true);
    const imported = bundle.homebrew.map((e: unknown) => EntitySchema.parse(e));
    const friend = new Engine([srd52, local(imported)]);
    expect(friend.evaluate(bundle.build).sheet.ac).toBe(s1.ac);
  });
});

describe("SRD glossary", () => {
  const g = new Glossary(base.reg);
  it("links Chinese and English rule terms in prose", () => {
    const ids = (text: string) => g.tokenize(text).filter((x) => typeof x !== "string").map((x) => (x as { id: string }).id);
    expect(ids("你在该检定上具有优势，并可以用附赠动作攻击。").length).toBeGreaterThanOrEqual(2);
    expect(ids("The target has Advantage and is Prone.")).toContain("condition:prone");
  });
  it("every explicit {{id}} reference in glossary text resolves", () => {
    const missing: string[] = [];
    for (const e of base.reg.all("rule")) {
      for (const t of [localize(e.text ?? "", "zh"), localize(e.text ?? "", "en")]) {
        for (const m of t.matchAll(/\{\{([^|}]+)/g)) if (!g.has(m[1]!)) missing.push(`${e.id} -> ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
