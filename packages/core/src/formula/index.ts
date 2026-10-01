/**
 * Safe formula language used by content packs (never `eval`).
 *
 *   10 + @ability.dex.mod
 *   max(1, @class.cleric.level >= 6 ? 3 : 2)
 *   !@flag.armored && @ability.dex.score >= 13
 *
 * - `@a.b-c.d` references are resolved by the caller (stat graph, play state, ...)
 * - booleans are numbers (true = 1, false = 0)
 * - functions: floor ceil round min max abs clamp if table
 */

export type FormulaNode =
  | { k: "num"; v: number }
  | { k: "ref"; path: string }
  | { k: "un"; op: "-" | "!" | "+"; a: FormulaNode }
  | { k: "bin"; op: BinOp; a: FormulaNode; b: FormulaNode }
  | { k: "tern"; c: FormulaNode; a: FormulaNode; b: FormulaNode }
  | { k: "call"; fn: string; args: FormulaNode[] };

type BinOp = "+" | "-" | "*" | "/" | "%" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "&&" | "||";

export class FormulaError extends Error {
  constructor(message: string, readonly source: string) {
    super(`${message} in formula "${source}"`);
    this.name = "FormulaError";
  }
}

type Token =
  | { t: "num"; v: number }
  | { t: "ref"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

const OPS = ["<=", ">=", "==", "!=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "!", "(", ")", ",", "?", ":"];

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+/.exec(src.slice(i));
      if (!m) throw new FormulaError(`Bad number at ${i}`, src);
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === "@") {
      // segment chars: letters, digits, _ ; a hyphen is part of a segment only when followed by a letter
      const m = /^@[A-Za-z_][\w]*(?:-[A-Za-z][\w]*)*(?:\.[\w]+(?:-[A-Za-z][\w]*)*)*/.exec(src.slice(i));
      if (!m) throw new FormulaError(`Bad reference at ${i}`, src);
      out.push({ t: "ref", v: m[0].slice(1) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new FormulaError(`Unexpected "${c}" at ${i}`, src);
    out.push({ t: "op", v: op });
    i += op.length;
  }
  return out;
}

class Parser {
  private i = 0;
  constructor(
    private readonly toks: Token[],
    private readonly src: string,
  ) {}

  parse(): FormulaNode {
    const n = this.ternary();
    if (this.i < this.toks.length) throw new FormulaError(`Unexpected token "${this.toks[this.i]!.v}"`, this.src);
    return n;
  }

  private peekOp(...ops: string[]): string | undefined {
    const t = this.toks[this.i];
    return t && t.t === "op" && ops.includes(t.v) ? t.v : undefined;
  }

  private expectOp(op: string) {
    if (!this.peekOp(op)) throw new FormulaError(`Expected "${op}"`, this.src);
    this.i++;
  }

  private ternary(): FormulaNode {
    const c = this.binary(0);
    if (this.peekOp("?")) {
      this.i++;
      const a = this.ternary();
      this.expectOp(":");
      const b = this.ternary();
      return { k: "tern", c, a, b };
    }
    return c;
  }

  private static readonly LEVELS: BinOp[][] = [["||"], ["&&"], ["==", "!="], ["<", "<=", ">", ">="], ["+", "-"], ["*", "/", "%"]];

  private binary(level: number): FormulaNode {
    if (level >= Parser.LEVELS.length) return this.unary();
    let a = this.binary(level + 1);
    let op: string | undefined;
    while ((op = this.peekOp(...Parser.LEVELS[level]!))) {
      this.i++;
      const b = this.binary(level + 1);
      a = { k: "bin", op: op as BinOp, a, b };
    }
    return a;
  }

  private unary(): FormulaNode {
    const op = this.peekOp("-", "!", "+");
    if (op) {
      this.i++;
      return { k: "un", op: op as "-" | "!" | "+", a: this.unary() };
    }
    return this.primary();
  }

  private primary(): FormulaNode {
    const t = this.toks[this.i];
    if (!t) throw new FormulaError("Unexpected end", this.src);
    this.i++;
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "ref") return { k: "ref", path: t.v };
    if (t.t === "id") {
      if (t.v === "true") return { k: "num", v: 1 };
      if (t.v === "false") return { k: "num", v: 0 };
      this.expectOp("(");
      const args: FormulaNode[] = [];
      if (!this.peekOp(")")) {
        do args.push(this.ternary());
        while (this.peekOp(",") && ++this.i);
      }
      this.expectOp(")");
      if (!(t.v in FUNCS)) throw new FormulaError(`Unknown function "${t.v}"`, this.src);
      return { k: "call", fn: t.v, args };
    }
    if (t.v === "(") {
      const n = this.ternary();
      this.expectOp(")");
      return n;
    }
    throw new FormulaError(`Unexpected "${t.v}"`, this.src);
  }
}

const FUNCS: Record<string, (...a: number[]) => number> = {
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  clamp: (v, lo, hi) => Math.min(Math.max(v!, lo!), hi!),
  if: (c, a, b) => (c ? a! : b!),
  /** table(i, v1, v2, ...) -> v_i (1-based, clamped): level-indexed class tables. */
  table: (i, ...vals) => vals[Math.min(Math.max(Math.floor(i!), 1), vals.length) - 1] ?? 0,
};

const cache = new Map<string, FormulaNode>();

export function parseFormula(src: string): FormulaNode {
  let n = cache.get(src);
  if (!n) {
    n = new Parser(tokenize(src), src).parse();
    cache.set(src, n);
  }
  return n;
}

export type Resolver = (path: string) => number | undefined;

export interface EvalOptions {
  /** Called for refs the resolver does not know; default throws. */
  onUnknown?: (path: string) => number;
}

export type FormulaInput = string | number | boolean;

export function evaluate(formula: FormulaInput, resolve: Resolver, opts: EvalOptions = {}): number {
  if (typeof formula === "number") return formula;
  if (typeof formula === "boolean") return formula ? 1 : 0;
  const src = formula;
  const ev = (n: FormulaNode): number => {
    switch (n.k) {
      case "num":
        return n.v;
      case "ref": {
        const v = resolve(n.path);
        if (v !== undefined) return v;
        if (opts.onUnknown) return opts.onUnknown(n.path);
        throw new FormulaError(`Unknown reference "@${n.path}"`, src);
      }
      case "un": {
        const a = ev(n.a);
        return n.op === "-" ? -a : n.op === "!" ? (a ? 0 : 1) : a;
      }
      case "tern":
        return ev(n.c) ? ev(n.a) : ev(n.b);
      case "call":
        if (n.fn === "if") return ev(n.args[0]!) ? ev(n.args[1]!) : ev(n.args[2]!);
        return FUNCS[n.fn]!(...n.args.map(ev));
      case "bin": {
        if (n.op === "&&") return ev(n.a) && ev(n.b) ? 1 : 0;
        if (n.op === "||") return ev(n.a) || ev(n.b) ? 1 : 0;
        const a = ev(n.a);
        const b = ev(n.b);
        switch (n.op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/": return b === 0 ? 0 : a / b;
          case "%": return b === 0 ? 0 : a % b;
          case "<": return a < b ? 1 : 0;
          case "<=": return a <= b ? 1 : 0;
          case ">": return a > b ? 1 : 0;
          case ">=": return a >= b ? 1 : 0;
          case "==": return a === b ? 1 : 0;
          case "!=": return a !== b ? 1 : 0;
        }
      }
    }
  };
  return ev(parseFormula(src));
}

/** All `@refs` a formula reads — used for dependency display and validation. */
export function formulaRefs(formula: FormulaInput): string[] {
  if (typeof formula !== "string") return [];
  const out = new Set<string>();
  const walk = (n: FormulaNode) => {
    if (n.k === "ref") out.add(n.path);
    else if (n.k === "un") walk(n.a);
    else if (n.k === "bin") (walk(n.a), walk(n.b));
    else if (n.k === "tern") (walk(n.c), walk(n.a), walk(n.b));
    else if (n.k === "call") n.args.forEach(walk);
  };
  walk(parseFormula(formula));
  return [...out];
}

/**
 * Substitute formula fragments inside a roll template so it becomes a plain
 * dice expression: "1d8 + @ability.str.mod" -> "1d8 + 3", "[[@prof * 2]]d6" -> "4d6".
 */
export function resolveTemplate(template: string, resolve: Resolver, opts: EvalOptions = {}): string {
  return template
    .replace(/\[\[(.+?)\]\]/g, (_, f: string) => String(Math.floor(evaluate(f, resolve, opts))))
    .replace(/@[A-Za-z_][\w]*(?:-[A-Za-z][\w]*)*(?:\.[\w]+(?:-[A-Za-z][\w]*)*)*/g, (ref) =>
      String(evaluate(ref, resolve, opts)),
    )
    .replace(/\+\s*-/g, "- ")
    .replace(/-\s*-/g, "+ ");
}
