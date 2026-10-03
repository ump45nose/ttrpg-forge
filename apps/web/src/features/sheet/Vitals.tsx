import { hpCurrent, movementLeft } from "@forge/core";
import { Brain, Heart, Plus, Skull, X } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "../../app/settings";
import { playCue } from "../../app/sound";
import { useL, useT } from "../../app/i18n";
import { AnimatedNumber, signed } from "../../ui/AnimatedNumber";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { namedGlyph } from "../../ui/glyphs";
import { flash } from "../../ui/Fx";
import { toast } from "../../ui/Toast";
import { afterLanding } from "../dice/store";
import { Explain } from "../common/Explain";
import { RichText } from "../terms/RichText";
import { EffectPicker } from "./EffectPicker";
import { HpSheet } from "./HpSheet";
import { usePlay } from "./play";
import { d20, edge, effectName, groupEffects } from "./util";

const isEffect = (type: string | undefined) => type === "condition" || type === "effect";

/** The pinned vitals block: HP, AC, initiative, speed, concentration and conditions. */
export function Vitals() {
  const t = useT();
  const { sheet, state, roll, character } = usePlay();
  const [hpOpen, setHpOpen] = useState(false);
  const hp = hpCurrent(state, sheet);
  const pulse = useHpFeedback(character.id, hp, character.play.at(-1)?.type === "revert");
  const pct = sheet.hpMax ? hp / sheet.hpMax : 0;
  const tempPct = sheet.hpMax ? Math.min(1, state.temp / sheet.hpMax) : 0;
  const dying = hp === 0;
  const move = movementLeft(state, sheet);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          ref={pulse.scope}
          type="button"
          onClick={() => setHpOpen(true)}
          aria-label={`${t("sheet.hp")} ${hp}/${sheet.hpMax}`}
          className={cn("relative min-w-0 flex-[1.6] overflow-hidden rounded-2xl border bg-surface/70 px-3 py-2 text-left transition-colors", dying ? "border-bad/60" : "border-line hover:border-line-strong")}
        >
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-ink-3 uppercase">
            <span className="flex items-center gap-1">
              <Heart size={11} className="text-hp" /> {t("sheet.hp")}
            </span>
            {state.temp > 0 && <span className="tnum text-temp">+{state.temp} {t("sheet.temp")}</span>}
          </div>
          {dying ? (
            <DeathSaves />
          ) : (
            <div className="flex items-baseline gap-1">
              <AnimatedNumber value={hp} className={cn("font-display text-[28px] leading-tight", pct <= 0.25 ? "text-bad" : pct <= 0.5 ? "text-warn" : "text-ink")} />
              <span className="tnum text-sm text-ink-3">/ {sheet.hpMax}</span>
            </div>
          )}
          <AnimatePresence>
            {pulse.kind && (
              <motion.span
                key={pulse.n}
                aria-hidden
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className={cn("pointer-events-none absolute inset-0", pulse.kind === "hurt" ? "bg-hp/35" : "bg-good/25")}
              />
            )}
          </AnimatePresence>
          <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
            {/* the lost chunk lingers a moment before the bar catches up */}
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-warn/60" animate={{ width: `${pct * 100}%` }} transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }} />
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-hp" animate={{ width: `${pct * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-temp/80" animate={{ width: `${tempPct * 100}%` }} />
          </div>
        </button>
        <Stat stat="ac" label={t("sheet.ac")} value={sheet.ac} />
        <button
          type="button"
          onClick={() => void roll({ expr: d20(sheet.initiative), label: t("sheet.initiative"), kind: "initiative", ...edge(sheet, "initiative") })}
          className="min-w-0 flex-1 rounded-2xl border border-line bg-surface/70 px-1 py-2 text-center transition-colors hover:border-accent/50"
        >
          <div className="text-[10px] font-semibold tracking-wider text-ink-3 uppercase">{t("sheet.initiativeShort")}</div>
          <AnimatedNumber value={sheet.initiative} signed className="font-display text-xl" />
        </button>
        <Explain sheet={sheet} stat="speed.walk" title={t("sheet.speed")}>
          <button type="button" className="min-w-0 flex-1 rounded-2xl border border-line bg-surface/70 px-1 py-2 text-center transition-colors hover:border-line-strong">
            <div className="text-[10px] font-semibold tracking-wider text-ink-3 uppercase">{t("sheet.speed")}</div>
            <div className="font-display text-xl">{state.inCombat ? move.left : sheet.speed.walk}</div>
          </button>
        </Explain>
      </div>
      <EffectRow />
      <ConcentrationCheck />
      <HpSheet open={hpOpen} onOpenChange={setHpOpen} />
    </div>
  );
}

