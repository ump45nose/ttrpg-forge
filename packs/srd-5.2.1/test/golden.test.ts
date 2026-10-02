import { describe, expect, it } from "vitest";
import { applyOps, emptyBuild, Engine, localize, parseRulePack, type Build, type BuildOp, type Sheet } from "@forge/core";
import { srd52 } from "../src";

const engine = new Engine([srd52]);

const choose = (choices: Record<string, string[]>): BuildOp[] => Object.entries(choices).map(([path, selected]) => ({ op: "setChoice", path, selected }));

const en = (s: Sheet, name: string) => s.actions.find((a) => localize(a.name, "en") === name);

function fighter(): Build {
  return applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } },
    { op: "setSpecies", id: "species:dwarf" },
    { op: "setBackground", id: "background:soldier" },
    { op: "setClass", id: "class:fighter" },
    { op: "setLevel", level: 5 },
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
      "class:fighter@4/feat": ["feat:ability-score-improvement"],
      "class:fighter@4/feat=feat:ability-score-improvement/ability": ["str:2"],
      "class:fighter@4/weapon-mastery-4": ["item:flail"],
    }),
  ]);
}

function rogue(): Build {
  return applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 8, dex: 15, con: 14, int: 12, wis: 13, cha: 10 } },
    { op: "setSpecies", id: "species:elf" },
    { op: "setBackground", id: "background:criminal" },
    { op: "setClass", id: "class:rogue" },
    { op: "setLevel", level: 5 },
    ...choose({
      "species:elf/lineage": ["wood-elf"],
      "species:elf/spell-ability": ["wis"],
      "species:elf/keen-senses": ["perception"],
      "global/languages": ["elvish", "halfling"],
      "background:criminal/ability": ["dex:2", "con:1"],
      "background:criminal/equipment": ["b"],
      "class:rogue/skills": ["acrobatics", "deception", "insight", "investigation"],
      "class:rogue/equipment": ["a"],
      "class:rogue@1/expertise": ["stealth", "perception"],
      "class:rogue@1/thieves-cant/language": ["orc"],
      "class:rogue@1/weapon-mastery": ["item:shortsword", "item:shortbow"],
      "class:rogue@3/subclass": ["subclass:thief"],
      "class:rogue@4/feat": ["feat:ability-score-improvement"],
      "class:rogue@4/feat=feat:ability-score-improvement/ability": ["dex:1", "wis:1"],
    }),
  ]);
}

function cleric(): Build {
  return applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 13, dex: 12, con: 14, int: 8, wis: 15, cha: 10 } },
    { op: "setSpecies", id: "species:human" },
    { op: "setBackground", id: "background:acolyte" },
    { op: "setClass", id: "class:cleric" },
    { op: "setLevel", level: 5 },
    ...choose({
      "global/languages": ["elvish", "dwarvish"],
      "species:human/skillful": ["perception"],
      "species:human/size": ["medium"],
      "species:human/versatile": ["feat:alert"],
      "background:acolyte/ability": ["wis:2", "cha:1"],
      "background:acolyte/equipment": ["b"],
      "background:acolyte/feat:magic-initiate-cleric/ability": ["wis"],
      "background:acolyte/feat:magic-initiate-cleric/ability=wis/cantrips": ["spell:guidance", "spell:spare-the-dying"],
      "background:acolyte/feat:magic-initiate-cleric/ability=wis/spell": ["spell:command"],
      "class:cleric/skills": ["history", "medicine"],
      "class:cleric/equipment": ["a"],
      "class:cleric@1/cantrips": ["spell:sacred-flame", "spell:light", "spell:thaumaturgy"],
      "class:cleric@1/divine-order": ["protector"],
      "class:cleric@3/subclass": ["subclass:life-domain"],
      "class:cleric@4/feat": ["feat:ability-score-improvement"],
      "class:cleric@4/feat=feat:ability-score-improvement/ability": ["wis:1", "con:1"],
      "class:cleric@4/cantrips-4": ["spell:mending"],
    }),
    {
      op: "setPrepared",
      classId: "class:cleric",
      spells: ["healing-word", "guiding-bolt", "shield-of-faith", "sanctuary", "inflict-wounds", "spiritual-weapon", "hold-person", "spirit-guardians", "dispel-magic"].map((s) => `spell:${s}`),
    },
  ]);
}

