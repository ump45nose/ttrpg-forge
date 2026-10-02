import { Check, X } from "lucide-react";
import { useSettings } from "../../../app/settings";
import type { ReactNode } from "react";
import { cn } from "../../../ui/cn";

/** Toggle chips for picking from a small fixed set. */
export function MultiPick<T extends string>({ options, value, onChange, max }: { options: { id: T; label: ReactNode }[]; value: T[]; onChange: (v: T[]) => void; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.id);
        const full = !on && max !== undefined && value.length >= max;
        return (
          <button
            key={o.id}
            type="button"
            disabled={full}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : max === 1 ? [o.id] : [...value, o.id])}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm transition-colors",
              on ? "border-accent bg-accent/15 text-ink" : "border-line text-ink-2 hover:border-line-strong",
              full && "opacity-40",
            )}
          >
            {on && <Check size={13} className="text-accent" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Removable tag list (picked entities). */
export function TagList({ items, onRemove }: { items: { id: string; label: ReactNode }[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span key={it.id} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-3/60 py-1 pr-1 pl-2.5 text-sm">
          {it.label}
          <button type="button" onClick={() => onRemove(it.id)} className="rounded p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink">
            <X size={13} />
          </button>
        </span>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink-2">{label}</span>
        {hint && <span className="text-xs text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Native select styled like Input (best on phones: the OS picker). */
export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn("h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent", className)}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Number or formula: numeric strings become numbers so plain values stay plain in JSON. */
export const toFormula = (s: string): string | number => (/^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s.trim()) : s.trim());

/** Locale the author is writing in: form text is stored for both languages unless untouched. */
export const useLocale = (): "en" | "zh" => useSettings((s) => (s.locale === "en" ? "en" : "zh"));
