import { ArrowLeft, Pin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useL, useT } from "../../app/i18n";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Sheet } from "../../ui/Sheet";
import { useGlossary } from "./glossary";
import { RichText } from "./RichText";
import { LOCK_DELAY, termHover, useTerms, type TipEntry } from "./store";
import { TermDepth } from "./Term";

/** Renders open term tooltips (desktop) and the term card stack (touch). Mount once at the root. */
export function TermLayer() {
  const tips = useTerms((s) => s.tips);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && termHover.closeAll();
    const onScroll = () => useTerms.getState().tips.length && termHover.closeAll();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <>
      {createPortal(
        <AnimatePresence>
          {tips.map((tip, level) => (
            <Tip key={tip.key} tip={tip} level={level} />
          ))}
        </AnimatePresence>,
        document.body,
      )}
      <TermSheet />
    </>
  );
}

function Tip({ tip, level }: { tip: TipEntry; level: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean }>();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = tip.rect.bottom + 8;
    const above = vh - below < h + 8 && tip.rect.top - h - 8 > 8;
    setPos({ left: Math.max(8, Math.min(tip.rect.left - 12, vw - w - 8)), top: above ? tip.rect.top - h - 8 : Math.min(below, vh - h - 8), above });
  }, [tip.rect]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: pos?.above ? 4 : -4, scale: 0.98 }}
      animate={{ opacity: pos ? 1 : 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, zIndex: 60 + level }}
      onMouseEnter={() => termHover.enterTip(level)}
      onMouseLeave={() => termHover.leaveTip(level)}
      onMouseDown={() => useTerms.getState().lock(level)}
      className={cn(
        "fixed w-[22rem] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border bg-surface-2/97 shadow-float backdrop-blur-md",
        tip.locked ? "pointer-events-auto border-accent/60" : "pointer-events-none border-line-strong",
      )}
    >
      <TermDepth.Provider value={level + 1}>
        <TermBody id={tip.id} scroll />
      </TermDepth.Provider>
      {/* Paradox-style lock progress: fills while the pointer rests on the term */}
      <div className="h-[3px] bg-surface-3">
        {tip.locked ? (
          <div className="h-full w-full bg-accent" />
        ) : (
          <motion.div className="h-full bg-accent/70" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: LOCK_DELAY / 1000, ease: "linear" }} />
        )}
      </div>
    </motion.div>
  );
}

export function TermBody({ id, scroll = false, headless = false }: { id: string; scroll?: boolean; headless?: boolean }) {
  const t = useT();
  const l = useL();
  const g = useGlossary();
  const term = g.get(id);
  if (!term) return null;
  const main = l(term.name, { mono: true });
  const other = typeof term.name === "object" ? (main === term.name.en ? term.name.zh : term.name.en) : undefined;
  const e = term.entity;
  return (
    <div className={cn(headless ? "pb-2" : "p-4", scroll && "max-h-[60vh] overflow-y-auto overscroll-contain")}>
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {!headless && <div className="font-display text-base leading-tight text-ink">{main}</div>}
          {other && other !== main && <div className="text-xs text-ink-3">{other}</div>}
        </div>
        <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] tracking-wider text-ink-2 uppercase">{t(`termCat.${term.category}`, { defaultValue: term.category })}</span>
      </div>
      {e.type === "spell" && (
        <div className="mb-2 flex flex-wrap gap-x-3 text-xs text-ink-3">
          <span>{e.level === 0 ? t("spell.cantrip") : t("spell.level", { n: e.level })}</span>
          <span>{l(e.castingTime)}</span>
          <span>{l(e.range)}</span>
          <span>{l(e.duration)}</span>
        </div>
      )}
      {e.type === "item" && (e.armor || e.weapon || e.weight || e.cost) && (
        <div className="mb-2 flex flex-wrap gap-x-3 text-xs text-ink-3">
          {e.armor && <span>{e.armor.category === "shield" ? `AC +${e.armor.ac}` : `AC ${e.armor.ac}`}</span>}
          {e.weapon && (
            <span>
              {e.weapon.damage} {t(`damage.${e.weapon.damageType}`, { defaultValue: e.weapon.damageType })}
            </span>
          )}
          {e.weight ? <span>{e.weight} lb</span> : null}
          {e.cost && <span>{e.cost}</span>}
        </div>
      )}
      <RichText text={term.text ?? term.summary} selfId={id} className="text-sm leading-relaxed text-ink-2" />
    </div>
  );
}

function TermSheet() {
  const t = useT();
  const l = useL();
  const g = useGlossary();
  const sheet = useTerms((s) => s.sheet);
  const { pop, closeSheet } = useTerms.getState();
  const id = sheet.at(-1);
  const term = id ? g.get(id) : undefined;
  return (
    <Sheet
      open={!!id}
      onOpenChange={(o) => !o && closeSheet()}
      title={
        <span className="flex items-center gap-2">
          {sheet.length > 1 && (
            <Button variant="ghost" size="icon-sm" onClick={pop} aria-label={t("common.back")}>
              <ArrowLeft size={16} />
            </Button>
          )}
          <span className="truncate">{term ? l(term.name, { mono: true }) : ""}</span>
        </span>
      }
      description={
        sheet.length > 1 ? (
          <span className="flex flex-wrap items-center gap-1 text-xs">
            <Pin size={11} />
            {sheet.map((s) => l(g.get(s)?.name, { mono: true })).join(" › ")}
          </span>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {id && (
          <motion.div key={`${sheet.length}-${id}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}>
            <TermDepth.Provider value={1}>
              <TermBody id={id} headless />
            </TermDepth.Provider>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
