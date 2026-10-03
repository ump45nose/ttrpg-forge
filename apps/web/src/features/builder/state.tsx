import { pruneChoices, type Build, type BuildOp, type Character, type CharacterMeta, type Engine, type Issue, type Preview, type Sheet } from "@forge/core";
import { createContext, useCallback, useContext, useDeferredValue, useMemo, useRef, useState, type ReactNode } from "react";
import { useCharacters } from "../../app/characters";
import i18n from "i18next";
import { useEngine } from "../../app/packs";
import { toast } from "../../ui/Toast";

/** Ops that change which choices exist; stale selections are pruned after them. */
const STRUCTURAL = new Set<BuildOp["op"]>(["setClass", "setSpecies", "setBackground"]);
const HISTORY = 60;

export interface BuilderState {
  character: Character;
  engine: Engine;
  build: Build;
  sheet: Sheet;
  issues: Issue[];
  apply(ops: BuildOp[]): void;
  setMeta(patch: Partial<CharacterMeta> & { name?: string }): void;
  /** Candidate under consideration (hovered on desktop, focused on touch). */
  focus: BuildOp[] | null;
  setFocus(ops: BuildOp[] | null): void;
  /** Preview of `focus`, deferred so hovering never blocks input. */
  preview: Preview | null;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

const Ctx = createContext<BuilderState | null>(null);

export function BuilderProvider({ character, children }: { character: Character; children: ReactNode }) {
  const engine = useEngine();
  const update = useCharacters((s) => s.update);
  const { sheet, issues } = useMemo(() => engine.evaluate(character.build), [engine, character.build]);
  const past = useRef<Build[]>([]);
  const future = useRef<Build[]>([]);
  const [, bump] = useState(0);
  const [focus, setFocusState] = useState<BuildOp[] | null>(null);
  const deferredFocus = useDeferredValue(focus);

  const commit = useCallback(
    (next: Build) => {
      update(character.id, (c) => ({ ...c, build: next }));
      bump((n) => n + 1);
    },
    [character.id, update],
  );

  const apply = useCallback(
    (ops: BuildOp[]) => {
      let next = engine.apply(character.build, ops);
      let lost = 0;
      if (ops.some((o) => STRUCTURAL.has(o.op))) {
        const live = engine.evaluate(next).sheet.choices.map((c) => c.path);
        const pruned = pruneChoices(next, new Set(live));
        lost = Object.entries(next.choices).filter(([p, v]) => v.length && !(p in pruned.choices)).length;
        next = pruned;
      }
      if (next === character.build) return;
      // switching class (or origin) drops the picks that belonged to the old one: say so, and offer them back
      if (lost) toast({ content: i18n.t("builder.pruned", { n: lost }), action: { label: i18n.t("common.undo"), run: () => undoRef.current() } }, 6000);
      past.current = [...past.current.slice(-HISTORY + 1), character.build];
      future.current = [];
      setFocusState(null);
      commit(next);
    },
    [engine, character.build, commit],
  );

  const undo = useCallback(() => {
    const prev = past.current.at(-1);
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [character.build, ...future.current];
    commit(prev);
  }, [character.build, commit]);

  const undoRef = useRef(undo);
  undoRef.current = undo;

  const redo = useCallback(() => {
    const next = future.current[0];
    if (!next) return;
    future.current = future.current.slice(1);
    past.current = [...past.current, character.build];
    commit(next);
  }, [character.build, commit]);

  const setMeta = useCallback(
    ({ name, ...meta }: Partial<CharacterMeta> & { name?: string }) => update(character.id, (c) => ({ ...c, name: name ?? c.name, meta: { ...c.meta, ...meta } })),
    [character.id, update],
  );

  const setFocus = useCallback((ops: BuildOp[] | null) => {
    setFocusState((cur) => (JSON.stringify(cur) === JSON.stringify(ops) ? cur : ops));
  }, []);

  const preview = useMemo(() => {
    if (!deferredFocus?.length) return null;
    try {
      return engine.preview(character.build, sheet, deferredFocus, issues);
    } catch {
      return null;
    }
  }, [engine, character.build, sheet, issues, deferredFocus]);

  const value: BuilderState = {
    character,
    engine,
    build: character.build,
    sheet,
    issues,
    apply,
    setMeta,
    focus,
    setFocus,
    // a slightly stale preview is fine while the next one computes; none once focus clears
    preview: focus ? preview : null,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBuilder(): BuilderState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBuilder outside BuilderProvider");
  return v;
}

/* ───────── steps ───────── */

export const STEPS = ["class", "origin", "abilities", "choices", "details", "review"] as const;
export type StepId = (typeof STEPS)[number];

/** Which builder step owns a choice. Background ability increases live with the scores. */
export function stepOfChoice(path: string, kind: string): StepId {
  if (kind === "ability" && path.startsWith("background:")) return "abilities";
  if (path.startsWith("class:")) return "choices";
  return "origin";
}

export function pendingByStep(sheet: Sheet, build: Build): Record<StepId, number> {
  const r: Record<StepId, number> = { class: build.levels.length ? 0 : 1, origin: 0, abilities: 0, choices: 0, details: 0, review: 0 };
  if (!build.backgroundId) r.origin++;
  if (!build.speciesId) r.origin++;
  for (const c of sheet.choices) if (c.remaining > 0) r[stepOfChoice(c.path, c.choice.from.kind)]++;
  return r;
}

/** Daily prepared spells still open per class (wizard, cleric...). A reminder, not a requirement. */
export function unprepared(sheet: Sheet, build: Build): { classId: string; count: number; max: number }[] {
  return sheet.spellcasting
    .filter((sc) => sc.mode !== "known" && sc.preparedMax > 0)
    .map((sc) => {
      const always = new Set(sheet.spells.filter((s) => s.classId === sc.classId && s.alwaysPrepared).map((s) => s.spellId));
      const count = (build.prepared[sc.classId] ?? []).filter((id) => !always.has(id)).length;
      return { classId: sc.classId, count, max: sc.preparedMax };
    })
    .filter((p) => p.count < p.max);
}

/** Element id of a class's prepared-spells panel, for "jump there" links. */
export const preparedAnchor = (classId: string) => `prepared-${classId.replace(/\W/g, "-")}`;
/** Element id of a choice block. */
export const choiceAnchor = (path: string) => `choice-${path.replace(/\W/g, "-")}`;
