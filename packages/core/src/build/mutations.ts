import type { AbilityScores, Build, Currency, InventoryEntry } from "../schema/types";

/**
 * Pure build edits. Every UI action and (later) every AI tool call goes through
 * these, so previews, undo and validation all see the same operations.
 */
export type BuildOp =
  | { op: "setSpecies"; id: string | undefined }
  | { op: "setBackground"; id: string | undefined }
  | { op: "setClass"; id: string }
  | { op: "addLevel"; classId: string; hp?: number }
  | { op: "removeLevel" }
  | { op: "setLevel"; level: number }
  | { op: "setChoice"; path: string; selected: string[] }
  | { op: "toggleChoice"; path: string; id: string; max: number }
  | { op: "setAbilities"; method?: Build["abilityMethod"]; scores: Partial<AbilityScores> }
  | { op: "setPrepared"; classId: string; spells: string[] }
  | { op: "setEquipped"; key: string; equipped: boolean }
  | { op: "addItem"; entry: InventoryEntry }
  | { op: "removeItem"; key: string }
  | { op: "setHpMethod"; method: Build["hpMethod"] }
  /** The Hit Die result recorded for one level (index 0 = level 1); undefined clears it. */
  | { op: "setLevelHp"; index: number; hp: number | undefined }
  | { op: "setCurrency"; currency: Currency }
  | { op: "setItemQty"; key: string; qty: number };

export function emptyBuild(startLevel = 1): Build {
  return {
    startLevel,
    abilityMethod: "standard",
    baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    levels: [],
    hpMethod: "average",
    choices: {},
    prepared: {},
    inventory: [],
    equipped: {},
  };
}

export function applyOp(b: Build, o: BuildOp): Build {
  switch (o.op) {
    case "setSpecies":
      return { ...b, speciesId: o.id };
    case "setBackground":
      return { ...b, backgroundId: o.id };
    case "setClass": {
      // replace the starting class, keeping the level count (or the planned start level)
      const n = Math.max(1, b.levels.length || b.startLevel || 1);
      return { ...b, levels: Array.from({ length: n }, () => ({ classId: o.id })) };
    }
    case "addLevel":
      return { ...b, levels: [...b.levels, { classId: o.classId, hp: o.hp }] };
    case "removeLevel":
      return { ...b, levels: b.levels.slice(0, -1) };
    case "setLevel": {
      const first = b.levels[0]?.classId;
      if (!first) return b;
      const lv = Math.max(1, Math.min(20, o.level));
      const levels = b.levels.slice(0, lv);
      while (levels.length < lv) levels.push({ classId: levels[levels.length - 1]?.classId ?? first });
      return { ...b, levels };
    }
    case "setChoice": {
      const choices = { ...b.choices };
      if (o.selected.length) choices[o.path] = o.selected;
      else delete choices[o.path];
      return { ...b, choices };
    }
    case "toggleChoice": {
      const cur = b.choices[o.path] ?? [];
      let next: string[];
      if (cur.includes(o.id)) next = cur.filter((x) => x !== o.id);
      else if (o.max === 1) next = [o.id];
      else if (cur.length < o.max) next = [...cur, o.id];
      else next = [...cur.slice(1), o.id]; // replace the oldest pick
      return applyOp(b, { op: "setChoice", path: o.path, selected: next });
    }
    case "setAbilities":
      return { ...b, abilityMethod: o.method ?? b.abilityMethod, baseAbilities: { ...b.baseAbilities, ...o.scores } };
    case "setPrepared":
      return { ...b, prepared: { ...b.prepared, [o.classId]: o.spells } };
    case "setEquipped":
      return { ...b, equipped: { ...b.equipped, [o.key]: o.equipped } };
    case "addItem":
      return { ...b, inventory: [...b.inventory, o.entry] };
    case "removeItem":
      return { ...b, inventory: b.inventory.filter((i) => i.key !== o.key) };
    case "setHpMethod":
      return { ...b, hpMethod: o.method };
    case "setLevelHp":
      return { ...b, levels: b.levels.map((l, i) => (i === o.index ? { classId: l.classId, ...(o.hp === undefined ? {} : { hp: o.hp }) } : l)) };
    case "setCurrency":
      return { ...b, currency: { ...b.currency, ...o.currency } };
    case "setItemQty":
      return { ...b, inventory: b.inventory.map((i) => (i.key === o.key ? { ...i, qty: Math.max(0, o.qty) } : i)).filter((i) => i.qty > 0) };
  }
}

export function applyOps(b: Build, ops: BuildOp[]): Build {
  return ops.reduce(applyOp, b);
}

/**
 * Drop selections whose choice no longer exists (e.g. after switching class)
 * — call with the set of live choice paths from a derived sheet.
 */
export function pruneChoices(b: Build, livePaths: Set<string>): Build {
  const choices = Object.fromEntries(Object.entries(b.choices).filter(([p]) => livePaths.has(p)));
  return Object.keys(choices).length === Object.keys(b.choices).length ? b : { ...b, choices };
}
