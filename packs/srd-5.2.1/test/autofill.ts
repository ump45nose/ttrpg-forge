import { applyOps, autofill, emptyBuild, type Build, type Engine } from "@forge/core";

export { autofill };

/** A level-N character of one class/subclass with every choice auto-filled. */
export function quickBuild(engine: Engine, cls: string, subclass: string | undefined, level: number, extra: Record<string, string[]> = {}): Build {
  const short = cls.replace(/^class:/, "");
  const b = applyOps(emptyBuild(), [
    { op: "setAbilities", method: "standard", scores: { str: 13, dex: 14, con: 15, int: 10, wis: 12, cha: 8 } },
    { op: "setSpecies", id: "species:human" },
    { op: "setBackground", id: "background:sage" },
    { op: "setClass", id: cls },
    { op: "setLevel", level },
    ...(subclass ? [{ op: "setChoice" as const, path: `class:${short}@3/subclass`, selected: [subclass] }] : []),
  ]);
  return autofill(engine, b, { ...extra });
}
