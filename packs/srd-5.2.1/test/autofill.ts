import { applyOps, emptyBuild, type Build, type Engine, type Sheet } from "@forge/core";

/**
 * Fill every open choice with the first valid candidates, repeating until nothing is left to pick
 * (picks can open new choices: subclass, feat sub-choices...). Used to smoke-test whole classes.
 */
export function autofill(engine: Engine, build: Build, prefer: Record<string, string[]> = {}): Build {
  let b = build;
  for (let round = 0; round < 40; round++) {
    const sheet = engine.evaluate(b).sheet;
    const open = sheet.choices.filter((c) => c.remaining > 0);
    if (!open.length) return b;
    let progressed = false;
    for (const ch of open) {
      const selected = prefer[ch.path] ?? pick(engine, sheet, ch);
      if (!selected.length) continue;
      b = applyOps(b, [{ op: "setChoice", path: ch.path, selected }]);
      progressed = true;
    }
    if (!progressed) return b;
  }
  return b;
}

function pick(engine: Engine, sheet: Sheet, ch: Sheet["choices"][number]): string[] {
  const from = ch.choice.from;
  if (from.kind === "ability") {
    const pattern = from.patterns[0] ?? [];
    const cap = from.cap ?? 20;
    const out: string[] = [];
    const pool = [...from.abilities].sort((a, b) => sheet.abilities[a].score - sheet.abilities[b].score);
    for (const amt of pattern) {
      const a = pool.find((x) => !out.some((o) => o.startsWith(`${x}:`)) && sheet.abilities[x].score + amt <= cap);
      if (a) out.push(`${a}:${amt}`);
    }
    return out;
  }
  const kept = ch.selected;
  const fresh = engine
    .options(sheet, ch.path)
    .filter((c) => c.valid && !c.selected)
    .map((c) => c.id);
  return [...kept, ...fresh.slice(0, ch.count - kept.length)];
}

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
