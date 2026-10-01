import { describe, expect, it } from "vitest";
import { applyOps, emptyBuild, Engine, parseRulePack, type Build } from "../src";
import { fixturePack } from "./fixture";

const engine = new Engine([fixturePack]);

/** Level 3 dwarf soldier fighter (champion) in chain mail with Defense. */
function fighter(): Build {
  return applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } },
    { op: "setSpecies", id: "species:dwarf" },
    { op: "setBackground", id: "background:soldier" },
    { op: "setClass", id: "class:fighter" },
    { op: "setLevel", level: 3 },
    { op: "setChoice", path: "background:soldier/ability", selected: ["str:2", "con:1"] },
    { op: "setChoice", path: "class:fighter/skills", selected: ["perception", "survival"] },
    { op: "setChoice", path: "class:fighter@1/fighting-style", selected: ["feat:defense"] },
    { op: "setChoice", path: "class:fighter@3/subclass", selected: ["subclass:champion"] },
  ]);
}

/** Level 1 human soldier wizard. */
function wizard(): Build {
  return applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } },
    { op: "setSpecies", id: "species:human" },
    { op: "setBackground", id: "background:soldier" },
    { op: "setClass", id: "class:wizard" },
    { op: "setChoice", path: "background:soldier/ability", selected: ["str:1", "dex:1", "con:1"] },
    { op: "setChoice", path: "class:wizard@1/cantrips", selected: ["spell:fire-bolt", "spell:light", "spell:mage-hand"] },
    {
      op: "setChoice",
      path: "class:wizard@1/spellbook",
      selected: ["spell:magic-missile", "spell:shield", "spell:sleep", "spell:detect-magic", "spell:mage-armor", "spell:burning-hands"],
    },
    { op: "setPrepared", classId: "class:wizard", spells: ["spell:magic-missile", "spell:shield", "spell:sleep", "spell:burning-hands"] },
  ]);
}

describe("derive: fighter golden sheet", () => {
  const { sheet, issues } = engine.evaluate(fighter());

  it("is complete and valid", () => {
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(sheet.pendingCount).toBe(0);
  });
  it("abilities include background increases", () => {
    expect(sheet.abilities.str).toMatchObject({ score: 17, mod: 3, save: 5, saveProf: true });
    expect(sheet.abilities.con).toMatchObject({ score: 15, mod: 2, save: 4 });
    expect(sheet.abilities.dex).toMatchObject({ score: 13, mod: 1, save: 1, saveProf: false });
  });
  it("hp = 10 + 6 + 6 + con×3 + dwarven toughness", () => {
    expect(sheet.hpMax).toBe(10 + 6 + 6 + 6 + 3);
  });
  it("ac = chain mail + defense, with provenance", () => {
    expect(sheet.ac).toBe(17);
    const parts = sheet.explain("ac").filter((c) => c.active && !c.superseded);
    expect(parts.map((p) => p.value)).toEqual([16, 1]);
  });
  it("initiative includes Alert (origin feat via background)", () => {
    expect(sheet.initiative).toBe(1 + 2);
  });
  it("skills and passives", () => {
    expect(sheet.skills.athletics!.value).toBe(5);
    expect(sheet.skills.perception).toMatchObject({ value: 3, prof: "proficient", passive: 13 });
    expect(sheet.skills.stealth!.prof).toBeNull();
  });
  it("species senses and tags", () => {
    expect(sheet.senses.darkvision).toBe(120);
    expect(sheet.tags).toContain("resist:poison");
  });
  it("resources scale with level tables", () => {
    const r = Object.fromEntries(sheet.resources.map((x) => [x.id, x.max]));
    expect(r).toMatchObject({ "second-wind": 2, "action-surge": 1, "hitdie:d10": 3 });
  });
  it("resolves actions: weapon attack, feature heal, basic", () => {
    const sword = sheet.actions.find((a) => a.id.startsWith("weapon:"))!;
    expect(sword.attack).toEqual({ bonus: 5, kind: "melee" });
    expect(sword.damage).toEqual([{ dice: "1d8+3", type: "slashing" }]);
    expect(sword.weapon?.versatile).toBe("1d10+3");
    const sw = sheet.actions.find((a) => a.name === "Second Wind")!;
    expect(sw.heal?.dice).toBe("1d10+3");
    expect(sw.costs).toEqual([{ economy: "bonus" }, { resource: "second-wind", amount: 1 }]);
    expect(sheet.actions.some((a) => a.category === "basic")).toBe(true);
  });
  it("subclass features apply from the subclass level", () => {
    expect(sheet.features.map((f) => f.name)).toContain("Improved Critical");
    expect(sheet.classes[0]).toMatchObject({ id: "class:fighter", level: 3, subclass: "subclass:champion" });
  });
  it("conditional modifiers are explained even when inactive", () => {
    const b = applyOps(fighter(), [{ op: "setEquipped", key: "class:fighter/item:chain-mail", equipped: false }]);
    const s = engine.evaluate(b).sheet;
    expect(s.ac).toBe(10 + 1);
    const defense = s.explain("ac").find((c) => c.label === "Defense")!;
    expect(defense.active).toBe(false);
  });
});

