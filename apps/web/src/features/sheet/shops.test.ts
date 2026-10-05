import { Engine, parseCost } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import { restock, SHOPS, shopCommon, shopPool } from "./shops";

const reg = new Engine([srd52]).reg;
const shop = (id: string) => SHOPS.find((s) => s.id === id)!;

describe("shops", () => {
  it("every shop has priced everyday goods with the SRD alone", () => {
    for (const s of SHOPS) {
      const common = shopCommon(reg, s);
      expect(common.length, s.id).toBeGreaterThan(2);
      for (const e of common) expect(parseCost(e.cost), e.id).not.toBeNull();
    }
  });

  it("each shop stocks its own kind of goods", () => {
    expect(shopPool(reg, shop("smith")).every((e) => e.itemType === "weapon" || e.itemType === "armor")).toBe(true);
    expect(shopPool(reg, shop("apothecary")).map((e) => e.id)).toContain("item:potion-of-healing");
    expect(shopPool(reg, shop("general")).some((e) => e.id === "item:gp")).toBe(false);
  });

  it("a restock brings goods beyond the everyday shelf, no repeats", () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stock = restock(reg, shop("smith"), rng);
    expect(stock).toHaveLength(shop("smith").random);
    expect(new Set(stock).size).toBe(stock.length);
    for (const id of stock) expect(shop("smith").common).not.toContain(id);
  });

  it("homebrew goods join a shop through its tag", () => {
    const e = new Engine([srd52, { id: "h", version: "1", system: srd52.system, name: "h", entities: [{ id: "item:local-x", type: "item", itemType: "gear", name: "Lucky Charm", cost: "3 GP", tags: ["shop:general"] }] }]);
    expect(shopCommon(e.reg, shop("general")).map((x) => x.id)).toContain("item:local-x");
  });
});
