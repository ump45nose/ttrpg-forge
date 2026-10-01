/**
 * Dice expressions: "1d20+5", "2d20kh1+3", "4d6dl1", "8d6", "d%", "1d8+1d6-1".
 * Terms are joined by + / -. Dice modifiers: kh/kl (keep highest/lowest), dh/dl (drop).
 */

export type Rng = (sides: number) => number;

/** Uniform 1..sides using crypto when available. */
export const cryptoRng: Rng = (sides) => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x1_0000_0000 / sides) * sides;
    let x: number;
    do {
      crypto.getRandomValues(buf);
      x = buf[0]!;
    } while (x >= limit);
    return (x % sides) + 1;
  }
  return Math.floor(Math.random() * sides) + 1;
};

/** Deterministic RNG for tests / replays. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return (sides) => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s % sides) + 1;
  };
}

/** Returns preset values in order (manual / physical dice input), falling back to `fallback`. */
export function presetRng(values: number[], fallback: Rng = cryptoRng): Rng {
  const queue = [...values];
  return (sides) => {
    const v = queue.shift();
    return v === undefined ? fallback(sides) : Math.min(Math.max(1, Math.round(v)), sides);
  };
}

export type DiceTerm = {
  kind: "dice";
  sign: 1 | -1;
  count: number;
  sides: number;
  keep?: { mode: "kh" | "kl" | "dh" | "dl"; n: number };
};
export type ConstTerm = { kind: "const"; sign: 1 | -1; value: number };
export type Term = DiceTerm | ConstTerm;

export class DiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiceError";
  }
}

export function parseDice(expr: string): Term[] {
  const src = expr.replace(/\s+/g, "").toLowerCase();
  if (!src) throw new DiceError("Empty dice expression");
  const terms: Term[] = [];
  const re = /([+-]?)(?:(\d*)d(\d+|%)(?:(kh|kl|dh|dl)(\d*))?|(\d+))/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m || (i > 0 && !m[1])) throw new DiceError(`Invalid dice expression "${expr}"`);
    const sign: 1 | -1 = m[1] === "-" ? -1 : 1;
    if (m[6] !== undefined) {
      terms.push({ kind: "const", sign, value: Number(m[6]) });
    } else {
      const count = m[2] ? Number(m[2]) : 1;
      const sides = m[3] === "%" ? 100 : Number(m[3]);
      if (count < 1 || count > 1000 || sides < 1 || sides > 10000) throw new DiceError(`Dice out of range "${expr}"`);
      const term: DiceTerm = { kind: "dice", sign, count, sides };
      if (m[4]) term.keep = { mode: m[4] as "kh", n: m[5] ? Number(m[5]) : 1 };
      terms.push(term);
    }
    i = re.lastIndex;
  }
  return terms;
}

export function formatDice(terms: Term[]): string {
  return terms
    .map((t, idx) => {
      const sign = t.sign < 0 ? "-" : idx === 0 ? "" : "+";
      if (t.kind === "const") return `${sign}${t.value}`;
      const keep = t.keep ? `${t.keep.mode}${t.keep.n}` : "";
      return `${sign}${t.count}d${t.sides}${keep}`;
    })
    .join("");
}

export interface DieResult {
  value: number;
  kept: boolean;
}

export type TermResult =
  | (DiceTerm & { dice: DieResult[]; subtotal: number })
  | (ConstTerm & { subtotal: number });

export interface RollResult {
  expr: string;
  total: number;
  terms: TermResult[];
  /** Natural value of the kept d20 when the roll is a single-d20 test. */
  natural?: number;
  crit?: boolean;
  fumble?: boolean;
}

export interface RollOptions {
  rng?: Rng;
  /** Doubles the number of dice (critical hit damage). */
  crit?: boolean;
  /** Turns a single 1d20 into 2d20kh1 / 2d20kl1. Both cancel out. */
  advantage?: boolean;
  disadvantage?: boolean;
  /** Natural value at or above which a d20 counts as a critical (default 20). */
  critRange?: number;
}

export function roll(expr: string, opts: RollOptions = {}): RollResult {
  const rng = opts.rng ?? cryptoRng;
  let terms = parseDice(expr);
  const adv = !!opts.advantage && !opts.disadvantage;
  const dis = !!opts.disadvantage && !opts.advantage;
  if (adv || dis) {
    terms = terms.map((t) =>
      t.kind === "dice" && t.sides === 20 && t.count === 1 && !t.keep
        ? { ...t, count: 2, keep: { mode: adv ? "kh" : "kl", n: 1 } }
        : t,
    );
  }
  if (opts.crit) terms = terms.map((t) => (t.kind === "dice" ? { ...t, count: t.count * 2 } : t));

  const results: TermResult[] = terms.map((t) => {
    if (t.kind === "const") return { ...t, subtotal: t.sign * t.value };
    const dice: DieResult[] = Array.from({ length: t.count }, () => ({ value: rng(t.sides), kept: true }));
    if (t.keep) {
      const order = dice.map((d, idx) => ({ v: d.value, idx })).sort((a, b) => a.v - b.v || a.idx - b.idx);
      const n = Math.min(t.keep.n, dice.length);
      const dropIdx =
        t.keep.mode === "kh" ? order.slice(0, dice.length - n)
        : t.keep.mode === "kl" ? order.slice(n)
        : t.keep.mode === "dl" ? order.slice(0, n)
        : order.slice(dice.length - n);
      for (const d of dropIdx) dice[d.idx]!.kept = false;
    }
    const sum = dice.reduce((s, d) => s + (d.kept ? d.value : 0), 0);
    return { ...t, dice, subtotal: t.sign * sum };
  });

  const out: RollResult = {
    expr: formatDice(terms),
    total: results.reduce((s, r) => s + r.subtotal, 0),
    terms: results,
  };
  const d20s = results.filter((r): r is Extract<TermResult, { kind: "dice" }> => r.kind === "dice" && r.sides === 20);
  if (d20s.length === 1) {
    const kept = d20s[0]!.dice.filter((d) => d.kept);
    if (kept.length === 1) {
      out.natural = kept[0]!.value;
      out.crit = out.natural >= (opts.critRange ?? 20);
      out.fumble = out.natural === 1;
    }
  }
  return out;
}

/** Min / max / average of an expression, for previews ("2d6+3 ≈ 10"). */
export function diceStats(expr: string): { min: number; max: number; avg: number } {
  let min = 0;
  let max = 0;
  let avg = 0;
  for (const t of parseDice(expr)) {
    if (t.kind === "const") {
      min += t.sign * t.value;
      max += t.sign * t.value;
      avg += t.sign * t.value;
      continue;
    }
    const n = t.keep ? (t.keep.mode[0] === "k" ? t.keep.n : t.count - t.keep.n) : t.count;
    const lo = n;
    const hi = n * t.sides;
    const mean = (n * (t.sides + 1)) / 2; // approximate for keep/drop
    if (t.sign > 0) (min += lo, max += hi, avg += mean);
    else (min -= hi, max -= lo, avg -= mean);
  }
  return { min, max, avg };
}
