import { type Build, type ChoiceView, type SheetDiff } from "@forge/core";
import { Dices, HeartPulse, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useCharacters } from "../../app/characters";
import { useT } from "../../app/i18n";
import { ArtImg } from "../../ui/Art";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { cn } from "../../ui/cn";
import { useOnce } from "../../ui/hooks";
import { Sheet } from "../../ui/Sheet";
import { toast } from "../../ui/Toast";
import { ChoiceBlock } from "../builder/ChoiceBlock";
import { PreparedPanel } from "../builder/steps/ChoicesStep";
import { BuilderProvider, useBuilder } from "../builder/state";
import { DiffView } from "../common/DiffView";
import { useNames } from "../common/names";
import { afterLanding, rollDice } from "../dice/store";
import { usePlay } from "./play";

type Phase = { step: "hp" } | { step: "gains"; before: Build; diff: SheetDiff };

/**
 * Level up from the sheet: Hit Points, then what the new level brings and the
 * choices it opens. The level is added as soon as HP is settled so the builder's
 * choice blocks work on it; cancelling puts the old build back.
 */
export function LevelUpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { character, engine, sheet, push } = usePlay();
  const update = useCharacters((s) => s.update);
  const [phase, setPhase] = useState<Phase>({ step: "hp" });
  const level = phase.step === "gains" ? sheet.level : sheet.level + 1;

  const close = () => {
    setPhase({ step: "hp" });
    onClose();
  };
  const finish = () => {
    push({ type: "note", text: t("levelUp.logged", { n: level }) });
    toast({ content: t("levelUp.done", { n: level }), tone: "accent" }, 4000);
    close();
  };
  const cancel = () => {
    if (phase.step === "gains") update(character.id, (c) => ({ ...c, build: phase.before }));
    close();
  };
  const settleHp = (roll?: number) => {
    const before = character.build;
    const ops = engine.levelUpOps(before, roll);
    if (!ops.length) return;
    const { diff } = engine.preview(before, engine.evaluate(before).sheet, ops);
    update(character.id, (c) => ({ ...c, build: engine.apply(c.build, ops) }));
    setPhase({ step: "gains", before, diff });
  };

  return (
    <Sheet
      open={open}
      // once the level is in, swiping the sheet away keeps it: only the explicit button takes it back
      onOpenChange={(o) => !o && (phase.step === "gains" ? finish() : cancel())}
      title={t("levelUp.title", { n: level })}
      width="lg"
      footer={phase.step === "gains" ? <GainsFooter onDone={finish} onCancel={cancel} level={level} /> : undefined}
    >
      {phase.step === "hp" ? <HpStep onSettle={settleHp} /> : <Gains diff={phase.diff} level={level} />}
    </Sheet>
  );
}

