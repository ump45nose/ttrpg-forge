import { srd52 } from "@forge/pack-srd52";
import { describe, expect, it } from "vitest";
import manifest from "./manifest.json";

// files that exist under public/art (keys only; nothing is loaded)
const onDisk = new Set(Object.keys(import.meta.glob("../../../public/art/**/*.webp")).map((k) => k.replace("../../../public/", "")));

describe("classic art pack", () => {
  it("every manifest entry has both renditions on disk", () => {
    for (const [id, img] of Object.entries(manifest)) {
      expect(onDisk.has(`${img.src}.webp`), id).toBe(true);
      expect(onDisk.has(`${img.src}.sm.webp`), id).toBe(true);
      expect(img.v, id).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("covers every SRD class, subclass, species and background, plus a portrait per species", () => {
    const has = new Set(Object.keys(manifest));
    const wanted = srd52.entities.filter((e) => ["class", "subclass", "species", "background"].includes(e.type)).map((e) => e.id);
    expect(wanted.filter((id) => !has.has(id))).toEqual([]);
    const species = srd52.entities.filter((e) => e.type === "species").map((e) => `portrait:${e.id.split(":")[1]}`);
    expect(species.filter((id) => !has.has(id))).toEqual([]);
  });
});
