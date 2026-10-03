import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Slot } from "../../app/slot";
import { ArrowLeft, ArrowRight, Check, ChevronUp, Redo2, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useCharacter, useLeaveIfMissing } from "../../app/characters";
import { useT } from "../../app/i18n";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { useIsDesktop } from "../../ui/hooks";
import { Sheet } from "../../ui/Sheet";
import { LiveSheet } from "./LiveSheet";
import { BuilderProvider, pendingByStep, STEPS, useBuilder, type StepId } from "./state";
import { AbilitiesStep } from "./steps/AbilitiesStep";
import { ChoicesStep } from "./steps/ChoicesStep";
import { ClassStep } from "./steps/ClassStep";
import { DetailsStep } from "./steps/DetailsStep";
import { OriginStep } from "./steps/OriginStep";
import { ReviewStep } from "./steps/ReviewStep";

export function BuilderPage() {
  const { id } = useParams({ from: "/c/$id/build" });
  const character = useCharacter(id);
  useLeaveIfMissing(character);
  if (!character) return null;
  return (
    <BuilderProvider character={character}>
      <Builder />
    </BuilderProvider>
  );
}

function Builder() {
  const t = useT();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const search = useSearch({ from: "/c/$id/build" });
  const { character, build, sheet, engine, undo, redo, canUndo, canRedo } = useBuilder();
  const step: StepId = (STEPS as readonly string[]).includes(search.step ?? "") ? (search.step as StepId) : build.levels.length ? "choices" : "class";
  const idx = STEPS.indexOf(step);
  const [dir, setDir] = useState(1);
  const pending = pendingByStep(sheet, build);
  const accent = engine.reg.get(build.levels[0]?.classId ?? "")?.accent;

  /** Switch step; with `anchor`, land on that element of the new step (e.g. a choice still open). */
  const goto = (s: StepId, anchor?: string) => {
    setDir(STEPS.indexOf(s) >= idx ? 1 : -1);
    void navigate({ to: "/c/$id/build", params: { id: character.id }, search: { step: s, from: search.from }, replace: true });
    if (!anchor) return window.scrollTo({ top: 0, behavior: "smooth" });
    const until = Date.now() + 1500;
    const find = () => {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (Date.now() < until) requestAnimationFrame(find);
    };
    // wait out the step transition so the target is the new step's element
    setTimeout(find, s === step ? 0 : 320);
  };

  // the header's height, for things that stick right under it (the step's to-do bar)
  const head = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = head.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--builder-head", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--builder-head");
    };
  }, []);

  // set on <html> so portaled drawers/popovers share the class colour
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("class-transition");
    if (accent) root.style.setProperty("--class", accent);
    else root.style.removeProperty("--class");
  }, [accent]);
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--class");
      document.documentElement.classList.remove("class-transition");
    },
    [],
  );

  // pin the initial step so later build changes don't move the user (and land on `focus` once)
  useEffect(() => {
    if (search.focus) goto(step, search.focus);
    else if (search.step !== step) void navigate({ to: "/c/$id/build", params: { id: character.id }, search: { step, from: search.from }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="min-h-dvh">
      {/* class-tinted ambience */}
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(900px_500px_at_80%_-10%,color-mix(in_oklab,var(--class)_22%,transparent),transparent_70%)] transition-opacity" />

      <header ref={head} className="safe-t glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex max-w-[90rem] items-center gap-2 px-3 pt-3 pb-2 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(search.from === "sheet" ? { to: "/c/$id", params: { id: character.id } } : { to: "/" })} aria-label={t("common.back")}>
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg leading-tight">{character.name}</div>
            <div className="truncate text-xs text-ink-3">{t(`builder.stepHint.${step}`)}</div>
          </div>
          <Slot name="builder.toolbar" />
          <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={undo} aria-label={t("common.undo")}>
            <Undo2 size={17} />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={redo} aria-label={t("common.redo")}>
            <Redo2 size={17} />
          </Button>
        </div>
        <StepNav step={step} pending={pending} onStep={goto} />
      </header>

      <div className="relative mx-auto max-w-[90rem] px-4 pt-5 pb-32 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 lg:pb-16">
        <main className="min-w-0">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: 28 * d }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: -20 * d }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === "class" && <ClassStep />}
              {step === "origin" && <OriginStep />}
              {step === "abilities" && <AbilitiesStep />}
              {step === "choices" && <ChoicesStep />}
              {step === "details" && <DetailsStep />}
              {step === "review" && <ReviewStep goto={goto} />}
            </motion.div>
          </AnimatePresence>

          {step !== "review" && (
            <div className="mt-8 hidden justify-between lg:flex">
              <Button variant="ghost" disabled={idx === 0} onClick={() => goto(STEPS[idx - 1]!)}>
                <ArrowLeft size={16} /> {idx > 0 && t(`builder.steps.${STEPS[idx - 1]}`)}
              </Button>
              <Button variant="class" onClick={() => goto(STEPS[idx + 1]!)}>
                {t(`builder.steps.${STEPS[idx + 1]}`)} <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </main>

        {desktop && (
          <aside className="sticky top-32 self-start">
            <div className="card max-h-[calc(100dvh-9rem)] overflow-y-auto p-4">
              <LiveSheet />
            </div>
          </aside>
        )}
      </div>

      {!desktop && <MobileBar idx={idx} goto={goto} />}
    </div>
  );
}

