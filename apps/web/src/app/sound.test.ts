import { describe, expect, it } from "vitest";
import { cueSource } from "./sound";

const pack = (id: string, cues: Record<string, string>) => ({ id, name: id, cues });

describe("feedback cue sources", () => {
  it("player clip > last sound pack > synthesised", () => {
    const packs = [pack("a", { crit: "a-crit", heal: "a-heal" }), pack("b", { crit: "b-crit" })];
    expect(cueSource("crit", { crit: { data: "mine" } }, packs)).toBe("mine");
    expect(cueSource("crit", {}, packs)).toBe("b-crit");
    expect(cueSource("heal", {}, packs)).toBe("a-heal");
    expect(cueSource("roll", {}, packs)).toBeUndefined();
  });
});
