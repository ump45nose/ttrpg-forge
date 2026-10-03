import type { Entity, ResolvedAction } from "@forge/core";
import { describe, expect, it } from "vitest";
import { actionEntityIds, actionSound } from "./actionMedia";

const base = { id: "x", name: "x", activation: "action", category: "feature", tags: [], costs: [], available: true } as unknown as ResolvedAction;
const ents: Record<string, Partial<Entity>> = {
  "spell:fire-bolt": { sound: "data:spell" },
  "item:dagger": { sound: "data:dagger" },
  "feat:x": { sound: "data:feat" },
  "class:fighter": { sound: "data:class" },
};
const get = (id: string) => ents[id] as Entity | undefined;

describe("action media", () => {
  it("prefers the action's own sound", () => {
    expect(actionSound({ ...base, sound: "data:own", spell: { id: "spell:fire-bolt", level: 0 } } as ResolvedAction, get)).toBe("data:own");
  });
  it("then the spell, the weapon, the feat — never the class", () => {
    expect(actionSound({ ...base, spell: { id: "spell:fire-bolt", level: 0 }, source: { path: "p", kind: "class", name: "c", entityId: "class:fighter" } } as ResolvedAction, get)).toBe("data:spell");
    expect(actionSound({ ...base, source: { path: "item:k", kind: "item", name: "d", entityId: "item:dagger" } } as ResolvedAction, get)).toBe("data:dagger");
    expect(actionSound({ ...base, source: { path: "p", kind: "choice", name: "f", entityId: "feat:x" } } as ResolvedAction, get)).toBe("data:feat");
    expect(actionSound({ ...base, source: { path: "p", kind: "class", name: "c", entityId: "class:fighter" } } as ResolvedAction, get)).toBeUndefined();
    expect(actionEntityIds({ ...base, source: { path: "p", kind: "class", name: "c", entityId: "class:fighter" } } as ResolvedAction)).toEqual([undefined, undefined, undefined]);
  });
});
