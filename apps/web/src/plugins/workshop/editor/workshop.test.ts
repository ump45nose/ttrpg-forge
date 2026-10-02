import { applyOps, emptyBuild, Engine, EntitySchema, localize, type ClassEntity, type Entity, type FeatEntity, type RulePack, type Sheet, type SpellEntity, type SubclassEntity } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { autofill, quickBuild } from "../../../../../../packs/srd-5.2.1/test/autofill";
import { classToForm, defaultCaster, defaultClassForm, formToClass, formToSubclass, parseTable, slugOf, tableFormula } from "./classTemplate";
import { featToForm, formToFeat, formToSpell, spellToForm } from "./contentTemplates";
import { blankEntity, cloneEntity, WORKSHOP_TYPES } from "./factory";

const base = new Engine([srd52]);
const local = (entities: Entity[]): RulePack => ({ id: "local:homebrew", version: "1", system: srd52.system, name: "Local", entities });
const errors = (s: Sheet) => s.issues.filter((i) => i.severity === "error").map((i) => `${i.path}: ${localize(i.message, "en")}`);
/** What a character sheet looks like, for comparing two derivations. */
const fingerprint = (s: Sheet) => ({
  hp: s.hpMax,
  ac: s.ac,
  saves: Object.values(s.abilities).map((a) => a.save),
  slots: s.slots,
  pact: s.pact,
  resources: s.resources.map((r) => `${r.id}:${r.max}`).sort(),
  features: s.features.map((f) => localize(f.name, "en")).sort(),
  profs: s.proficiencies.map((p) => `${p.kind}:${p.key}:${p.level}`).sort(),
  choices: s.choices.map((c) => `${c.path}=${c.selected.length}/${c.count}`).sort(),
  casting: s.spellcasting.map((c) => `${c.classId}:${c.cantripsMax}:${c.preparedMax}:${c.maxSpellLevel}`),
});

describe("workshop: class form", () => {
  it("round-trips every official class without changing what it derives", () => {
    for (const cls of base.reg.all("class")) {
      const back = formToClass(classToForm(cls, "zh"), cls, "zh");
      expect(EntitySchema.safeParse(back).success, cls.id).toBe(true);
      const overridden = new Engine([srd52, local([back])]);
      const sub = base.reg.all("subclass").find((s) => s.classId === cls.id)?.id;
      const a = base.evaluate(quickBuild(base, cls.id, sub, 8)).sheet;
      const b = overridden.evaluate(quickBuild(overridden, cls.id, sub, 8)).sheet;
      expect(fingerprint(b), cls.id).toEqual(fingerprint(a));
    }
  });

  it("per-level tables parse back from formulas", () => {
    expect(parseTable("table(@class.x.level, 2,3,4)", "x")!.slice(0, 5)).toEqual([2, 3, 4, 4, 4]);
    expect(parseTable(3, "x")![19]).toBe(3);
    expect(parseTable("table(@class.y.level, 2,3)", "x")).toBeUndefined();
    expect(tableFormula("x", [2, 3, 4, 4, 4])).toBe("table(@class.x.level, 2,3,4)");
    expect(tableFormula("x", [5, 5, 5])).toBe(5);
  });

  it("a Workshop-made caster with a feature, resource and subclass builds to level 5", () => {
    const f = defaultClassForm();
    const slug = slugOf(f.id);
    f.name = "符文师";
    f.hitDie = 8;
    f.saves = ["int", "con"];
    f.caster = { ...defaultCaster(slug, "full"), ability: "int", mode: "known", list: "wizard" };
    f.levels = {
      "1": [
        {
          type: "feature",
          id: "rune-mark",
          name: { en: "Rune Mark", zh: "符印" },
          grants: [
            { type: "resource", id: "runes", name: { en: "Runes", zh: "符文" }, max: `1 + floor(@class.${slug}.level / 2)`, recovery: [{ on: "long", amount: "all" }] },
            { type: "action", action: { id: "etch", name: { en: "Etch", zh: "刻印" }, activation: "bonus", category: "feature", cost: [{ resource: "runes" }] } },
          ],
        },
      ],
    };
    const cls = formToClass(f);
    expect(EntitySchema.safeParse(cls).success).toBe(true);
    const sub = formToSubclass({ id: "subclass:local-hrunes", name: "石之道", summary: "", text: "", classId: cls.id, levels: { "3": [{ type: "modifier", target: "ac", value: 1 }] }, tags: [] });
    expect(sub.tags).toEqual([slug]);

    const engine = new Engine([srd52, local([cls, sub])]);
    const b = autofill(
      engine,
      applyOps(emptyBuild(), [
        { op: "setAbilities", method: "standard", scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } },
        { op: "setSpecies", id: "species:human" },
        { op: "setBackground", id: "background:sage" },
        { op: "setClass", id: cls.id },
        { op: "setLevel", level: 5 },
        { op: "setChoice", path: `${cls.id}@3/subclass`, selected: [sub.id] },
      ]),
    );
    const s = engine.evaluate(b).sheet;
    expect(errors(s)).toEqual([]);
    expect(s.pendingCount).toBe(0);
    expect(s.resources.find((r) => r.id === "runes")?.max).toBe(3);
    expect(s.actions.some((a) => localize(a.name, "en") === "Etch")).toBe(true);
    expect(s.slots).toEqual([4, 3, 2]);
    // known caster: one choice per growth, totalling the table at level 5
    const known = s.choices.filter((c) => c.path.includes("/ws-spells-")).reduce((n, c) => n + c.selected.length, 0);
    const cantrips = s.choices.filter((c) => c.path.includes("/ws-cantrips-")).reduce((n, c) => n + c.selected.length, 0);
    expect(known).toBe(9);
    expect(cantrips).toBe(4);
    expect(s.choices.find((c) => c.path === `${cls.id}@4/feat`)).toBeTruthy();
    // the subclass's AC bonus applies
    const plain = new Engine([srd52, local([cls, { ...sub, levels: {} }])]).evaluate(b).sheet;
    expect(s.ac).toBe(plain.ac + 1);
  });

  it("a cloned class re-points its own formulas and derives like the original", () => {
    const fighter = base.reg.getOf("class", "class:fighter")!;
    const copy = cloneEntity(fighter) as ClassEntity;
    const json = JSON.stringify(copy);
    expect(json).not.toContain("@class.fighter.");
    expect(copy.source).toBe("class:fighter");
    const engine = new Engine([srd52, local([copy])]);
    const a = base.evaluate(quickBuild(base, "class:fighter", undefined, 2)).sheet;
    const b = engine.evaluate(quickBuild(engine, copy.id, undefined, 2)).sheet;
    expect(b.resources.map((r) => r.max)).toEqual(a.resources.map((r) => r.max));
    expect(b.hpMax).toBe(a.hpMax);
  });
});

