import {
  adjustDamage,
  concentrationDC,
  redoTarget,
  undoTarget,
  type Build,
  type Character,
  type Engine,
  type NewEvent,
  type PlayEvent,
  type PlayState,
  type Sheet,
} from "@forge/core";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useCharacters } from "../../app/characters";
import { useEngine } from "../../app/packs";
import { rollDice, type RollRecord, type RollRequest } from "../dice/store";

export interface PlayApi {
  character: Character;
  engine: Engine;
  sheet: Sheet;
  state: PlayState;
  /** The build after play: starting kit plus items gained, used up or swapped. */
  build: Build;
  push(e: NewEvent): PlayEvent | undefined;
  /** Applies Resistance etc., logs the damage and raises a Concentration check if needed. */
  damage(amount: number, type?: string): { applied: number; rule?: "resist" | "immune" | "vulnerable" };
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  /** Toggle one event in the log (undo it, or bring it back). */
  toggle(id: string): void;
  roll(req: Omit<RollRequest, "characterId">): Promise<RollRecord | null>;
  /** Pending Concentration check DC after taking damage. */
  conCheck: number | null;
  setConCheck(dc: number | null): void;
}

const Ctx = createContext<PlayApi | null>(null);

export function PlayProvider({ character, children }: { character: Character; children: ReactNode }) {
  const engine = useEngine();
  const pushEvent = useCharacters((s) => s.push);
  const { sheet, state, build } = useMemo(() => engine.play(character), [engine, character]);
  const [conCheck, setConCheck] = useState<number | null>(null);
  const id = character.id;

  const push = useCallback((e: NewEvent) => pushEvent(id, e), [id, pushEvent]);
  const undoId = undoTarget(character.play);
  const redoId = redoTarget(character.play);

  const api = useMemo<PlayApi>(
    () => ({
      character,
      engine,
      sheet,
      state,
      build,
      push,
      damage(amount, type) {
        const adj = adjustDamage(sheet, amount, type);
        push({ type: "hp.damage", amount: adj.amount, ...(type ? { damageType: type } : {}) });
        const dropsToZero = state.damage + Math.max(0, adj.amount - state.temp) >= sheet.hpMax;
        if (state.concentration && adj.amount > 0 && !dropsToZero) setConCheck(concentrationDC(adj.amount));
        return { applied: adj.amount, rule: adj.rule };
      },
      undo: () => undoId && push({ type: "revert", target: undoId }),
      redo: () => redoId && push({ type: "revert", target: redoId }),
      canUndo: !!undoId,
      canRedo: !!redoId,
      toggle: (target) => push({ type: "revert", target }),
      roll: (req) => rollDice({ critRange: sheet.critRange, ...req, characterId: id }),
      conCheck,
      setConCheck,
    }),
    [character, engine, sheet, state, build, push, undoId, redoId, conCheck, id],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePlay(): PlayApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlay outside PlayProvider");
  return v;
}