function wizard(): Build {
  const savant = "class:wizard@3/subclass=subclass:evoker";
  const mi = "background:sage/feat:magic-initiate-wizard/ability";
  return applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 8, dex: 13, con: 14, int: 15, wis: 12, cha: 10 } },
    { op: "setSpecies", id: "species:tiefling" },
    { op: "setBackground", id: "background:sage" },
    { op: "setClass", id: "class:wizard" },
    { op: "setLevel", level: 5 },
    ...choose({
      "species:tiefling/legacy": ["infernal"],
      "species:tiefling/size": ["medium"],
      "species:tiefling/spell-ability": ["int"],
      "global/languages": ["draconic", "elvish"],
      "background:sage/ability": ["int:2", "con:1"],
      "background:sage/equipment": ["b"],
      [mi]: ["int"],
      [`${mi}=int/cantrips`]: ["spell:mage-hand", "spell:prestidigitation"],
      [`${mi}=int/spell`]: ["spell:find-familiar"],
      "class:wizard/skills": ["investigation", "insight"],
      "class:wizard/equipment": ["a"],
      "class:wizard@1/cantrips": ["spell:ray-of-frost", "spell:shocking-grasp", "spell:light"],
      "class:wizard@1/spellbook": ["magic-missile", "shield", "mage-armor", "sleep", "detect-magic", "burning-hands"].map((s) => `spell:${s}`),
      "class:wizard@2/scholar": ["arcana"],
      "class:wizard@2/spellbook": ["spell:thunderwave", "spell:chromatic-orb"],
      "class:wizard@3/subclass": ["subclass:evoker"],
      "class:wizard@3/spellbook": ["spell:misty-step", "spell:invisibility"],
      [`${savant}@3/evocation-savant/savant`]: ["spell:scorching-ray", "spell:shatter"],
      "class:wizard@4/feat": ["feat:ability-score-improvement"],
      "class:wizard@4/feat=feat:ability-score-improvement/ability": ["int:1", "dex:1"],
      "class:wizard@4/cantrips-4": ["spell:minor-illusion"],
      "class:wizard@4/spellbook": ["spell:mirror-image", "spell:hold-person"],
      "class:wizard@5/spellbook": ["spell:fireball", "spell:counterspell"],
      [`${savant}@5/savant-5`]: ["spell:lightning-bolt"],
    }),
    {
      op: "setPrepared",
      classId: "class:wizard",
      spells: ["magic-missile", "shield", "mage-armor", "burning-hands", "misty-step", "scorching-ray", "shatter", "fireball", "counterspell"].map((s) => `spell:${s}`),
    },
  ]);
}

function expectClean(b: Build) {
  const r = engine.evaluate(b);
  expect(r.issues.filter((i) => i.severity === "error").map((i) => `${i.path}: ${localize(i.message, "en")}`)).toEqual([]);
  expect(r.sheet.choices.filter((c) => c.remaining > 0).map((c) => c.path)).toEqual([]);
  expect(r.sheet.warnings).toEqual([]);
  return r.sheet;
}

