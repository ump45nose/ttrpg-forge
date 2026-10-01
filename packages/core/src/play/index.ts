import { ulid } from "ulid";
import type { ResolvedAction, Sheet } from "../derive/sheet";
import type { Cost, EffectStart, PlayEvent, RestKind } from "../schema/types";
import type { LocalizedText } from "../text";

/**
 * Play state is never stored directly: it is the fold of the play event log.
 * This gives free undo/redo (revert events), a combat log, and a sync-ready
 * stream for future shared rooms. Counters are stored as "used" so that max
 * values changing (level up, buffs) never corrupt the state.
 */

export interface ActiveEffect extends EffectStart {
  key: string;
}

export interface PlayState {
  damage: number;
  temp: number;
  used: Record<string, number>;
  /** index 0 = level 1 slots */
  slotsUsed: number[];
  pactUsed: number;
  effects: ActiveEffect[];
  concentration?: { source: string; label?: string; key: string };
  /** true = already used this turn */
  economy: { action: boolean; bonus: boolean; reaction: boolean };
  inCombat: boolean;
  round: number;
  deathSaves: { success: number; failure: number };
  /** Non-reverted events in order (the visible log). */
  log: PlayEvent[];
}

export function initialPlayState(): PlayState {
  return {
    damage: 0,
    temp: 0,
    used: {},
    slotsUsed: [],
    pactUsed: 0,
    effects: [],
    economy: { action: false, bonus: false, reaction: false },
    inCombat: false,
    round: 0,
    deathSaves: { success: 0, failure: 0 },
    log: [],
  };
}

/** Event ids that are currently reverted (toggle semantics: reverting a revert = redo). */
export function revertedIds(events: PlayEvent[]): Set<string> {
  const reverted = new Set<string>();
  for (const e of events) {
    if (e.type !== "revert") continue;
    if (reverted.has(e.target)) reverted.delete(e.target);
    else reverted.add(e.target);
  }
  return reverted;
}

export function effectiveEvents(events: PlayEvent[]): PlayEvent[] {
  const seen = new Set<string>();
  const unique = events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  const reverted = revertedIds(unique);
  return unique.filter((e) => e.type !== "revert" && !reverted.has(e.id));
}

/** Which effects/conditions are active — needed *before* deriving the sheet. */
export function activeEffectIds(events: PlayEvent[]): string[] {
  return replay(events).effects.map((e) => e.effect);
}

export function replay(events: PlayEvent[], sheet?: Sheet): PlayState {
  const s = initialPlayState();
  for (const e of effectiveEvents(events)) apply(s, e, sheet);
  return s;
}

const resMax = (sheet: Sheet | undefined, id: string) => sheet?.resources.find((r) => r.id === id)?.max ?? Infinity;

function spendSlot(s: PlayState, level: number, sheet?: Sheet) {
  const idx = level - 1;
  const max = sheet?.slots[idx] ?? Infinity;
  const used = s.slotsUsed[idx] ?? 0;
  if (used < max) {
    s.slotsUsed[idx] = used + 1;
    return;
  }
  if (sheet?.pact && sheet.pact.level >= level && s.pactUsed < sheet.pact.count) s.pactUsed++;
}

function addEffect(s: PlayState, eff: EffectStart, key: string) {
  if (eff.concentration) endConcentration(s);
  s.effects.push({ ...eff, key });
  if (eff.concentration) s.concentration = { source: eff.source ?? eff.effect, label: eff.label, key };
}

function endConcentration(s: PlayState) {
  if (!s.concentration) return;
  const k = s.concentration.key;
  s.effects = s.effects.filter((x) => !x.concentration && x.key !== k);
  s.concentration = undefined;
}

function rest(s: PlayState, kind: RestKind, sheet?: Sheet) {
  if (sheet) {
    for (const r of sheet.resources) {
      const rec = r.recovery.find((x) => x.on === kind) ?? (kind === "long" ? r.recovery.find((x) => x.on === "short") : undefined);
      if (!rec) continue;
      const used = s.used[r.id] ?? 0;
      // a long rest always fully restores short-rest resources
      const amount = rec.amount === "all" || (kind === "long" && rec.on === "short") ? used : rec.amount;
      s.used[r.id] = Math.max(0, used - amount);
    }
  } else if (kind === "long") {
    s.used = {};
  }
  s.pactUsed = 0;
  if (kind === "long") {
    s.damage = 0;
    s.temp = 0;
    s.slotsUsed = [];
    s.effects = [];
    s.concentration = undefined;
    s.deathSaves = { success: 0, failure: 0 };
  }
}

