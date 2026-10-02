import { applyOps, emptyBuild, Engine, localize, type Build, type BuildOp, type Sheet } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { buildPhbPack, type PhbData } from "../src";

const files = import.meta.glob<PhbData>("../src/generated/phb.json", { eager: true, import: "default" });
const data = Object.values(files)[0];

describe.skipIf(!data)("PHB 2024 martial classes", () => {
  const { pack } = buildPhbPack(data!);
  const engine = new Engine([srd52, pack]);
  const choose = (c: Record<string, string[]>): BuildOp[] => Object.entries(c).map(([path, selected]) => ({ op: "setChoice", path, selected }));
  const act = (s: Sheet, zh: string) => s.actions.find((a) => localize(a.name, "zh") === zh);
  const build = (cls: string, sub: string, extra: Record<string, string[]> = {}, scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }): Build =>
    applyOps(emptyBuild(8), [
      { op: "setClass", id: `class:${cls}` },
      { op: "setSpecies", id: "species:human" },
      { op: "setAbilities", method: "standard", scores },
      ...choose({ [`class:${cls}@3/subclass`]: [sub], ...extra }),
    ]);
  const sub = (cls: string, id: string, lv: number, path: string) => `class:${cls}@3/subclass=${id}@${lv}/${path}`;

  it("every martial subclass derives at level 8 with PHB text", () => {
    for (const cls of ["barbarian", "fighter", "monk", "rogue"]) {
      const subs = engine.reg.all("subclass").filter((s) => s.classId === `class:${cls}`);
      expect(subs.length, cls).toBe(4);
      for (const s of subs) {
        const { sheet } = engine.evaluate(build(cls, s.id));
        expect(sheet.warnings, s.id).toEqual([]);
        expect(sheet.issues.filter((i) => i.severity === "error" && i.code !== "choice-incomplete").map((i) => i.code), s.id).toEqual([]);
        // every feature carries a Chinese name distinct from the English placeholder, and text
        for (const f of sheet.features.filter((x) => x.source.entityId === s.id)) {
          expect(localize(f.name, "zh"), `${s.id} ${f.id}`).not.toBe(localize(f.name, "en"));
          expect(f.text, `${s.id} ${f.id}`).toBeTruthy();
        }
      }
    }
  });

  it("battle master: 20 maneuvers, superiority dice", () => {
    const id = "subclass:battle-master";
    const s = engine.evaluate(build("fighter", id, {
      [sub("fighter", id, 3, "combat-superiority/maneuvers")]: ["parry", "riposte", "trip-attack"],
      [sub("fighter", id, 7, "maneuvers-7")]: ["rally", "precision-attack"],
    })).sheet;
    const choice = s.choices.find((c) => c.path.endsWith("/maneuvers"))!;
    expect(choice.choice.from.kind === "options" && choice.choice.from.options.length).toBe(20);
    expect(s.resources.find((r) => r.id === "superiority")?.max).toBe(5);
    expect(act(s, "格挡")?.activation).toBe("reaction");
    expect(act(s, "摔绊攻击")?.costs).toEqual(expect.arrayContaining([{ resource: "superiority", amount: 1 }]));
  });

  it("eldritch knight casts as a third caster", () => {
    const id = "subclass:eldritch-knight";
    const s = engine.evaluate(build("fighter", id, {
      [sub("fighter", id, 3, "spellcasting/cantrips")]: ["spell:ray-of-frost", "spell:shocking-grasp"],
      [sub("fighter", id, 3, "spellcasting/spells")]: ["spell:shield", "spell:magic-missile", "spell:burning-hands"],
    })).sheet;
    expect(s.slots).toEqual([4, 2]);
    expect(s.spellcasting[0]).toMatchObject({ classId: "class:fighter", ability: "int", dc: 8 + 3 + 1, maxSpellLevel: 2 });
    expect(s.spells.filter((x) => x.prepared).map((x) => x.spellId)).toEqual(expect.arrayContaining(["spell:shield", "spell:ray-of-frost"]));
  });

  it("zealot, soulknife and shadow mechanics resolve", () => {
    const z = engine.evaluate(build("barbarian", "subclass:path-of-the-zealot")).sheet;
    expect(act(z, "神性之怒")?.damage?.[0]?.dice).toBe("1d6+4");
    expect(z.resources.find((r) => r.id === "warrior-of-the-gods")?.max).toBe(5);

    const k = engine.evaluate(build("rogue", "subclass:soulknife", {}, { str: 8, dex: 15, con: 14, int: 12, wis: 13, cha: 10 })).sheet;
    expect(act(k, "念刃")?.attack?.bonus).toBe(2 + 3);
    expect(act(k, "念刃")?.damage?.[0]).toEqual({ dice: "1d6+2", type: "psychic" });
    expect(k.resources.find((r) => r.id === "psionic-energy")?.max).toBe(6);

    const sh = engine.evaluate(build("monk", "subclass:warrior-of-shadow")).sheet;
    expect(sh.senses.darkvision).toBe(60);
    expect(sh.spells.map((x) => x.spellId)).toEqual(expect.arrayContaining(["spell:darkness", "spell:minor-illusion"]));
  });

  it("classes use PHB names and keep SRD mechanics", () => {
    const s = engine.evaluate(build("barbarian", "subclass:path-of-the-berserker")).sheet;
    expect(localize(engine.reg.get("class:barbarian")?.name, "zh")).toBe("野蛮人");
    expect(s.resources.find((r) => r.id === "rage")?.max).toBe(4);
    expect(act(s, "狂暴")).toBeTruthy();
    const danger = s.features.find((f) => localize(f.name, "zh") === "危机感应");
    expect(localize(danger?.text, "zh")).toContain("敏捷豁免");
  });
});
