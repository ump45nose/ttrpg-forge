import type { Entity, ResolvedAction } from "@forge/core";

/** Entities whose picture / sound belong to an action: its spell, its item (or weapon), or its feat. A class feature would only repeat the class painting. */
export function actionEntityIds(a: ResolvedAction): (string | undefined)[] {
  const own = a.source.kind === "item" || a.source.entityId?.startsWith("feat:") ? a.source.entityId : undefined;
  return [a.spell?.id, a.item?.entityId, own];
}

/** The sound to play when an action is used: the action's own, else its spell's, item's or feat's. */
export function actionSound(a: ResolvedAction, get: (id: string) => Entity | undefined): string | undefined {
  if (a.sound) return a.sound;
  for (const id of actionEntityIds(a)) {
    const s = id ? get(id)?.sound : undefined;
    if (s) return s;
  }
  return undefined;
}