function HpStep({ onSettle }: { onSettle: (roll?: number) => void }) {
  const t = useT();
  const n = useNames();
  const { character, engine, sheet } = usePlay();
  const classId = character.build.levels.at(-1)?.classId;
  const die = sheet.classes.find((c) => c.id === classId)?.hitDie ?? 8;
  const con = sheet.abilities.con.mod;
  const rule = engine.reg.system.hp.levelUp;
  const avg = rule === "max" ? die : Math.floor(die / 2) + 1;
  const [roll, setRoll] = useState<number | null>(null);
  const settle = useOnce(roll, onSettle);
  const plus = (x: number) => `${Math.max(1, x + con)}`;

  const doRoll = async () => {
    const r = await rollDice({ expr: `1d${die}`, label: `${t("levelUp.title", { n: sheet.level + 1 })} · ${t("builder.hitDie")}`, kind: "hitdie", characterId: character.id });
    if (r) await afterLanding(r);
    if (r) setRoll(r.result.total);
  };

  return (
    <div className="space-y-4">
      <ArtImg id="scene:levelup" focus={[0.5, 0.45]} className="h-32 rounded-2xl sm:h-44" />
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="class">{classId ? n.entity(classId, true) : "—"}</Chip>
        <Chip>
          {t("builder.hitDie")} d{die}
        </Chip>
        <Chip>
          {n.ability("con")} {con >= 0 ? `+${con}` : con}
        </Chip>
      </div>
      <p className="text-sm text-ink-2">{t("levelUp.hpHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HpCard icon={<HeartPulse size={18} />} title={rule === "max" ? t("levelUp.max") : t("levelUp.average")} value={plus(avg)} note={`${avg} ${con >= 0 ? "+" : "−"} ${Math.abs(con)}`} onPick={() => settle()} />
        {rule !== "max" && (
          <HpCard
            icon={<Dices size={18} />}
            title={t("levelUp.roll")}
            value={roll === null ? "?" : plus(roll)}
            note={roll === null ? `1d${die} ${con >= 0 ? "+" : "−"} ${Math.abs(con)}` : `${roll} ${con >= 0 ? "+" : "−"} ${Math.abs(con)}`}
            onPick={roll === null ? () => void doRoll() : () => settle(roll)}
            action={roll === null ? t("common.roll") : t("levelUp.keep")}
          />
        )}
      </div>
      <p className="text-xs text-ink-3">{t("levelUp.multiclassLater")}</p>
    </div>
  );
}

function HpCard({ icon, title, value, note, onPick, action }: { icon: React.ReactNode; title: string; value: string; note: string; onPick: () => void; action?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-class/50 hover:bg-class/5"
    >
      <div className="flex w-full items-center gap-2 text-sm font-medium text-ink">
        <span className="text-class">{icon}</span>
        {title}
        <span className="ml-auto rounded-full bg-class/15 px-2.5 py-0.5 text-xs text-class">{action ?? t("levelUp.choose")}</span>
      </div>
      <div className="tnum font-display text-4xl text-ink">+{value}</div>
      <div className="tnum text-xs text-ink-3">{note}</div>
    </button>
  );
}

/** Choices that belong to the new level, or that are still open from earlier ones. */
function useLevelChoices(level: number): { now: ChoiceView[]; earlier: ChoiceView[] } {
  const { sheet } = useBuilder();
  return useMemo(() => {
    const at = (c: ChoiceView) => Number(/@(\d+)/.exec(c.path)?.[1] ?? 0);
    const now = sheet.choices.filter((c) => at(c) === level);
    const earlier = sheet.choices.filter((c) => at(c) !== level && c.remaining > 0);
    return { now, earlier };
  }, [sheet.choices, level]);
}

function Gains({ diff, level }: { diff: SheetDiff; level: number }) {
  const { character } = usePlay();
  return (
    <BuilderProvider character={character}>
      <GainsBody diff={diff} level={level} />
    </BuilderProvider>
  );
}

function GainsBody({ diff, level }: { diff: SheetDiff; level: number }) {
  const t = useT();
  const { sheet } = useBuilder();
  const { now, earlier } = useLevelChoices(level);
  const preparers = sheet.spellcasting.filter((sc) => sc.mode !== "known" && sc.preparedMax > 0);
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
          <Sparkles size={13} className="text-class" /> {t("levelUp.gains")}
        </h3>
        <DiffView diff={diff} />
      </section>
      {now.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">{t("levelUp.choices")}</h3>
          {now.map((c) => (
            <ChoiceBlock key={c.path} ch={c} />
          ))}
        </section>
      )}
      {earlier.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-[0.14em] text-warn uppercase">{t("levelUp.earlier")}</h3>
          {earlier.map((c) => (
            <ChoiceBlock key={c.path} ch={c} />
          ))}
        </section>
      )}
      {preparers.map((sc) => (
        <PreparedPanel key={sc.classId} sc={sc} />
      ))}
    </div>
  );
}

function GainsFooter({ onDone, onCancel, level }: { onDone: () => void; onCancel: () => void; level: number }) {
  const t = useT();
  const { engine, character } = usePlay();
  const open = engine.evaluate(character.build).sheet.choices.filter((c) => c.remaining > 0).length;
  const done = useOnce(level, onDone);
  return (
    <div className="space-y-2">
      {open > 0 && <div className="text-xs text-warn">{t("levelUp.pending", { n: open })}</div>}
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={onCancel}>
          {t("levelUp.undo")}
        </Button>
        <Button variant="class" size="lg" className={cn("flex-1")} onClick={done}>
          {t("levelUp.finish", { n: level })}
        </Button>
      </div>
    </div>
  );
}
