import { ulid } from "ulid";
import type { ResolvedAction, Sheet } from "../derive/sheet";
import type { Cost, Duration, EffectStart, PlayEvent, RestKind } from "../schema/types";
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
  economy: Economy;
  inCombat: boolean;
  round: number;
  deathSaves: { success: number; failure: number };
  /** Non-reverted events in order (the visible log). */
  log: PlayEvent[];
}

export interface Economy {
  action: boolean;
  bonus: boolean;
  reaction: boolean;
  /** Feet moved this turn. */
  moved: number;
  /** Times Dash was taken this turn (each adds your Speed). */
  dash: number;
}

const freshEconomy = (): Economy => ({ action: false, bonus: false, reaction: false, moved: 0, dash: 0 });

/** Conditions that end Concentration the moment they apply. */
export const INCAPACITATING = new Set(["condition:incapacitated", "condition:paralyzed", "condition:petrified", "condition:stunned", "condition:unconscious"]);

/** Effects with this many rounds or fewer end with the encounter (1 minute). */
const ENCOUNTER_ROUNDS = 10;

export function initialPlayState(): PlayState {
  return {
    damage: 0,
    temp: 0,
    used: {},
    slotsUsed: [],
    pactUsed: 0,
    effects: [],
    economy: freshEconomy(),
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
  if (eff.concentration || INCAPACITATING.has(eff.effect)) endConcentration(s);
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
  // resting means the fight is over
  s.inCombat = false;
  s.round = 0;
  s.economy = freshEconomy();
  if (kind === "long") {
    s.damage = 0;
    s.temp = 0;
    s.slotsUsed = [];
    // effects and conditions wear off; Exhaustion drops by one level
    const exhaustion = s.effects.filter((x) => x.effect === EXHAUSTION);
    s.effects = exhaustion.slice(1);
    s.concentration = undefined;
    s.deathSaves = { success: 0, failure: 0 };
  }
}

export const EXHAUSTION = "condition:exhaustion";

function payCost(s: PlayState, c: Cost, slotLevel: number | undefined, sheet?: Sheet) {
  if ("economy" in c) {
    s.economy[c.economy] = true;
  } else if ("resource" in c) {
    const amt = typeof c.amount === "number" ? c.amount : 1;
    s.used[c.resource] = Math.min(resMax(sheet, c.resource), (s.used[c.resource] ?? 0) + amt);
  } else if ("slot" in c) {
    spendSlot(s, Math.max(c.slot, slotLevel ?? c.slot), sheet);
  }
  // item costs change the inventory, which `foldInventory` applies before deriving
}

function apply(s: PlayState, e: PlayEvent, sheet?: Sheet) {
  s.log.push(e);
  const hpMax = sheet?.hpMax ?? Infinity;
  switch (e.type) {
    case "hp.damage": {
      // damage while at 0 HP is a failed death save
      if (sheet && s.damage >= hpMax && e.amount > 0) s.deathSaves.failure = Math.min(3, s.deathSaves.failure + 1);
      const absorbed = Math.min(s.temp, e.amount);
      s.temp -= absorbed;
      s.damage = Math.min(hpMax, s.damage + e.amount - absorbed);
      if (s.damage >= hpMax) endConcentration(s);
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
    case "move":
      s.economy.moved = Math.max(0, s.economy.moved + e.feet);
      break;
    case "action.use":
      for (const c of e.costs) payCost(s, c, e.slotLevel, sheet);
      if (e.dash) s.economy.dash++;
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
      s.economy = freshEconomy();
      if (s.inCombat) s.round++;
      s.effects = s.effects
        .map((x) => (x.rounds !== undefined ? { ...x, rounds: x.rounds - 1 } : x))
        .filter((x) => x.rounds === undefined || x.rounds > 0);
      // the concentration effect expired
      if (s.concentration && !s.effects.some((x) => x.key === s.concentration!.key)) s.concentration = undefined;
      break;
    case "combat.start":
      s.inCombat = true;
      s.round = 1;
      s.economy = freshEconomy();
      break;
    case "combat.end": {
      s.inCombat = false;
      s.round = 0;
      s.economy = freshEconomy();
      // one-minute effects end with the fight; longer ones (Mage Armor, Rage's 10 minutes) stay until removed
      s.effects = s.effects.filter((x) => x.rounds === undefined || x.rounds > ENCOUNTER_ROUNDS);
      if (s.concentration && !s.effects.some((x) => x.key === s.concentration!.key)) s.concentration = undefined;
      break;
    }
    case "rest":
      rest(s, e.kind, sheet);
      break;
    case "deathsave":
      if (e.result === "reset") s.deathSaves = { success: 0, failure: 0 };
      else if (e.result === "success") s.deathSaves.success = Math.min(3, s.deathSaves.success + 1);
      else s.deathSaves.failure = Math.min(3, s.deathSaves.failure + 1);
      break;
    case "item.add":
    case "item.qty":
    case "item.remove":
    case "item.equip":
    case "currency":
    case "trade":
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
  if (sheet.issues.some((i) => i.code === "armor-proficiency")) {
    if (action.spell) blockers.push(L("You can't cast spells in armor you aren't trained with", "穿着未受训的护甲时无法施法"));
    else if (action.attack && action.attack.kind !== "spell") warnings.push(L("Untrained armor: this attack has Disadvantage", "未受训的护甲：这次攻击具有劣势"));
  }
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
    } else if ("item" in c) {
      const qty = sheet.items.find((i) => i.key === c.item)?.qty ?? 0;
      if (qty < (c.amount ?? 1)) blockers.push(L("None left", "已经用完"));
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

/** Movement left this turn: Speed × (1 + Dash count) − moved. */
export function movementLeft(state: PlayState, sheet: Sheet): { left: number; budget: number } {
  const budget = sheet.speed.walk * (1 + state.economy.dash);
  return { left: Math.max(0, budget - state.economy.moved), budget };
}

/** Rounds for a duration (1 round = 6 s); undefined = until removed or a rest. */
export function durationRounds(d: Duration | undefined): number | undefined {
  if (!d) return undefined;
  if (d.rounds !== undefined) return d.rounds;
  if (d.minutes !== undefined) return d.minutes * 10;
  if (d.hours !== undefined) return d.hours * 600;
  return undefined;
}

const DASH = /(^|[#:-])dash$/;

export interface UseOptions {
  /** Cast with a slot of this level (upcast, or a slot instead of a free cast). */
  slotLevel?: number;
  /** Cast as a Ritual: no slot, no action. */
  ritual?: boolean;
}

/**
 * The `action.use` event for using an action: costs to pay, self effects to start,
 * concentration and Dash. Effects on other creatures are left to the table, but a
 * Concentration spell always leaves a marker so it can be tracked and broken.
 */
export function actionUseEvent(action: ResolvedAction, opts: UseOptions = {}): NewEvent {
  let costs = action.costs;
  let slotLevel: number | undefined;
  if (opts.ritual) {
    costs = costs.filter((c) => "resource" in c);
  } else if (opts.slotLevel !== undefined && action.spell && action.spell.level > 0) {
    slotLevel = opts.slotLevel;
    if (!costs.some((c) => "slot" in c)) costs = [...costs.filter((c) => !("resource" in c)), { slot: action.spell.level }];
  }
  const self = (action.applies ?? []).filter((a) => a.target === "self");
  const effects: EffectStart[] = self.map((a, i) => ({
    effect: a.effect,
    source: action.id,
    rounds: durationRounds(a.duration),
    concentration: action.concentration && i === 0 ? true : undefined,
  }));
  if (action.concentration && !self.length) {
    const rounds = durationRounds((action.applies ?? []).find((a) => a.duration)?.duration);
    effects.push({ effect: action.spell?.id ?? action.id, source: action.id, rounds, concentration: true });
  }
  const dash = DASH.test(action.id) || action.tags.includes("dash");
  return {
    type: "action.use",
    action: action.id,
    costs,
    ...(slotLevel !== undefined ? { slotLevel } : {}),
    ...(effects.length ? { effects } : {}),
    ...(action.concentration ? { concentration: true } : {}),
    ...(dash ? { dash } : {}),
  };
}

export interface RestPreview {
  hp: number;
  temp: number;
  resources: { id: string; name: LocalizedText; from: number; to: number; max: number; kind: Sheet["resources"][number]["kind"] }[];
  slots: { level: number; from: number; to: number }[];
  pact?: { from: number; to: number };
  effectsEnding: ActiveEffect[];
}

/** What a rest would restore, for the rest wizard. */
export function restPreview(state: PlayState, sheet: Sheet, kind: RestKind): RestPreview {
  const after = structuredClone({ ...state, log: [] }) as PlayState;
  rest(after, kind, sheet);
  const hpBefore = hpCurrent(state, sheet);
  const slotsBefore = slotsRemaining(state, sheet);
  const slotsAfter = slotsRemaining(after, sheet);
  return {
    hp: hpCurrent(after, sheet) - hpBefore,
    temp: after.temp - state.temp,
    resources: sheet.resources
      .map((r) => ({ id: r.id, name: r.name, kind: r.kind, max: r.max, from: resourceRemaining(state, sheet, r.id), to: resourceRemaining(after, sheet, r.id) }))
      .filter((r) => r.to !== r.from),
    slots: slotsBefore.map((from, i) => ({ level: i + 1, from, to: slotsAfter[i] ?? from })).filter((x) => x.to !== x.from),
    pact: sheet.pact && pactRemaining(after, sheet) !== pactRemaining(state, sheet) ? { from: pactRemaining(state, sheet), to: pactRemaining(after, sheet) } : undefined,
    effectsEnding: state.effects.filter((x) => !after.effects.some((y) => y.key === x.key)),
  };
}

/** Damage after Resistance / Vulnerability / Immunity (sheet tags `resist:fire`, `immune:poison`...). */
export function adjustDamage(sheet: Sheet, amount: number, type: string | undefined): { amount: number; rule?: "resist" | "immune" | "vulnerable" } {
  if (!type) return { amount };
  const has = (k: string) => sheet.tags.includes(`${k}:${type}`) || sheet.tags.includes(`${k}:all`);
  if (has("immune")) return { amount: 0, rule: "immune" };
  const resist = has("resist");
  const vuln = has("vulnerable");
  if (resist && !vuln) return { amount: Math.floor(amount / 2), rule: "resist" };
  if (vuln && !resist) return { amount: amount * 2, rule: "vulnerable" };
  return { amount };
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

/** Rolls and notes are history, not state: undo / redo step over them. */
const passive = (e: PlayEvent) => e.type === "roll" || e.type === "note";

/** The event an "undo" should revert, if any. */
export function undoTarget(events: PlayEvent[]): string | undefined {
  const reverted = revertedIds(events);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === "revert" || passive(e)) continue;
    if (!reverted.has(e.id)) return e.id;
  }
  return undefined;
}

/** The event a "redo" should restore: the most recent undo, as long as nothing new happened since. */
export function redoTarget(events: PlayEvent[]): string | undefined {
  const reverted = revertedIds(events);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (passive(e)) continue;
    if (e.type !== "revert") return undefined;
    if (reverted.has(e.target)) return e.target;
  }
  return undefined;
}