describe("workshop: content forms", () => {
  it("spell form round-trips every SRD spell's rules", () => {
    for (const sp of base.reg.all("spell")) {
      const back = formToSpell(spellToForm(sp, "zh"), sp, "zh") as SpellEntity;
      expect(EntitySchema.safeParse(back).success, sp.id).toBe(true);
      expect(back.action ?? {}, sp.id).toEqual(sp.action ?? {});
      expect(back.components.replace(/\s/g, ""), sp.id).toBe(sp.components.replace(/\s/g, ""));
      expect(new Set(back.tags), sp.id).toEqual(new Set(sp.tags));
      expect(back.name).toEqual(sp.name);
      expect(back.castingTime).toEqual(sp.castingTime);
    }
  });

  it("feat form round-trips every SRD feat", () => {
    for (const ft of base.reg.all("feat")) {
      const back = formToFeat(featToForm(ft, "en"), ft, "en") as FeatEntity;
      expect(EntitySchema.safeParse(back).success, ft.id).toBe(true);
      expect(back.grants?.length, ft.id).toBe(ft.grants?.length ?? 0);
      expect(back.prereq?.formula, ft.id).toBe(ft.prereq?.formula);
      expect(back.tags).toContain(ft.category);
    }
  });

  it("blank entities of every Workshop type are valid; presets apply", () => {
    for (const type of WORKSHOP_TYPES) expect(EntitySchema.safeParse(blankEntity(type, undefined, "zh")).success, type).toBe(true);
    const sub = blankEntity("subclass", { classId: "class:wizard" } as Partial<Entity>, "zh") as SubclassEntity;
    expect(sub.tags).toEqual(["wizard"]);
    const spell = blankEntity("spell", { level: 0, tags: ["druid"] } as Partial<Entity>, "zh") as SpellEntity;
    expect(spellToForm(spell, "zh").lists).toEqual(["druid"]);
    expect(spell.level).toBe(0);
  });

  it("a new spell on a class list shows up in that class's choices", () => {
    const spell = formToSpell({ ...spellToForm(undefined, "zh"), id: "spell:local-hfrost", name: "霜息", level: 1, lists: ["wizard"], resolve: "save", saveAbility: "con", damage: [{ dice: "3d6", type: "cold" }] }, undefined, "zh");
    const engine = new Engine([srd52, local([spell])]);
    const s = engine.evaluate(quickBuild(engine, "class:wizard", undefined, 1)).sheet;
    const book = s.choices.find((c) => c.choice.from.kind === "entity" && c.choice.from.entityType === "spell" && c.count >= 6);
    expect(book).toBeTruthy();
    expect(engine.options(s, book!.path).some((c) => c.id === spell.id)).toBe(true);
  });
});
