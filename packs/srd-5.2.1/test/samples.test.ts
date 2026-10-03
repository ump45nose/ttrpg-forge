import { Engine, RulePackSchema, type Character } from "@forge/core";
import { describe, expect, it } from "vitest";
import { srd52 } from "../src";

const engine = new Engine([srd52]);

describe("pregens", () => {
  it("validate as pack data", () => {
    expect(RulePackSchema.safeParse(srd52).success).toBe(true);
  });

  for (const s of srd52.samples ?? []) {
    it(`${s.id}: complete, valid, and its listed picks were honoured`, () => {
      const c: Character = engine.fromSample(s, "zh");
      const { sheet, issues } = engine.evaluate(c.build);
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(sheet.level).toBe(s.level);
      expect(sheet.choices.filter((ch) => ch.remaining > 0).map((ch) => ch.path)).toEqual([]);
      for (const [path, picks] of Object.entries(s.choices ?? {})) expect(c.build.choices[path], path).toEqual(picks);
      for (const [cls, spells] of Object.entries(s.prepared ?? {})) {
        const sc = sheet.spellcasting.find((x) => x.classId === cls)!;
        for (const id of spells) expect(engine.reg.get(id), id).toBeTruthy();
        expect(spells.length).toBeLessThanOrEqual(sc.preparedMax);
      }
      expect(sheet.ac).toBeGreaterThan(10);
    });
  }
});