describe("derive: wizard spellcasting", () => {
  const { sheet, issues } = engine.evaluate(wizard());

  it("valid level 1 wizard", () => {
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(sheet.pendingCount).toBe(0);
  });
  it("spell dc / attack / slots", () => {
    expect(sheet.spellcasting[0]).toMatchObject({ dc: 12, attack: 4, cantripsMax: 3, preparedMax: 4, maxSpellLevel: 1 });
    expect(sheet.slots).toEqual([2]);
  });
  it("only prepared spells become actions", () => {
    const names = sheet.actions.filter((a) => a.category === "spell").map((a) => a.name);
    expect(names).toContain("Magic Missile");
    expect(names).not.toContain("Mage Armor");
    const mm = sheet.actions.find((a) => a.name === "Magic Missile")!;
    expect(mm.costs).toEqual([{ economy: "action" }, { slot: 1 }]);
    expect(mm.spell?.upcastDamage).toBe("1d4+1");
    const sleep = sheet.actions.find((a) => a.name === "Sleep")!;
    expect(sleep.save).toMatchObject({ ability: "wis", dc: 12 });
  });
  it("cantrips scale with character level", () => {
    const fb = (b: Build) => engine.evaluate(b).sheet.actions.find((a) => a.name === "Fire Bolt" || (typeof a.name === "object" && a.name.en === "Fire Bolt"))!;
    expect(fb(wizard()).damage![0]!.dice).toBe("1d10");
    expect(fb(wizard()).attack!.bonus).toBe(4);
    expect(fb(applyOps(wizard(), [{ op: "setLevel", level: 5 }])).damage![0]!.dice).toBe("2d10");
  });
  it("level 3: slots grow and new choices are pending", () => {
    const s = engine.evaluate(applyOps(wizard(), [{ op: "setLevel", level: 3 }])).sheet;
    expect(s.slots).toEqual([4, 2]);
    expect(s.pendingCount).toBe(4);
  });
});

