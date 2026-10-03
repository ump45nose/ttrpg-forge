import { Engine, type Entity, type RulePack } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { userEntitiesFor } from "../../app/packs";

const pack = (id: string, entities: Entity[]): RulePack => ({ id, version: "1", system: srd52.system, name: id, entities });
const spell = srd52.entities.find((e) => e.type === "spell")!;
const feat = srd52.entities.find((e) => e.type === "feat")!;

describe("character export: custom content it depends on", () => {
  // homebrew in the default pack, a house-rule pack that redefines an official spell, and an imported pack
  const homebrew = { ...feat, id: "local:feat-tough-luck" } as Entity;
  const houseSpell = { ...spell, name: { zh: "村规版", en: "House version" } } as Entity;
  const imported = { ...spell, id: "friend:spell-glitter" } as Entity;
  const engine = new Engine([srd52, pack("local:homebrew", [homebrew]), pack("house:table", [houseSpell]), pack("import:friend", [imported])]);
  const users = new Set(["local:homebrew", "house:table", "import:friend"]);

  it("bundles entities from every user pack, not just the default homebrew pack", () => {
    const ids = userEntitiesFor(engine, [homebrew.id, houseSpell.id, imported.id], users).map((e) => e.id);
    expect(ids.sort()).toEqual([homebrew.id, houseSpell.id, imported.id].sort());
  });

  it("leaves official content out, and lists each entity once", () => {
    expect(userEntitiesFor(engine, [feat.id, homebrew.id, homebrew.id], users).map((e) => e.id)).toEqual([homebrew.id]);
  });
});