function payCost(s: PlayState, c: Cost, slotLevel: number | undefined, sheet?: Sheet) {
  if ("economy" in c) {
    s.economy[c.economy] = true;
  } else if ("resource" in c) {
    const amt = typeof c.amount === "number" ? c.amount : 1;
    s.used[c.resource] = Math.min(resMax(sheet, c.resource), (s.used[c.resource] ?? 0) + amt);
  } else {
    spendSlot(s, Math.max(c.slot, slotLevel ?? c.slot), sheet);
  }
}

function apply(s: PlayState, e: PlayEvent, sheet?: Sheet) {
  s.log.push(e);
  const hpMax = sheet?.hpMax ?? Infinity;
  switch (e.type) {
    case "hp.damage": {
      const absorbed = Math.min(s.temp, e.amount);
      s.temp -= absorbed;
      s.damage = Math.min(hpMax, s.damage + e.amount - absorbed);
      break;
    }
    case "hp.heal":
      if (s.damage >= hpMax) s.deathSaves = { success: 0, failure: 0 };
      s.damage = Math.max(0, s.damage - e.amount);
      break;
    case "hp.temp":
      s.temp = Math.max(s.temp, e.amount);
      break;
    case "hp.set":
      s.damage = Math.max(0, Math.min(hpMax, (sheet?.hpMax ?? e.current) - e.current));
      break;
    case "resource.spend":
      s.used[e.resource] = Math.min(resMax(sheet, e.resource), (s.used[e.resource] ?? 0) + e.amount);
      break;
    case "resource.restore":
      s.used[e.resource] = e.amount === "all" ? 0 : Math.max(0, (s.used[e.resource] ?? 0) - e.amount);
      break;
    case "slot.spend":
      spendSlot(s, e.level, sheet);
      break;
    case "slot.restore": {
      const idx = e.level - 1;
      if ((s.slotsUsed[idx] ?? 0) > 0) s.slotsUsed[idx]!--;
      else if (s.pactUsed > 0) s.pactUsed--;
      break;
    }
    case "hitdie.spend": {
      const id = `hitdie:d${e.die}`;
      s.used[id] = Math.min(resMax(sheet, id), (s.used[id] ?? 0) + 1);
      if (e.roll !== undefined) {
        const con = sheet?.abilities.con.mod ?? 0;
        s.damage = Math.max(0, s.damage - Math.max(1, e.roll + con));
      }
      break;
    }
    case "economy.use":
      s.economy[e.slot] = true;
      break;
    case "action.use":
      for (const c of e.costs) payCost(s, c, e.slotLevel, sheet);
      for (const eff of e.effects ?? []) addEffect(s, eff, `${e.id}:${eff.effect}`);
      break;
    case "effect.add":
      addEffect(s, e, e.id);
      break;
    case "effect.remove": {
      const idx = s.effects.findIndex((x) => x.effect === e.effect);
      if (idx >= 0) {
        const [removed] = s.effects.splice(idx, 1);
        if (removed && s.concentration?.key === removed.key) s.concentration = undefined;
      }
      break;
    }
    case "concentration.end":
      endConcentration(s);
      break;
    case "turn.start":
      s.economy = { action: false, bonus: false, reaction: false };
      if (s.inCombat) s.round++;
      s.effects = s.effects
        .map((x) => (x.rounds !== undefined ? { ...x, rounds: x.rounds - 1 } : x))
        .filter((x) => x.rounds === undefined || x.rounds > 0);
      if (s.concentration && !s.effects.some((x) => x.key === s.concentration!.key || x.concentration)) {
        // concentration effect expired
        if (s.effects.every((x) => !x.concentration)) s.concentration = undefined;
      }
      break;
    case "combat.start":
      s.inCombat = true;
      s.round = 1;
      s.economy = { action: false, bonus: false, reaction: false };
      break;
    case "combat.end":
      s.inCombat = false;
      s.round = 0;
      s.economy = { action: false, bonus: false, reaction: false };
      s.effects = s.effects.filter((x) => x.rounds === undefined);
      break;
    case "rest":
      rest(s, e.kind, sheet);
      break;
    case "deathsave":
      if (e.result === "reset") s.deathSaves = { success: 0, failure: 0 };
      else if (e.result === "success") s.deathSaves.success = Math.min(3, s.deathSaves.success + 1);
      else s.deathSaves.failure = Math.min(3, s.deathSaves.failure + 1);
      break;
    case "roll":
    case "note":
    case "revert":
      break;
  }
}

