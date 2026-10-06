import { checkPack } from "@forge/core";
import { describe, expect, it } from "vitest";
import exampleJson from "../../../docs/examples/house-rules.json";
import { srd52 } from "../src";

// plain data, as a file read from disk would be
const example = exampleJson as unknown as Record<string, any>;

describe("checkPack", () => {
  it("passes the example house-rules pack from the authoring guide", () => {
    const r = checkPack(example, [srd52]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats).toMatchObject({ entities: 2, patches: 1, systemConfig: true });
    expect(r.smoke).toContain("feat:house-quick-draw on a level 5 character");
  });

  it("reports shape errors, missing references, bad formulas and unknown stats", () => {
    const bad = structuredClone(example);
    bad.entities[0].grants[0].value = "2 +";
    bad.entities[0].grants.push({ type: "grant", entity: "feat:nope" });
    bad.entities[0].grants.push({ type: "modifier", target: "ac", value: "@abilty.dex.mod" });
    bad.patches.push({ target: "item:nothing-here", set: {} });
    const r = checkPack(bad, [srd52]);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/modifier initiative.*formula "2 \+"/);
    expect(r.errors).toContain("feat:house-quick-draw: feat:nope does not exist");
    expect(r.errors).toContain("patch target item:nothing-here does not exist");
    expect(r.warnings.join("\n")).toMatch(/Unknown reference @abilty\.dex\.mod/);
    expect(checkPack({ id: "x" }, [srd52]).errors.length).toBeGreaterThan(0);
  });

  it("smoke-builds a class through all its levels", () => {
    const cls = srd52.entities.find((e) => e.id === "class:fighter")!;
    const r = checkPack({ id: "house:cls", version: "1", system: "dnd5e-2024", name: "x", entities: [{ ...cls, id: "class:house-fighter" }] }, [srd52]);
    expect(r.errors).toEqual([]);
    expect(r.smoke.join()).toMatch(/class:house-fighter level [1-9]/);
  });
});