function StepNav({ step, pending, onStep }: { step: StepId; pending: Record<StepId, number>; onStep: (s: StepId) => void }) {
  const t = useT();
  return (
    <nav className="no-scrollbar mx-auto flex max-w-[90rem] gap-1 overflow-x-auto px-3 pb-2 sm:px-6">
      {STEPS.map((s, i) => {
        const active = s === step;
        const done = pending[s] === 0 && s !== "review" && s !== "details";
        return (
          <button key={s} onClick={() => onStep(s)} aria-label={pending[s] > 0 ? `${t(`builder.steps.${s}`)} · ${t("builder.pending", { n: pending[s] })}` : undefined} className={cn("relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors", active ? "text-ink" : "text-ink-3 hover:text-ink-2")}>
            {active && <motion.span layoutId="step-pill" className="absolute inset-0 rounded-full border border-class/50 bg-class/15" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            {/* the circle is always the step's number (or ✓); what's still open is a separate badge */}
            <span
              className={cn(
                "tnum relative flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                done ? "bg-class text-class-ink" : active ? "bg-ink text-bg" : "bg-surface-3 text-ink-3",
              )}
            >
              {done ? <Check size={11} strokeWidth={3.5} /> : i + 1}
            </span>
            <span className="relative">{t(`builder.steps.${s}`)}</span>
            {pending[s] > 0 && <span className="tnum relative -ml-0.5 rounded-full bg-warn/20 px-1.5 text-[10px] leading-4 font-semibold text-warn">{pending[s]}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function MobileBar({ idx, goto }: { idx: number; goto: (s: StepId) => void }) {
  const t = useT();
  const { sheet, preview } = useBuilder();
  const [open, setOpen] = useState(false);
  const s = preview?.sheet ?? sheet;
  const next = STEPS[idx + 1];
  // its height, so things pinned above it (a picker's Choose button) clear it on every phone
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--builder-foot", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--builder-foot");
    };
  }, []);
  return (
    <>
      <div ref={bar} className="safe-b glass fixed inset-x-0 bottom-0 z-30 border-t border-line">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => setOpen(true)} aria-label={t("builder.preview")} className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-xl px-2 py-1 text-left active:bg-surface-3/60">
            <Stat label={t("sheet.hp")} value={s.hpMax} tone="text-hp" />
            <Stat label={t("sheet.ac")} value={s.ac} />
            <Stat label={t("sheet.initShort")} value={s.initiative} signed />
            <Stat label={t("sheet.profShort")} value={s.prof} signed />
            <ChevronUp size={16} className="ml-auto text-ink-3" />
          </button>
          {next && (
            <Button variant="class" size="md" onClick={() => goto(next)}>
              {t(`builder.steps.${next}`)} <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen} title={t("builder.preview")}>
        <LiveSheet />
      </Sheet>
    </>
  );
}

function Stat({ label, value, tone, signed }: { label: string; value: number; tone?: string; signed?: boolean }) {
  return (
    <div className="shrink-0 text-center">
      <div className="text-[10px] tracking-wider text-ink-3 uppercase">{label}</div>
      <div className={cn("tnum font-display text-base leading-tight", tone)}>{signed && value >= 0 ? `+${value}` : value}</div>
    </div>
  );
}
