import { useState } from "react";
import { useL, useT } from "../../app/i18n";
import { cn } from "../../ui/cn";
import { namedGlyph } from "../../ui/glyphs";
import { Sheet } from "../../ui/Sheet";
import { Tabs } from "../../ui/Tabs";
import { usePlay } from "./play";

const DURATIONS: { id: string; rounds?: number }[] = [{ id: "none" }, { id: "1", rounds: 1 }, { id: "10", rounds: 10 }, { id: "100", rounds: 100 }];

/** Apply a condition or a buff to yourself. */
export function EffectPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const l = useL();
  const { engine, state, push } = usePlay();
  const [tab, setTab] = useState<"condition" | "effect">("condition");
  const [dur, setDur] = useState("none");
  const list = engine.reg
    .all(tab)
    .filter((e) => tab === "condition" || !e.tags?.includes("mastery-property"));
  const active = new Set(state.effects.map((e) => e.effect));

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("sheet.addEffect")} width="md">
      <div className="space-y-3">
        <Tabs
          items={[
            { id: "condition", label: t("sheet.conditions") },
            { id: "effect", label: t("sheet.buffs") },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <span className="shrink-0">{t("sheet.duration")}</span>
          <Tabs size="sm" className="flex-1" items={DURATIONS.map((d) => ({ id: d.id, label: d.rounds ? t("sheet.rounds", { n: d.rounds }) : t("sheet.untilRemoved") }))} value={dur} onChange={setDur} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((e) => {
            const Icon = namedGlyph("icon" in e ? e.icon : undefined);
            const on = active.has(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  if (on && e.id !== "condition:exhaustion") push({ type: "effect.remove", effect: e.id });
                  else push({ type: "effect.add", effect: e.id, rounds: DURATIONS.find((d) => d.id === dur)?.rounds });
                  onOpenChange(false);
                }}
                className={cn(
                  "flex min-w-0 items-start gap-2 rounded-xl border p-2.5 text-left transition-colors",
                  on ? (tab === "condition" ? "border-warn/60 bg-warn/12" : "border-good/60 bg-good/12") : "border-line bg-surface/60 hover:border-line-strong",
                )}
              >
                <Icon size={16} className={cn("mt-0.5 shrink-0", tab === "condition" ? "text-warn" : "text-good")} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{l(e.name, { mono: true })}</span>
                  <span className="line-clamp-2 text-[11px] leading-snug text-ink-3">{l(e.summary ?? e.text, { mono: true })}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
