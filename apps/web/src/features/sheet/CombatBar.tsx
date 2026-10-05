import { effectiveEvents, movementLeft, type PlayEvent } from "@forge/core";
import { ChevronDown, Footprints, Swords, TimerReset } from "lucide-react";
import { motion } from "motion/react";
import { Popover } from "radix-ui";
import { useT } from "../../app/i18n";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Term } from "../terms/Term";
import { usePlay } from "./play";
import { SLOT_RULE } from "./TurnGuide";

type Slot = "action" | "bonus" | "reaction";
const SLOTS: Slot[] = ["action", "bonus", "reaction"];

/** Encounter controls and the turn economy chips. */
export function CombatBar() {
  const t = useT();
  const { state, push, character } = usePlay();

  if (!state.inCombat) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => push({ type: "combat.start" })}>
        <Swords size={15} /> {t("sheet.combat.start")}
      </Button>
    );
  }

  /** Tapping a spent chip gives it back only when it was spent by tapping (not by an action with costs). */
  const toggle = (slot: Slot) => {
    if (!state.economy[slot]) return void push({ type: "economy.use", slot });
    const last = [...effectiveEvents(character.play)].reverse().find((e) => spends(e, slot));
    if (last?.type === "economy.use") push({ type: "revert", target: last.id });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Popover.Root>
        <Popover.Trigger asChild>
          <button type="button" aria-label={t("sheet.combat.round", { n: state.round })} className="flex h-10 shrink-0 items-center gap-0.5 rounded-xl border border-class/40 bg-class/10 pr-1 pl-2 leading-none transition-colors hover:border-class/70">
            <span className="flex flex-col items-center">
              <span className="text-[10px] tracking-wider text-class uppercase">{t("sheet.combat.roundShort")}</span>
              <span className="tnum font-display text-lg text-class">{state.round}</span>
            </span>
            {/* says "there's more here": ending combat lives in this menu */}
            <ChevronDown size={13} className="text-class/70" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={6} align="start" collisionPadding={12} className="z-50 w-60 rounded-2xl border border-line-strong bg-surface-2 p-3 shadow-float outline-none">
            <div className="mb-2 text-sm text-ink">{t("sheet.combat.round", { n: state.round })}</div>
            <div className="mb-3 text-xs leading-relaxed text-ink-3">
              {t("sheet.turn.rules")}{" "}
              {(["action", "bonus", "reaction", "movement"] as const).map((s, i) => (
                <span key={s}>
                  {i > 0 && " · "}
                  <Term id={SLOT_RULE[s]}>{t(`sheet.economy.${s}`)}</Term>
                </span>
              ))}
            </div>
            <div className="mb-3 text-xs text-ink-3">{t("sheet.combat.endHint")}</div>
            <Popover.Close asChild>
              <Button size="sm" variant="danger" className="w-full" onClick={() => push({ type: "combat.end" })}>
                {t("sheet.combat.end")}
              </Button>
            </Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {SLOTS.map((s) => (
        <motion.button
          key={s}
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => toggle(s)}
          className={cn(
            "flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border px-1 text-xs font-medium transition-all duration-200",
            state.economy[s] ? "border-line bg-surface/40 text-ink-3 line-through opacity-60" : s === "action" ? "border-accent/50 bg-accent/12 text-accent" : s === "bonus" ? "border-good/50 bg-good/12 text-good" : "border-info/50 bg-info/12 text-info",
          )}
        >
          {/* the dot gives way on narrow phones so the label itself fits */}
          <span className={cn("hidden h-2 w-2 shrink-0 rounded-full min-[400px]:block", state.economy[s] ? "bg-ink-3" : "bg-current")} />
          <span className="truncate">{t(`sheet.economy.${s}`)}</span>
        </motion.button>
      ))}
      <Movement />
      <Button variant="class" size="sm" className="h-10 shrink-0 px-3" onClick={() => push({ type: "turn.start" })} title={t("sheet.combat.newTurn")} aria-label={t("sheet.combat.newTurn")}>
        <TimerReset size={16} />
        <span className="hidden sm:inline">{t("sheet.combat.newTurn")}</span>
      </Button>
    </div>
  );
}

function spends(e: PlayEvent, slot: Slot): boolean {
  if (e.type === "economy.use") return e.slot === slot;
  if (e.type === "action.use") return e.costs.some((c) => "economy" in c && c.economy === slot);
  return false;
}

function Movement() {
  const t = useT();
  const { state, sheet, push } = usePlay();
  const { left, budget } = movementLeft(state, sheet);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border px-1 text-xs font-medium transition-colors",
            left === 0 ? "border-line bg-surface/40 text-ink-3 opacity-60" : "border-warn/50 bg-warn/12 text-warn",
          )}
        >
          <Footprints size={13} className="shrink-0" />
          <span className="tnum truncate">{left}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={12} className="z-50 w-64 rounded-2xl border border-line-strong bg-surface-2 p-3 shadow-float outline-none">
          <div className="mb-2 flex items-baseline justify-between">
            <Term id={SLOT_RULE.movement} className="text-xs font-semibold tracking-wide uppercase">
              {t("sheet.economy.movement")}
            </Term>
            <span className="tnum text-sm text-ink">
              {left} / {budget} {t("sheet.ft")}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[5, 10, 15, 30].map((f) => (
              <Button key={f} size="sm" disabled={left <= 0} onClick={() => push({ type: "move", feet: Math.min(f, left) })}>
                −{f}
              </Button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" className="flex-1" disabled={state.economy.moved === 0} onClick={() => push({ type: "move", feet: -Math.min(5, state.economy.moved) })}>
              +5
            </Button>
            <Button size="sm" className="flex-1" disabled={left <= 0} onClick={() => push({ type: "move", feet: left })}>
              {t("sheet.moveAll")}
            </Button>
          </div>
          <div className="mt-2 text-[11px] text-ink-3">{t("sheet.dashHint")}</div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
