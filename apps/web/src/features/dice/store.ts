import { parseDice, roll, type RollOptions, type RollResult, type TermResult } from "@forge/core";
import { create } from "zustand";
import { useCharacters } from "../../app/characters";
import { playCue } from "../../app/sound";
import { haptic, reducedMotion, useSettings } from "../../app/settings";

export type RollKind = "attack" | "damage" | "heal" | "save" | "check" | "initiative" | "death" | "hitdie" | "free";

export interface RollRequest {
  expr: string;
  label?: string;
  kind?: RollKind;
  advantage?: boolean;
  disadvantage?: boolean;
  crit?: boolean;
  critRange?: number;
  /** Log the roll on this character's play log. */
  characterId?: string;
}

export interface RollRecord extends RollRequest {
  id: number;
  at: number;
  result: RollResult;
  physical: boolean;
  /** When the tray's tumbling dice settle (= `at` when there is no animation). */
  landsAt: number;
}

/** Tumble length of the result tray. */
export const TUMBLE_MS = 650;

interface PhysicalAsk {
  req: RollRequest;
  /** The dice part the player rolls by hand, e.g. "2d6" or "d20". */
  dice: string;
  d20: boolean;
  resolve: (r: RollRecord | null) => void;
}

interface DiceStore {
  history: RollRecord[];
  /** The roll shown in the result tray. */
  last: RollRecord | null;
  ask: PhysicalAsk | null;
  dockOpen: boolean;
  setDock(o: boolean): void;
  dismiss(): void;
  clear(): void;
}

let seq = 0;

export const useDice = create<DiceStore>()((set) => ({
  history: [],
  last: null,
  ask: null,
  dockOpen: false,
  setDock: (o) => set({ dockOpen: o }),
  dismiss: () => set({ last: null }),
  clear: () => set({ history: [], last: null }),
}));

/** "[14, 7] + 5" — the dice behind a total, dropped dice in parentheses. */
export function rollDetail(r: RollResult): string {
  return r.terms
    .map((t, i) => {
      const sign = t.sign < 0 ? " − " : i ? " + " : "";
      if (t.kind === "const") return `${sign}${t.value}`;
      return `${sign}[${t.dice.map((d) => (d.kept ? d.value : `(${d.value})`)).join(", ")}]`;
    })
    .join("");
}

function record(req: RollRequest, result: RollResult, physical: boolean): RollRecord {
  const animate = !physical && useSettings.getState().diceAnim && !reducedMotion();
  const at = Date.now();
  const rec: RollRecord = { ...req, id: ++seq, at, result, physical, landsAt: at + (animate ? TUMBLE_MS : 0) };
  useDice.setState((s) => ({ history: [rec, ...s.history].slice(0, 100), last: rec }));
  if (req.characterId) {
    useCharacters.getState().push(req.characterId, { type: "roll", label: req.label, expr: result.expr, total: result.total, detail: rollDetail(result) });
  }
  if (animate) playCue("roll");
  setTimeout(() => {
    haptic(result.crit ? [12, 40, 12] : 8);
    playCue(result.crit ? "crit" : result.fumble ? "fumble" : "land");
  }, rec.landsAt - at);
  return rec;
}

/** Wait for the dice to settle before reacting to a roll (toasts, banners), so the result isn't spoiled. */
export function afterLanding(rec: RollRecord): Promise<void> {
  const wait = rec.landsAt - Date.now();
  return wait > 0 ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

/** Skip the tumble of the roll in the tray. */
export function landNow() {
  useDice.setState((s) => (s.last && s.last.landsAt > Date.now() ? { last: { ...s.last, landsAt: Date.now() } } : s));
}

/** Builds the result of a hand-rolled roll: the dice total the player typed, plus the modifiers. */
export function physicalResult(req: RollRequest, typed: number): RollResult {
  const terms = parseDice(req.expr);
  const dice = terms.filter((t) => t.kind === "dice");
  const d20 = dice.length === 1 && dice[0]!.kind === "dice" && dice[0]!.sides === 20 && dice[0]!.count === 1;
  let used = false;
  const results: TermResult[] = terms.map((t) => {
    if (t.kind === "const") return { ...t, subtotal: t.sign * t.value };
    // the typed number stands for every dice term together
    const v = used ? 0 : typed;
    used = true;
    return { ...t, dice: [{ value: v, kept: true }], subtotal: t.sign * v };
  });
  const total = results.reduce((s, r) => s + r.subtotal, 0);
  const out: RollResult = { expr: req.expr, total, terms: results };
  if (d20) {
    out.natural = typed;
    out.crit = typed >= (req.critRange ?? 20);
    out.fumble = typed === 1;
  }
  return out;
}

/** The dice-only part of an expression, for the "roll these yourself" prompt. */
export function diceOnly(expr: string, req: Pick<RollRequest, "crit" | "advantage" | "disadvantage">): string {
  const parts = parseDice(expr)
    .filter((t) => t.kind === "dice")
    .map((t) => (t.kind === "dice" ? `${t.count * (req.crit ? 2 : 1)}d${t.sides}` : ""));
  return parts.join(" + ") || expr;
}

/**
 * Rolls dice — digitally, or by asking for the number rolled at the table when
 * "physical dice" is on. Resolves null if the player cancels.
 */
export function rollDice(req: RollRequest): Promise<RollRecord | null> {
  const opts: RollOptions = { advantage: req.advantage, disadvantage: req.disadvantage, crit: req.crit, critRange: req.critRange };
  const hasDice = parseDice(req.expr).some((t) => t.kind === "dice");
  if (!useSettings.getState().physicalDice || !hasDice) return Promise.resolve(record(req, roll(req.expr, opts), false));
  return new Promise((resolve) => {
    const dice = diceOnly(req.expr, req);
    const d20 = /^1d20$/.test(dice);
    useDice.setState({
      ask: {
        req,
        dice,
        d20,
        resolve: (r) => {
          useDice.setState({ ask: null });
          resolve(r);
        },
      },
    });
  });
}

/** Called by the physical-dice prompt. */
export function submitPhysical(ask: PhysicalAsk, typed: number | null) {
  ask.resolve(typed === null ? null : record(ask.req, physicalResult(ask.req, typed), true));
}