describe("pack integrity", () => {
  it("passes the import schema", () => {
    const r = parseRulePack(JSON.parse(JSON.stringify(srd52)));
    if (!r.ok) console.error(r.errors);
    expect(r.ok).toBe(true);
  });
  it("has unique entity ids", () => {
    const ids = srd52.entities.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every entity has a Chinese name", () => {
    const missing = srd52.entities.filter((e) => typeof e.name === "string" || !e.name.zh).map((e) => e.id);
    expect(missing).toEqual([]);
  });
  it("every class × species × background combination derives without formula warnings", () => {
    for (const c of engine.reg.all("class"))
      for (const s of engine.reg.all("species"))
        for (const b of engine.reg.all("background")) {
          const build = applyOps(emptyBuild(), [{ op: "setSpecies", id: s.id }, { op: "setBackground", id: b.id }, { op: "setClass", id: c.id }, { op: "setLevel", level: 5 }]);
          const { sheet } = engine.evaluate(build);
          expect(sheet.warnings, `${c.id}/${s.id}/${b.id}`).toEqual([]);
          expect(sheet.issues.filter((i) => i.code === "missing-entity"), `${c.id}/${s.id}/${b.id}`).toEqual([]);
        }
  });
});

describe("golden: L5 dwarf champion fighter", () => {
  const s = expectClean(fighter());
  it("core numbers", () => {
    expect(s.abilities.str).toMatchObject({ score: 19, mod: 4, save: 7 });
    expect(s.abilities.con).toMatchObject({ score: 15, mod: 2, save: 5 });
    expect(s.prof).toBe(3);
    expect(s.hpMax).toBe(10 + 4 * 6 + 2 * 5 + 5);
    expect(s.ac).toBe(16);
    expect(s.initiative).toBe(1);
    expect(s.critRange).toBe(19);
    expect(s.senses.darkvision).toBe(120);
  });
  it("greatsword attack with mastery", () => {
    const gs = s.actions.find((a) => a.weapon && localize(a.name, "en") === "Greatsword")!;
    expect(gs.attack?.bonus).toBe(7);
    expect(gs.damage?.[0]?.dice).toBe("2d6+4");
    expect(gs.weapon?.mastery).toBe("graze");
  });
  it("resources", () => {
    const r = Object.fromEntries(s.resources.map((x) => [x.id, x.max]));
    expect(r).toMatchObject({ "second-wind": 3, "action-surge": 1, stonecunning: 3, "hitdie:d10": 5 });
  });
  it("languages and features", () => {
    expect(s.proficiencies.filter((p) => p.kind === "language").map((p) => p.key).sort()).toEqual(["common", "dwarvish", "giant"]);
    expect(s.features.map((f) => localize(f.name, "en"))).toEqual(expect.arrayContaining(["Extra Attack", "Improved Critical", "Tactical Mind", "Savage Attacker"]));
  });
});

describe("golden: L5 wood elf thief rogue", () => {
  const s = expectClean(rogue());
  it("core numbers", () => {
    expect(s.abilities.dex).toMatchObject({ score: 18, mod: 4 });
    expect(s.hpMax).toBe(8 + 4 * 5 + 2 * 5);
    expect(s.ac).toBe(11 + 4);
    expect(s.initiative).toBe(4 + 3); // Alert via Criminal
    expect(s.speed.walk).toBe(35);
    expect(s.speed.climb).toBe(35);
  });
  it("expertise doubles proficiency", () => {
    expect(s.skills.stealth).toMatchObject({ value: 4 + 6, prof: "expertise" });
    expect(s.skills.perception).toMatchObject({ value: 2 + 6, passive: 18 });
    expect(s.skills["sleight-of-hand"]!.value).toBe(4 + 3);
  });
  it("sneak attack scales and shortsword uses finesse", () => {
    expect(en(s, "Sneak Attack")?.damage?.[0]?.dice).toBe("3d6");
    const ss = s.actions.find((a) => a.weapon && localize(a.name, "en") === "Shortsword")!;
    expect(ss.attack?.bonus).toBe(7);
    expect(ss.damage?.[0]?.dice).toBe("1d6+4");
    expect(ss.weapon?.mastery).toBe("vex");
  });
  it("wood elf lineage spells unlock by level", () => {
    const ids = s.spells.map((x) => x.spellId);
    expect(ids).toEqual(expect.arrayContaining(["spell:druidcraft", "spell:longstrider", "spell:pass-without-trace"]));
    const pwt = en(s, "Pass without Trace")!;
    expect(pwt.costs.some((c) => "resource" in c)).toBe(true);
    const l3 = engine.evaluate(applyOps(rogue(), [{ op: "setLevel", level: 3 }])).sheet;
    expect(l3.spells.map((x) => x.spellId)).not.toContain("spell:pass-without-trace");
  });
});