/** Flash, shake and sound when current HP changes; a banner when dropping to 0. Undo stays quiet. */
function useHpFeedback(characterId: string, hp: number, undoing: boolean) {
  const t = useT();
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  const prev = useRef({ characterId, hp });
  const [pulse, setPulse] = useState<{ kind?: "hurt" | "heal"; n: number }>({ n: 0 });
  useEffect(() => {
    const p = prev.current;
    prev.current = { characterId, hp };
    if (p.characterId !== characterId || p.hp === hp) return;
    const hurt = hp < p.hp;
    setPulse({ kind: hurt ? "hurt" : "heal", n: Date.now() });
    if (undoing) return;
    playCue(hurt ? "hurt" : "heal");
    if (!hurt) return;
    if (hp === 0) flash("down", t("fx.down"));
    else flash("hurt");
    if (!reducedMotion() && scope.current) void animate(scope.current, { x: [0, -6, 6, -4, 3, 0] }, { duration: 0.35 });
  }, [characterId, hp, undoing, t, animate, scope]);
  return { scope, ...pulse };
}

function Stat({ stat, label, value, signed: sgn }: { stat: string; label: string; value: number; signed?: boolean }) {
  const { sheet } = usePlay();
  return (
    <Explain sheet={sheet} stat={stat} title={label}>
      <button type="button" className="min-w-0 flex-1 rounded-2xl border border-line bg-surface/70 px-1 py-2 text-center transition-colors hover:border-line-strong">
        <div className="text-[10px] font-semibold tracking-wider text-ink-3 uppercase">{label}</div>
        <AnimatedNumber value={value} signed={sgn} className="font-display text-xl" />
      </button>
    </Explain>
  );
}

function DeathSaves() {
  const t = useT();
  const { state } = usePlay();
  const { success, failure } = state.deathSaves;
  return (
    <div className="flex h-[38px] items-center gap-3">
      <Skull size={18} className={failure >= 3 ? "text-bad" : "text-ink-3"} />
      <div className="flex flex-col gap-1">
        <Dots n={success} tone="bg-good" label={t("sheet.hpDialog.success")} />
        <Dots n={failure} tone="bg-bad" label={t("sheet.hpDialog.failure")} />
      </div>
      <span className="text-xs text-bad">{failure >= 3 ? t("sheet.dead") : success >= 3 ? t("sheet.stable") : t("sheet.dying")}</span>
    </div>
  );
}

const Dots = ({ n, tone, label }: { n: number; tone: string; label: string }) => (
  <div className="flex items-center gap-1" aria-label={`${label} ${n}/3`}>
    {[0, 1, 2].map((i) => (
      <span key={i} className={cn("h-2.5 w-2.5 rounded-full border border-line-strong", i < n && `${tone} border-transparent`)} />
    ))}
  </div>
);