/* ───────────────────────── queries ───────────────────────── */

export function hpCurrent(state: PlayState, sheet: Sheet): number {
  return Math.max(0, sheet.hpMax - state.damage);
}

export function resourceRemaining(state: PlayState, sheet: Sheet, id: string): number {
  const r = sheet.resources.find((x) => x.id === id);
  return r ? Math.max(0, r.max - (state.used[id] ?? 0)) : 0;
}

export function slotsRemaining(state: PlayState, sheet: Sheet): number[] {
  return sheet.slots.map((max, i) => Math.max(0, max - (state.slotsUsed[i] ?? 0)));
}

export function pactRemaining(state: PlayState, sheet: Sheet): number {
  return sheet.pact ? Math.max(0, sheet.pact.count - state.pactUsed) : 0;
}

/** Lowest slot level >= `min` that still has a slot (regular or pact). */
export function lowestAvailableSlot(state: PlayState, sheet: Sheet, min: number): number | undefined {
  const rem = slotsRemaining(state, sheet);
  for (let l = min; l <= rem.length; l++) if ((rem[l - 1] ?? 0) > 0) return l;
  if (sheet.pact && sheet.pact.level >= min && pactRemaining(state, sheet) > 0) return sheet.pact.level;
  return undefined;
}

export interface UseCheck {
  ok: boolean;
  /** Hard blockers (no resource left). */
  blockers: LocalizedText[];
  /** Soft warnings (action already used this turn) — the player can still confirm. */
  warnings: LocalizedText[];
}

const L = (en: string, zh: string): LocalizedText => ({ en, zh });

export function canUse(action: ResolvedAction, state: PlayState, sheet: Sheet, slotLevel?: number): UseCheck {
  const blockers: LocalizedText[] = [];
  const warnings: LocalizedText[] = [];
  if (!action.available) blockers.push(L("Not available", "当前不可用"));
  for (const c of action.costs) {
    if ("economy" in c) {
      if (state.inCombat && state.economy[c.economy]) {
        warnings.push(
          c.economy === "action" ? L("Action already used this turn", "本回合动作已用") : c.economy === "bonus" ? L("Bonus action already used", "附赠动作已用") : L("Reaction already used", "反应已用"),
        );
      }
    } else if ("resource" in c) {
      const amt = typeof c.amount === "number" ? c.amount : 1;
      if (resourceRemaining(state, sheet, c.resource) < amt) blockers.push(L("No uses left", "次数已用完"));
    } else {
      const lvl = slotLevel ?? lowestAvailableSlot(state, sheet, c.slot);
      if (lvl === undefined) blockers.push(L("No spell slots left", "没有可用法术位"));
      else if (lvl < c.slot) blockers.push(L("Slot level too low", "法术位环阶过低"));
      else {
        const rem = slotsRemaining(state, sheet)[lvl - 1] ?? 0;
        const pactOk = sheet.pact && sheet.pact.level === lvl && pactRemaining(state, sheet) > 0;
        if (rem <= 0 && !pactOk) blockers.push(L(`No level ${lvl} slots left`, `没有剩余的 ${lvl} 环法术位`));
      }
    }
  }
  return { ok: blockers.length === 0, blockers, warnings };
}

/** 2024: DC 10 or half the damage, max 30. */
export function concentrationDC(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(damage / 2)));
}

/* ───────────────────────── event helpers ───────────────────────── */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewEvent = DistributiveOmit<PlayEvent, "id" | "at">;

export function makeEvent(e: NewEvent, now = Date.now()): PlayEvent {
  return { ...e, id: ulid(now), at: now } as PlayEvent;
}

/** The event an "undo" should revert, if any. */
export function undoTarget(events: PlayEvent[]): string | undefined {
  const reverted = revertedIds(events);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === "revert") continue;
    if (!reverted.has(e.id)) return e.id;
  }
  return undefined;
}

/** The event a "redo" should restore: the most recent undo, as long as nothing new happened since. */
export function redoTarget(events: PlayEvent[]): string | undefined {
  const reverted = revertedIds(events);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type !== "revert") return undefined;
    if (reverted.has(e.target)) return e.target;
  }
  return undefined;
}
