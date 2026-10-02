import type { FeatureGrant, Grant, LocalizedText } from "@forge/core";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "../../../app/i18n";
import { Button } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { Textarea } from "../../../ui/Field";
import { newFeature } from "./classTemplate";
import { Select, useLocale } from "./fields";
import { LocalizedInput, MechanicsEditor, type MechanicsContext } from "./MechanicsEditor";
import { L, plain } from "./templates";

/**
 * Level-by-level feature editor shared by classes and subclasses. Features get name / text /
 * mechanics; other grants at a level (choices the form doesn't generate) are edited as mechanics.
 * `generated` shows what the class form adds itself (subclass pick, ASI, spell choices).
 */
export function LevelsEditor({
  levels,
  onChange,
  from = 1,
  to = 20,
  generated = {},
  ctx,
}: {
  levels: Record<string, Grant[]>;
  onChange: (l: Record<string, Grant[]>) => void;
  from?: number;
  to?: number;
  generated?: Record<number, ReactNode[]>;
  ctx?: MechanicsContext;
}) {
  const t = useT();
  const used = Object.keys(levels)
    .map(Number)
    .filter((l) => levels[String(l)]!.length);
  const shown = [...new Set([...used, ...Object.keys(generated).map(Number)])].filter((l) => l >= from && l <= to).sort((a, b) => a - b);
  const free = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((l) => !shown.includes(l));
  const setLevel = (lvl: number, gs: Grant[]) => onChange({ ...levels, [String(lvl)]: gs });

  return (
    <div className="space-y-3">
      {shown.map((lvl) => {
        const gs = levels[String(lvl)] ?? [];
        const features = gs.filter((g): g is FeatureGrant => g.type === "feature");
        const others = gs.filter((g) => g.type !== "feature");
        const write = (fs: FeatureGrant[], os: Grant[]) => setLevel(lvl, [...fs, ...os]);
        return (
          <section key={lvl} className="rounded-2xl border border-line bg-surface/40 p-3">
            <header className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-display text-base text-class">{t("common.levelN", { n: lvl })}</span>
              {generated[lvl]?.map((g, i) => (
                <span key={i} className="rounded-md border border-line bg-surface-3/50 px-1.5 py-0.5 text-[11px] text-ink-3">
                  {g}
                </span>
              ))}
            </header>
            <div className="space-y-2">
              {features.map((f, i) => (
                <FeatureCard
                  key={f.id}
                  f={f}
                  ctx={ctx}
                  onChange={(nf) => write(features.map((x, j) => (j === i ? nf : x)), others)}
                  onRemove={() => write(features.filter((_, j) => j !== i), others)}
                />
              ))}
              {others.length > 0 && <MechanicsEditor grants={others} onChange={(os) => write(features, os)} ctx={ctx} />}
              <Button type="button" variant="ghost" size="sm" onClick={() => write([...features, newFeature() as FeatureGrant], others)}>
                <Plus size={14} /> {t("workshop.addFeature")}
              </Button>
            </div>
          </section>
        );
      })}
      {free.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            value=""
            onChange={(v) => v && setLevel(Number(v), [...(levels[v] ?? []), newFeature() as FeatureGrant])}
            options={[{ id: "", label: t("workshop.addLevel") }, ...free.map((l) => ({ id: String(l), label: t("common.levelN", { n: l }) }))]}
            className="max-w-xs"
          />
        </div>
      )}
    </div>
  );
}

function FeatureCard({ f, onChange, onRemove, ctx }: { f: FeatureGrant; onChange: (f: FeatureGrant) => void; onRemove: () => void; ctx?: MechanicsContext }) {
  const t = useT();
  const locale = useLocale();
  const isNew = plain(f.name, locale) === "";
  const [open, setOpen] = useState(isNew);
  const n = f.grants?.length ?? 0;
  return (
    <div className={cn("rounded-xl border bg-surface/60", open ? "border-line-strong" : "border-line")}>
      <div className="flex items-center gap-2 py-2 pr-1 pl-3">
        <button type="button" onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{plain(f.name, locale) || t("workshop.untitled")}</span>
            {!open && f.text && <span className="block truncate text-xs text-ink-3">{plain(f.text, locale)}</span>}
          </span>
          {n > 0 && <span className="shrink-0 rounded bg-accent/15 px-1.5 text-[10px] text-accent">{t("workshop.mechanicsN", { n })}</span>}
          <ChevronDown size={14} className={cn("shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
        </button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={onRemove}>
          <Trash2 size={14} />
        </Button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-line px-3 pt-3 pb-3">
          <LocalizedInput value={f.name} placeholder={t("homebrew.traitName")} onChange={(name) => onChange({ ...f, name: name ?? L("?") })} />
          <LocalizedTextarea value={f.text} placeholder={t("homebrew.traitText")} onChange={(text) => onChange({ ...f, text })} />
          <div>
            <div className="mb-1 text-xs font-medium text-ink-2">{t("workshop.mechanics")}</div>
            <MechanicsEditor grants={f.grants ?? []} onChange={(grants) => onChange({ ...f, grants })} ctx={ctx} emptyHint={t("workshop.mechanicsEmpty")} />
          </div>
        </div>
      )}
    </div>
  );
}

export function LocalizedTextarea({ value, onChange, placeholder, rows = 3 }: { value: LocalizedText | undefined; onChange: (v: LocalizedText | undefined) => void; placeholder?: string; rows?: number }) {
  const locale = useLocale();
  return <Textarea rows={rows} value={plain(value, locale)} placeholder={placeholder} onChange={(e) => onChange(e.target.value ? L(e.target.value) : undefined)} />;
}