/** Concentration marker plus one chip per active condition / effect. */
function EffectRow() {
  const t = useT();
  const l = useL();
  const { engine, sheet, state, push } = usePlay();
  const [pick, setPick] = useState(false);
  const groups = groupEffects(state.effects);
  const conc = state.concentration;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {conc && (
        <span className="inline-flex items-center gap-1 rounded-full border border-magic/40 bg-magic/12 py-0.5 pr-0.5 pl-2 text-xs text-magic">
          <Brain size={12} />
          {t("sheet.concentrating", { name: l(effectName(engine, sheet, { effect: state.effects.find((e) => e.key === conc.key)?.effect ?? conc.source, source: conc.source, label: conc.label }), { mono: true }) })}
          <button type="button" aria-label={t("sheet.endConcentration")} className="hit relative rounded-full p-0.5 hover:bg-magic/20" onClick={() => push({ type: "concentration.end" })}>
            <X size={12} />
          </button>
        </span>
      )}
      <AnimatePresence initial={false}>
        {groups
          // a concentration marker for a spell is already shown by the concentration pill
          .filter((g) => !(g.effect.concentration && !isEffect(engine.reg.get(g.effect.effect)?.type)))
          .map(({ effect: e, count }) => {
            const ent = engine.reg.get(e.effect);
            const Icon = namedGlyph(ent && "icon" in ent ? ent.icon : undefined);
            const condition = ent?.type === "condition";
            return (
              <motion.span key={e.key} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                        condition ? "border-warn/40 bg-warn/12 text-warn" : "border-good/40 bg-good/12 text-good",
                      )}
                    >
                      <Icon size={12} />
                      {l(effectName(engine, sheet, e), { mono: true })}
                      {count > 1 && <b className="tnum">{count}</b>}
                      {e.rounds !== undefined && state.inCombat && e.rounds <= 100 && <span className="tnum opacity-70">·{e.rounds}</span>}
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content sideOffset={6} collisionPadding={12} className="z-50 w-72 rounded-2xl border border-line-strong bg-surface-2 p-3 shadow-float outline-none">
                      <div className="mb-1 flex items-center gap-2 font-display text-base text-ink">
                        <Icon size={15} /> {l(effectName(engine, sheet, e))}
                        {count > 1 && <span className="tnum text-sm text-ink-3">×{count}</span>}
                      </div>
                      {e.rounds !== undefined && <div className="mb-1 text-xs text-ink-3">{t("sheet.rounds", { n: e.rounds })}</div>}
                      {ent?.text && <RichText text={ent.summary ?? ent.text} selfId={ent.id} className="text-sm text-ink-2" />}
                      <div className="mt-3 flex gap-2">
                        <Popover.Close asChild>
                          <Button size="sm" variant="danger" onClick={() => push({ type: "effect.remove", effect: e.effect })}>
                            {count > 1 ? t("sheet.removeOne") : t("common.remove")}
                          </Button>
                        </Popover.Close>
                        {count > 0 && e.effect === "condition:exhaustion" && (
                          <Popover.Close asChild>
                            <Button size="sm" onClick={() => push({ type: "effect.add", effect: e.effect })}>
                              +1
                            </Button>
                          </Popover.Close>
                        )}
                      </div>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </motion.span>
            );
          })}
      </AnimatePresence>
      {/* small to look at, but a finger-sized target */}
      <button type="button" onClick={() => setPick(true)} aria-label={t("sheet.addEffect")} className="hit relative inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-xs text-ink-3 transition-colors hover:border-accent/50 hover:text-accent">
        <Plus size={12} /> {groups.length || conc ? "" : t("sheet.addEffect")}
      </button>
      <EffectPicker open={pick} onOpenChange={setPick} />
    </div>
  );
}

/** After damage while concentrating: roll the Con save, or record the result. */
function ConcentrationCheck() {
  const t = useT();
  const { sheet, state, conCheck, setConCheck, roll, push } = usePlay();
  if (conCheck === null || !state.concentration) return null;
  const lose = () => {
    push({ type: "concentration.end" });
    setConCheck(null);
    flash("conc", t("fx.concLost"));
  };
  const doRoll = async () => {
    const r = await roll({ expr: d20(sheet.abilities.con.save), label: t("sheet.conCheck", { dc: conCheck }), kind: "save", ...edge(sheet, "save.con", "save.concentration") });
    if (!r) return;
    await afterLanding(r);
    if (r.result.total >= conCheck) {
      setConCheck(null);
      toast({ content: t("sheet.conKept"), tone: "good" });
    } else {
      lose();
      toast({ content: t("sheet.conLost"), tone: "bad" });
    }
  };
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 rounded-xl border border-magic/40 bg-magic/10 px-3 py-2">
      <Brain size={16} className="text-magic" />
      <div className="min-w-0 flex-1 text-sm text-ink">
        {t("sheet.conCheck", { dc: conCheck })}
        <span className="ml-1 text-xs text-ink-3">
          ({t("abbr.con")} {signed(sheet.abilities.con.save)})
        </span>
      </div>
      <Button size="sm" variant="primary" onClick={() => void doRoll()}>
        {t("common.roll")}
      </Button>
      <Button size="sm" onClick={() => setConCheck(null)}>
        {t("sheet.passed")}
      </Button>
      <Button size="sm" variant="danger" onClick={lose}>
        {t("sheet.failed")}
      </Button>
    </motion.div>
  );
}