describe("golden: L5 human life cleric", () => {
  const s = expectClean(cleric());
  it("spellcasting", () => {
    expect(s.abilities.wis).toMatchObject({ score: 18, mod: 4 });
    expect(s.spellcasting[0]).toMatchObject({ dc: 15, attack: 7, cantripsMax: 4, preparedMax: 9 });
    expect(s.slots).toEqual([4, 3, 2]);
  });
  it("defense & hp", () => {
    expect(s.ac).toBe(13 + 1 + 2);
    expect(s.hpMax).toBe(8 + 4 * 5 + 2 * 5);
    expect(s.initiative).toBe(1 + 3);
    expect(s.proficiency("armor", "heavy")).toBe("proficient");
  });
  it("channel divinity & domain", () => {
    expect(s.resources.find((r) => r.id === "channel-divinity")?.max).toBe(2);
    expect(en(s, "Divine Spark")?.heal?.dice).toBe("1d8+4");
    expect(en(s, "Preserve Life")?.heal?.dice).toBe("25");
    expect(en(s, "Turn Undead")?.save?.dc).toBe(15);
    const always = s.spells.filter((x) => x.alwaysPrepared && x.classId === "class:cleric").map((x) => x.spellId).sort();
    expect(always).toEqual(["spell:aid", "spell:bless", "spell:cure-wounds", "spell:lesser-restoration", "spell:mass-healing-word", "spell:revivify"]);
  });
  it("spell actions resolve", () => {
    expect(en(s, "Sacred Flame")?.damage?.[0]?.dice).toBe("2d8");
    expect(en(s, "Cure Wounds")?.heal?.dice).toBe("2d8+4");
    expect(en(s, "Spirit Guardians")?.save).toMatchObject({ ability: "wis", dc: 15 });
    // Magic Initiate spell is cast once free with Wisdom
    expect(en(s, "Command")?.costs.some((c) => "resource" in c)).toBe(true);
  });
});

describe("golden: L5 tiefling evoker wizard", () => {
  const s = expectClean(wizard());
  it("core numbers", () => {
    expect(s.abilities.int).toMatchObject({ score: 18, mod: 4 });
    expect(s.spellcasting[0]).toMatchObject({ dc: 15, attack: 7, preparedMax: 9, cantripsMax: 4 });
    expect(s.slots).toEqual([4, 3, 2]);
    expect(s.hpMax).toBe(6 + 4 * 4 + 2 * 5);
    expect(s.ac).toBe(12);
    expect(s.skills.arcana!.value).toBe(4 + 6);
    expect(s.tags).toContain("resist:fire");
  });
  it("spellbook includes savant picks", () => {
    const book = s.spells.filter((x) => x.classId === "class:wizard" && x.level > 0);
    expect(book).toHaveLength(6 + 2 + 2 + 2 + 2 + 3);
  });
  it("species fire bolt uses the chosen casting stat and scales", () => {
    const fb = en(s, "Fire Bolt")!;
    expect(fb.attack?.bonus).toBe(7);
    expect(fb.damage?.[0]?.dice).toBe("2d10");
    expect(en(s, "Fireball")?.save).toMatchObject({ ability: "dex", dc: 15 });
    expect(en(s, "Fireball")?.damage?.[0]?.dice).toBe("8d6");
  });
  it("mage armor effect changes AC in play", () => {
    const sheet = engine.evaluate(wizard()).sheet;
    const c = engine.newCharacter("Test");
    c.build = wizard();
    c.play = [{ id: "e1", at: 1, type: "effect.add", effect: "effect:mage-armor" }];
    expect(engine.play(c).sheet.ac).toBe(13 + 2);
    expect(sheet.ac).toBe(12);
  });
});
