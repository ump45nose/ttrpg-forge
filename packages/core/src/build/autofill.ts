import type { Engine } from "../engine";
import type { Sheet } from "../derive/sheet";
import type { Build } from "../schema/types";
import { applyOps } from "./mutations";

/**
 * Fill every open choice with the first valid candidates, repeating until nothing is left to pick
 * (picks can open new choices: subclass, feat sub-choices...). Used for example characters and to smoke-test whole classes.
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

