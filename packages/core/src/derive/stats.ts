import type { Collected, SourceRef } from "../build/collect";
import { evaluate, type Resolver } from "../formula";
import type { ModifierGrant, ModifierOp } from "../schema/types";
import type { LocalizedText } from "../text";

/**
 * Lazily evaluated stat graph with provenance (DiceCloud-style).
 *
 * Every stat = base (default formula, or the best applicable `base` candidate)
 *            + Σ add  → then atLeast floors → then override (if any).
 * Formulas reference other stats via @refs, so dependencies propagate
 * automatically; cycles are detected and reported instead of overflowing.
 */

export interface Contribution {
  label: LocalizedText;
  value: number;
  op: ModifierOp;
  source?: SourceRef;
  /** false when the modifier's `when` condition is currently unmet (shown greyed out). */
  active: boolean;
  /** Candidate bases / floors that lost to a better one. */
  superseded?: boolean;
}

export interface BaseResult {
  value: number;
  parts?: { label: LocalizedText; value: number; source?: SourceRef }[];
}

type BaseFn = () => BaseResult | number;

const BASE_LABEL: LocalizedText = { en: "Base", zh: "基础" };

export class StatEngine {
  private readonly bases = new Map<string, { fn: BaseFn; label?: LocalizedText }>();
  private readonly mods = new Map<string, Collected<ModifierGrant>[]>();
  private readonly cache = new Map<string, number>();
  private readonly explained = new Map<string, Contribution[]>();
  private readonly stack: string[] = [];
  readonly warnings: string[] = [];

  constructor(private readonly fallback: Resolver = () => undefined) {}

  define(stat: string, fn: BaseFn, label?: LocalizedText) {
    this.bases.set(stat, { fn, label });
  }

  addModifier(c: Collected<ModifierGrant>) {
    const list = this.mods.get(c.grant.target) ?? [];
    list.push(c);
    this.mods.set(c.grant.target, list);
  }

  has(stat: string) {
    return this.bases.has(stat) || this.mods.has(stat);
  }

  /** Stats that have modifiers but no definition (e.g. "attack.ranged"). */
  modifiedStats(): string[] {
    return [...this.mods.keys()];
  }

  readonly resolve: Resolver = (path) => {
    if (this.has(path)) return this.get(path);
    return this.fallback(path);
  };

  eval(formula: string | number | boolean): number {
    return evaluate(formula, this.resolve, {
      onUnknown: (p) => {
        this.warn(`Unknown reference @${p}`);
        return 0;
      },
    });
  }

  private warn(msg: string) {
    if (!this.warnings.includes(msg)) this.warnings.push(msg);
  }

  private safeEval(formula: string | number | boolean, where: string): number {
    try {
      return this.eval(formula);
    } catch (e) {
      this.warn(`${where}: ${(e as Error).message}`);
      return 0;
    }
  }

  get(stat: string): number {
    const hit = this.cache.get(stat);
    if (hit !== undefined) return hit;
    if (this.stack.includes(stat)) {
      this.warn(`Circular dependency: ${[...this.stack, stat].join(" → ")}`);
      return 0;
    }
    this.stack.push(stat);
    try {
      const { value, contributions } = this.compute(stat);
      this.cache.set(stat, value);
      this.explained.set(stat, contributions);
      return value;
    } finally {
      this.stack.pop();
    }
  }

  /** Why a stat has its value. */
  explain(stat: string): Contribution[] {
    this.get(stat);
    return this.explained.get(stat) ?? [];
  }

  private compute(stat: string): { value: number; contributions: Contribution[] } {
    const contributions: Contribution[] = [];
    const def = this.bases.get(stat);
    let base = 0;
    let baseParts: Contribution[] = [];
    if (def) {
      const r = def.fn();
      const br: BaseResult = typeof r === "number" ? { value: r } : r;
      base = br.value;
      baseParts = br.parts?.map((p) => ({ label: p.label, value: p.value, op: "base" as const, source: p.source, active: true })) ?? [
        { label: def.label ?? BASE_LABEL, value: br.value, op: "base", active: true },
      ];
    }

    const mods = this.mods.get(stat) ?? [];
    const active = (m: Collected<ModifierGrant>) => (m.grant.when ? !!this.safeEval(m.grant.when, `${stat} when`) : true);
    const valueOf = (m: Collected<ModifierGrant>) => this.safeEval(m.grant.value, stat);
    const entry = (m: Collected<ModifierGrant>, value: number, isActive: boolean): Contribution => ({
      label: m.grant.label ?? m.source.name,
      value,
      op: m.grant.op ?? "add",
      source: m.source,
      active: isActive,
    });

    // base candidates: best applicable wins over the default base
    const candidates = mods.filter((m) => m.grant.op === "base");
    let bestCandidate: Contribution | undefined;
    for (const m of candidates) {
      const isActive = active(m);
      const v = isActive ? valueOf(m) : 0;
      const c = entry(m, v, isActive);
      if (isActive && v > base && (!bestCandidate || v > bestCandidate.value)) {
        if (bestCandidate) bestCandidate.superseded = true;
        bestCandidate = c;
      } else {
        c.superseded = isActive;
      }
      contributions.push(c);
    }
    if (bestCandidate) {
      base = bestCandidate.value;
      baseParts.forEach((p) => (p.superseded = true));
    }
    contributions.unshift(...baseParts);

    let value = base;
    for (const m of mods) {
      if ((m.grant.op ?? "add") !== "add") continue;
      const isActive = active(m);
      const v = isActive ? valueOf(m) : 0;
      if (isActive) value += v;
      contributions.push(entry(m, v, isActive));
    }
    for (const m of mods) {
      if (m.grant.op !== "atLeast") continue;
      const isActive = active(m);
      const v = isActive ? valueOf(m) : 0;
      const c = entry(m, v, isActive);
      if (isActive && v > value) value = v;
      else c.superseded = isActive;
      contributions.push(c);
    }
    const overrides = mods.filter((m) => m.grant.op === "override" && active(m));
    if (overrides.length) {
      const vals = overrides.map((m) => ({ m, v: valueOf(m) }));
      const best = vals.reduce((a, b) => (b.v > a.v ? b : a));
      contributions.forEach((c) => (c.superseded = true));
      contributions.push(entry(best.m, best.v, true));
      value = best.v;
    }
    return { value, contributions };
  }
}
