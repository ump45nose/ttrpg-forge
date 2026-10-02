import type { PackRegistry } from "../pack/registry";
import type { Entity } from "../schema/types";
import { allVariants, type LocalizedText } from "../text";

/**
 * Rules-term index for Paradox-style nested tooltips. Any entity can be a
 * term; text links terms explicitly with {{id}} / {{id|label}}, and plain
 * prose is auto-linked by name for the kinds listed in AUTO_TYPES.
 */

export interface GlossaryTerm {
  id: string;
  name: LocalizedText;
  /** rule category, entity type, or "mastery" */
  category: string;
  summary?: LocalizedText;
  text?: LocalizedText;
  entity: Entity;
  autoLink: boolean;
}

/** A link without a label shows the term's localized name. */
export type RichToken = string | { id: string; label?: string };

/** Entity kinds whose names are recognised in plain prose. Others need explicit {{id}} markup. */
const AUTO_TYPES = new Set(["rule", "condition", "spell"]);
const MIN_ZH = 2;
const MIN_EN = 3;
const CJK = /[㐀-鿿]/;

function categoryOf(e: Entity): string {
  if (e.type === "rule") return e.category ?? "term";
  if (e.tags?.includes("mastery-property")) return "mastery";
  return e.type;
}

export class Glossary {
  private readonly terms = new Map<string, GlossaryTerm>();
  private readonly byName = new Map<string, string>();
  private matcher: RegExp | null = null;

  constructor(reg: PackRegistry) {
    for (const type of ["rule", "condition", "spell", "feat", "effect", "species", "class", "subclass", "background", "item"] as const) {
      for (const e of reg.all(type)) {
        if (e.type === "effect" && !e.tags?.includes("mastery-property")) continue;
        const auto = (AUTO_TYPES.has(e.type) || e.tags?.includes("mastery-property") === true) && !e.tags?.includes("no-autolink");
        this.terms.set(e.id, { id: e.id, name: e.name, category: categoryOf(e), summary: e.summary, text: e.text, entity: e, autoLink: auto });
        if (!auto) continue;
        for (const n of new Set([...allVariants(e.name), ...(e.aliases ?? [])])) {
          const name = n.trim();
          if (name.length < (CJK.test(name) ? MIN_ZH : MIN_EN)) continue;
          // first definition wins so rules beat same-named spells or items
          if (!this.byName.has(name)) this.byName.set(name, e.id);
        }
      }
    }
  }

  get(id: string): GlossaryTerm | undefined {
    return this.terms.get(id);
  }

  has(id: string): boolean {
    return this.terms.has(id);
  }

  get size(): number {
    return this.terms.size;
  }

  /** Longest names first so 攻击检定 wins over 攻击 and Bonus Action over Action. */
  private regex(): RegExp | null {
    if (this.matcher !== null) return this.matcher;
    const names = [...this.byName.keys()].sort((a, b) => b.length - a.length);
    if (!names.length) return null;
    const alt = names.map((n) => {
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      // English terms match whole words, case-sensitively (2024 rules capitalise terms)
      return CJK.test(n) ? esc : `(?<![A-Za-z])${esc}(?![A-Za-z])`;
    });
    this.matcher = new RegExp(alt.join("|"), "g");
    return this.matcher;
  }

  /**
   * Split text into plain strings and term links. Explicit markup always links;
   * auto-linking links each term once per text and never links `selfId`.
   */
  tokenize(text: string, opts: { auto?: boolean; selfId?: string } = {}): RichToken[] {
    const out: RichToken[] = [];
    const linked = new Set<string>(opts.selfId ? [opts.selfId] : []);
    const push = (t: RichToken) => {
      const last = out[out.length - 1];
      if (typeof t === "string" && typeof last === "string") out[out.length - 1] = last + t;
      else if (t !== "") out.push(t);
    };
    const plain = (s: string) => {
      const re = opts.auto === false ? null : this.regex();
      if (!re) return push(s);
      let at = 0;
      re.lastIndex = 0;
      for (const m of s.matchAll(re)) {
        const id = this.byName.get(m[0]) ?? this.byName.get(m[0].replace(/\s+/g, " "));
        if (!id || linked.has(id)) continue;
        linked.add(id);
        push(s.slice(at, m.index));
        push({ id, label: m[0] });
        at = m.index! + m[0].length;
      }
      push(s.slice(at));
    };

    const explicit = /\{\{([a-z][\w-]*:[^|}]+)(?:\|([^}]*))?\}\}/g;
    let at = 0;
    for (const m of text.matchAll(explicit)) {
      plain(text.slice(at, m.index));
      const id = m[1]!.trim();
      const term = this.terms.get(id);
      const label = m[2]?.trim() || undefined;
      if (term) {
        linked.add(id);
        push(label ? { id, label } : { id });
      } else push(label ?? id.split(":").pop()!);
      at = m.index! + m[0].length;
    }
    plain(text.slice(at));
    return out;
  }
}

/** Remove {{id|label}} markup, keeping labels (for plain-text contexts like search or export). */
export function stripTermMarkup(text: string): string {
  return text.replace(/\{\{([a-z][\w-]*:[^|}]+)(?:\|([^}]*))?\}\}/g, (_, id: string, label?: string) => label ?? id.split(":").pop()!);
}
