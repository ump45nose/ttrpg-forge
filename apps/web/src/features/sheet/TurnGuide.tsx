import { movementLeft, type ResolvedAction } from "@forge/core";
import { Footprints, Route, TimerReset } from "lucide-react";
import { useT } from "../../app/i18n";
import { haptic } from "../../app/settings";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Hint } from "../../ui/Hint";
import { RichText } from "../terms/RichText";
import { Term } from "../terms/Term";
import { usePlay } from "./play";

export type Slot = "action" | "bonus" | "reaction";
const SLOTS: Slot[] = ["action", "bonus", "reaction"];

/** The glossary entry behind each part of a turn. */
export const SLOT_RULE: Record<Slot | "movement", string> = { action: "rule:action", bonus: "rule:bonus-action", reaction: "rule:reaction", movement: "rule:speed" };

/** "Dash" → rule:dash: the basic actions every character has share their ids with the rules glossary. */
export function basicRule(a: ResolvedAction): string | undefined {
  if (a.category !== "basic") return undefined;
  const id = a.id.split("#").pop()!;
  return `rule:${id === "opportunity-attack" ? "opportunity-attacks" : id}`;
}

const TONE: Record<Slot, string> = { action: "border-accent/50 bg-accent/10 text-accent", bonus: "border-good/50 bg-good/10 text-good", reaction: "border-info/50 bg-info/10 text-info" };

/**
 * What is left this turn, in order of play: tap a part to see what it can buy, end the
 * turn when done. Shown only in combat, above the action list.
 */
export function TurnGuide({ options, group, onPick }: { options: Record<Slot, number>; group: string; onPick: (g: Slot) => void }) {
  const t = useT();
  const { state, sheet, push } = usePlay();
  if (!state.inCombat) return null;
  const { left, budget } = movementLeft(state, sheet);

  return (
    <section aria-label={t("sheet.turn.title", { n: state.round })} className="space-y-2 rounded-2xl border border-class/30 bg-class/[0.05] p-3">
      <Hint id="turn-flow" icon={<Route size={16} />}>
        <div className="font-medium text-ink">{t("sheet.turn.hintTitle")}</div>
        <RichText text={t("sheet.turn.hint")} className="block text-xs leading-relaxed" />
      </Hint>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold tracking-wider text-class uppercase">{t("sheet.turn.title", { n: state.round })}</h2>
        <span className="text-[11px] text-ink-3">{t("sheet.turn.tapToSee")}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {SLOTS.map((s) => {
          const used = state.economy[s];
          const count = options[s];
          const open = !used && count > 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              aria-pressed={group === s}
              className={cn(
                "relative flex min-h-14 min-w-0 flex-col items-start justify-center rounded-xl border px-2 py-1.5 text-left transition-colors",
                used ? "border-line bg-surface/40 opacity-60" : open ? TONE[s] : "border-line bg-surface/60 text-ink-2",
                group === s && "ring-2 ring-class/40",
              )}
            >
              {open && <span className="absolute top-1.5 right-1.5 h-2 w-2 animate-pulse rounded-full bg-current" />}
              <span className={cn("truncate text-xs font-medium", used && "line-through")}>{t(`sheet.economy.${s}`)}</span>
              <span className="truncate text-[11px] text-ink-3">{used ? t("sheet.turn.used") : count ? t("sheet.turn.options", { n: count }) : t("sheet.turn.none")}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("flex min-w-0 flex-1 items-center gap-1.5 text-xs", left ? "text-warn" : "text-ink-3")}>
          <Footprints size={13} className="shrink-0" />
          <span className="tnum truncate">{t("sheet.turn.movement", { left, budget })}</span>
        </span>
        <Button
          size="sm"
          variant="class"
          className="shrink-0"
          onClick={() => {
            haptic(10);
            push({ type: "turn.start" });
          }}
        >
          <TimerReset size={15} /> {t("sheet.turn.end")}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-3">
        {t("sheet.turn.rules")}{" "}
        {(["action", "bonus", "reaction", "movement"] as const).map((s, i) => (
          <span key={s}>
            {i > 0 && " · "}
            <Term id={SLOT_RULE[s]}>{t(`sheet.economy.${s}`)}</Term>
          </span>
        ))}
      </p>
    </section>
  );
}