describe("validation & choices", () => {
  it("rejects spells above the allowed level", () => {
    const b = applyOps(wizard(), [{ op: "setChoice", path: "class:wizard@1/spellbook", selected: ["spell:misty-step"] }]);
    const { issues } = engine.evaluate(b);
    expect(issues.some((i) => i.code === "invalid-selection")).toBe(true);
  });
  it("rejects bad ability distributions", () => {
    const b = applyOps(fighter(), [{ op: "setChoice", path: "background:soldier/ability", selected: ["str:2", "dex:2"] }]);
    expect(engine.evaluate(b).issues.some((i) => i.code === "ability-choice")).toBe(true);
  });
  it("flags over-prepared spells", () => {
    const b = applyOps(wizard(), [
      { op: "setPrepared", classId: "class:wizard", spells: ["spell:magic-missile", "spell:shield", "spell:sleep", "spell:burning-hands", "spell:mage-armor"] },
    ]);
    expect(engine.evaluate(b).issues.some((i) => i.code === "too-many-prepared")).toBe(true);
  });
  it("point buy budget", () => {
    const b = applyOps(fighter(), [{ op: "setAbilities", method: "pointbuy", scores: { str: 15, dex: 15, con: 15, int: 10, wis: 8, cha: 8 } }]);
    expect(engine.evaluate(b).issues.some((i) => i.code === "pointbuy-budget")).toBe(true);
  });
  it("skill candidates explain why an option is unavailable", () => {
    const { sheet } = engine.evaluate(fighter());
    const opts = engine.options(sheet, "class:fighter/skills");
    const athletics = opts.find((o) => o.id === "athletics")!;
    expect(athletics.valid).toBe(false); // already from Soldier background
    expect(opts.find((o) => o.id === "perception")).toMatchObject({ selected: true, valid: true });
  });
  it("fighting style candidates come from tags", () => {
    const { sheet } = engine.evaluate(fighter());
    expect(engine.options(sheet, "class:fighter@1/fighting-style").map((o) => o.id).sort()).toEqual(["feat:archery", "feat:defense"]);
  });
  it("detects missing entities instead of crashing", () => {
    const b = applyOps(fighter(), [{ op: "setSpecies", id: "species:nope" }]);
    expect(engine.evaluate(b).issues.some((i) => i.code === "missing-entity")).toBe(true);
  });
});

describe("preview diff", () => {
  it("explains what a fighting style changes", () => {
    const base = applyOps(fighter(), [{ op: "setChoice", path: "class:fighter@1/fighting-style", selected: [] }]);
    const { sheet, issues } = engine.evaluate(base);
    const p = engine.preview(base, sheet, [{ op: "toggleChoice", path: "class:fighter@1/fighting-style", id: "feat:defense", max: 1 }], issues);
    expect(p.diff.stats).toEqual([expect.objectContaining({ stat: "ac", before: 16, after: 17, delta: 1 })]);
    expect(p.diff.entities.added.map((e) => e.name)).toEqual(["Defense"]);
    expect(p.diff.choices.removed.map((c) => c.id)).toEqual(["class:fighter@1/fighting-style"]);
  });
  it("level up preview lists new features, resources and hp", () => {
    const b = applyOps(fighter(), [{ op: "setLevel", level: 1 }]);
    const { sheet } = engine.evaluate(b);
    const p = engine.preview(b, sheet, [{ op: "addLevel", classId: "class:fighter" }]);
    expect(p.diff.stats.find((s) => s.stat === "hp.max")?.delta).toBe(6 + 2 + 1);
    expect(p.diff.features.added.map((f) => f.name)).toContain("Action Surge");
    expect(p.diff.resources.added.map((r) => r.id)).toContain("action-surge");
  });
  it("no-op previews are empty", () => {
    const b = fighter();
    const { sheet } = engine.evaluate(b);
    expect(engine.preview(b, sheet, []).diff.empty).toBe(true);
  });
});

describe("pack schema", () => {
  it("accepts the fixture pack", () => {
    const r = parseRulePack(JSON.parse(JSON.stringify(fixturePack)));
    if (!r.ok) console.error(r.errors);
    expect(r.ok).toBe(true);
  });
  it("rejects malformed packs with paths", () => {
    const r = parseRulePack({ id: "x", version: "1", system: "dnd5e-2024", name: "x", entities: [{ id: "a", type: "class", name: "A" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/entities\.0/);
  });
  it("later packs override entities by id (homebrew)", () => {
    const brew = { ...fixturePack, id: "brew", entities: [{ ...fixturePack.entities.find((e) => e.id === "feat:alert")!, grants: [{ type: "modifier" as const, target: "initiative", value: 5 }] }] };
    const e = new Engine([fixturePack, brew]);
    expect(e.evaluate(fighter()).sheet.initiative).toBe(1 + 5);
    expect(e.reg.packOf("feat:alert")).toBe("brew");
  });
  it("bilingual search", () => {
    expect(engine.reg.search("警觉").map((e) => e.id)).toEqual(["feat:alert"]);
    expect(engine.reg.search("fire", "spell").map((e) => e.id)).toEqual(["spell:fire-bolt"]);
  });
});
