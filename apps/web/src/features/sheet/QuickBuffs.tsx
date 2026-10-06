import { ArrowDown, ArrowUp, Pin, Plus, SlidersHorizontal, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useCharacters } from "../../app/characters";
import { useL, useT } from "../../app/i18n";
import { haptic } from "../../app/settings";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Switch } from "../../ui/Field";
import { namedGlyph } from "../../ui/glyphs";
import { Sheet } from "../../ui/Sheet";
import { RichText } from "../terms/RichText";
import { buffEffects, quickBuffs, suggestedBuffs, type QuickBuff } from "./buffs";
import { usePlay } from "./play";

/** One tap on, one tap off: the buffs this character keeps reaching for (Bless, Rage, Hunter's Mark...). */
export function QuickBuffChips({ onConfigure }: { onConfigure: () => void }) {
  const t = useT();
  const l = useL();
  const { character, engine, sheet, state, push } = usePlay();
  const list = quickBuffs(character, engine.reg, sheet);
  const toggle = (b: QuickBuff) => {
    haptic(8);
    if (state.effects.some((e) => e.effect === b.effect)) push({ type: "effect.remove", effect: b.effect });
    else push({ type: "effect.add", effect: b.effect, ...(b.persistent ? { persistent: true } : {}) });
  };
  return (
    <>
      {list.map((b) => {
        const ent = engine.reg.get(b.effect)!;
        const Icon = namedGlyph("icon" in ent ? ent.icon : undefined);
        const on = state.effects.some((e) => e.effect === b.effect);
        return (
          <motion.button
            key={b.effect}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => toggle(b)}
            aria-pressed={on}
            className={cn(
              "hit relative inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
              on ? "border-good/50 bg-good/15 text-good" : "border-line bg-surface/40 text-ink-3 hover:border-line-strong hover:text-ink-2",
            )}
          >
            <Icon size={12} />
            {l(ent.name, { mono: true })}
            {b.persistent && <Pin size={10} className="opacity-70" aria-label={t("buffs.persistent")} />}
          </motion.button>
        );
      })}
      <button type="button" onClick={onConfigure} aria-label={t("buffs.configure")} title={t("buffs.configure")} className="hit relative inline-flex items-center rounded-full border border-dashed border-line-strong px-1.5 py-0.5 text-ink-3 transition-colors hover:border-accent/50 hover:text-accent">
        <SlidersHorizontal size={12} />
      </button>
    </>
  );
}

/** Which buffs get a switch on this sheet, in what order, and which ones stay on through rests. */
export function BuffConfigSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const l = useL();
  const update = useCharacters((s) => s.update);
  const { character, engine, sheet, state, push } = usePlay();
  const list = quickBuffs(character, engine.reg, sheet);
  const suggested = suggestedBuffs(engine.reg, sheet);
  const chosen = new Set(list.map((b) => b.effect));
  const rest = buffEffects(engine.reg)
    .filter((e) => !chosen.has(e.id))
    .sort((a, b) => Number(suggested.includes(b.id)) - Number(suggested.includes(a.id)));
  const save = (next: QuickBuff[] | undefined) => update(character.id, (c) => ({ ...c, meta: { ...c.meta, quickBuffs: next } }));
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    save(next);
  };
  const setPersistent = (b: QuickBuff, persistent: boolean) => {
    save(list.map((x) => (x.effect === b.effect ? { effect: x.effect, ...(persistent ? { persistent } : {}) } : x)));
    // already on: switch it again so the change applies now, not next time
    if (state.effects.some((e) => e.effect === b.effect && !!e.persistent !== persistent)) {
      push({ type: "effect.remove", effect: b.effect });
      push({ type: "effect.add", effect: b.effect, ...(persistent ? { persistent } : {}) });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={t("buffs.title")} width="md">
      <div className="space-y-5">
        <p className="text-sm text-ink-2">{t("buffs.hint")}</p>
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("buffs.onSheet")}</h3>
          {list.length ? (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {list.map((b, i) => {
                const ent = engine.reg.get(b.effect)!;
                const Icon = namedGlyph("icon" in ent ? ent.icon : undefined);
                return (
                  <div key={b.effect} className="bg-surface/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Icon size={15} className="shrink-0 text-good" />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{l(ent.name, { mono: true })}</span>
                      <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("buffs.up")}>
                        <ArrowUp size={15} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={t("buffs.down")}>
                        <ArrowDown size={15} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => save(list.filter((x) => x.effect !== b.effect))} aria-label={t("common.remove")}>
                        <X size={15} />
                      </Button>
                    </div>
                    {ent.text && <RichText text={ent.summary ?? ent.text} selfId={ent.id} className="block text-xs leading-relaxed text-ink-3" />}
                    <Switch checked={!!b.persistent} onChange={(v) => setPersistent(b, v)} label={<span className="text-sm">{t("buffs.persistent")}</span>} hint={t("buffs.persistentHint")} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-xs text-ink-3">{t("buffs.empty")}</p>
          )}
        </section>
        <section>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("buffs.more")}</h3>
            {character.meta.quickBuffs && (
              <Button variant="ghost" size="sm" onClick={() => save(undefined)}>
                {t("buffs.reset")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rest.map((e) => {
              const Icon = namedGlyph(e.icon);
              return (
                <button key={e.id} type="button" onClick={() => save([...list, { effect: e.id }])} className="flex min-w-0 items-start gap-2 rounded-xl border border-line bg-surface/60 p-2.5 text-left transition-colors hover:border-good/50">
                  <Icon size={15} className="mt-0.5 shrink-0 text-good" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-ink">{l(e.name, { mono: true })}</span>
                      {suggested.includes(e.id) && <span className="shrink-0 rounded-full bg-accent/15 px-1.5 text-[10px] text-accent">{t("buffs.suggested")}</span>}
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-snug text-ink-3">{l(e.summary ?? e.text, { mono: true })}</span>
                  </span>
                  <Plus size={15} className="mt-0.5 shrink-0 text-ink-3" />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </Sheet>
  );
}
