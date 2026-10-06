import { partsExpr, testParts, type Ability, type ResolvedAction, type RollPart } from "@forge/core";
import { Dices } from "lucide-react";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { useT } from "../../app/i18n";
import { useSettings } from "../../app/settings";
import { AdvToggle, type AdvMode } from "../../ui/AdvToggle";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Sheet } from "../../ui/Sheet";
import { useNames } from "../common/names";
import type { RollKind } from "../dice/store";
import { usePlay } from "./play";
import { edge } from "./util";

/** Identifies an extra die across re-renders (upcasting adds parts before it). */
const key = (p: RollPart, _i?: number) => `${typeof p.label === "string" ? p.label : p.label.en}|${p.damageType ?? ""}`;

/** The parts that count, given the switched-off extra dice. */
export const usedParts = (parts: RollPart[], off: Set<string>) => parts.filter((p) => !p.bonus || !off.has(key(p)));

/**
 * Which extra dice (Bless, Hunter's Mark...) count for this roll. All on, except one-shot
 * dice like Bardic Inspiration that the player spends on purpose.
 */
export function useBonusParts(parts: RollPart[], reset: unknown) {
  const [off, setOff] = useState<Set<string>>(() => new Set(parts.flatMap((p, i) => (p.once ? [key(p, i)] : []))));
  useEffect(() => {
    setOff(new Set(parts.flatMap((p, i) => (p.once ? [key(p, i)] : []))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);
  const toggle = (k: string) => setOff((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])));
  const used = usedParts(parts, off);
  return { parts, off, toggle, used, expr: partsExpr(used) };
}

/** After an in-app roll: one-shot dice that were added are spent (their effect ends). */
export function useSpend() {
  const { push } = usePlay();
  return (used: RollPart[]) => {
    for (const p of used) if (p.once && p.source?.entityId) push({ type: "effect.remove", effect: p.source.entityId });
  };
}

/**
 * A roll spelled out for real dice: "1d20 + 3 Strength modifier + 2 Proficiency + 1d4 Bless".
 * Extra dice from effects are switches: tap one off when it doesn't apply to this target.
 */
export function PartsLine({ parts, off, onToggle, crit, className }: { parts: RollPart[]; off: Set<string>; onToggle: (k: string) => void; crit?: boolean; className?: string }) {
  const t = useT();
  const n = useNames();
  const used = usedParts(parts, off);
  const flat = used.reduce((s, p) => s + (p.dice ? 0 : (p.value ?? 0)), 0);
  const dice = used.filter((p) => p.dice).map((p) => (crit ? doubled(p.dice!) : p.dice!));
  return (
    <div className={className}>
      <div className="flex flex-wrap items-stretch gap-1" aria-label={t("roll.formula")}>
        {parts.map((p, i) => {
          const k = key(p);
          const on = !p.bonus || !off.has(k);
          const value = p.dice ? (crit ? doubled(p.dice) : p.dice) : p.value! >= 0 ? `+${p.value}` : `${p.value}`;
          const sign = p.dice && i > 0 && !p.dice.startsWith("-") ? "+" : "";
          const type = p.damageType && p.damageType !== "weapon" ? n.damage(p.damageType) : undefined;
          const body = (
            <>
              <span className={cn("tnum text-sm leading-5 font-semibold", p.dice ? "text-accent" : "text-ink")}>
                {sign}
                {value}
              </span>
              <span className="block max-w-[9rem] truncate text-[10px] leading-3.5 text-ink-3">
                {n.l(p.label, { mono: true })}
                {type && ` · ${type}`}
                {p.once && ` · ${t("roll.once")}`}
              </span>
            </>
          );
          return p.bonus ? (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(k)}
              className={cn("rounded-lg border px-1.5 py-0.5 text-left transition-colors", on ? "border-good/40 bg-good/10" : "border-dashed border-line-strong opacity-55 [&_span]:line-through")}
            >
              {body}
            </button>
          ) : (
            <span key={i} className="rounded-lg border border-transparent px-1.5 py-0.5">
              {body}
            </span>
          );
        })}
      </div>
      <div className="mt-1 px-1.5 text-[11px] text-ink-3">
        = <span className="tnum font-medium text-ink-2">{[...dice, ...(flat || !dice.length ? [String(flat)] : [])].join(" + ").replace(/\+ -/g, "− ")}</span>
        {crit && <span className="ml-1.5 text-bad">{t("roll.critDoubles")}</span>}
      </div>
    </div>
  );
}

/** "2d6" → "4d6" (a critical hit doubles the dice). */
const doubled = (d: string) => d.replace(/(\d+)d/, (_, c: string) => `${Number(c) * 2}d`);

/** What can still be added after a hit (Sneak Attack, smites...), with their dice. */
export function Riders({ riders }: { riders: ResolvedAction[] }) {
  const t = useT();
  const n = useNames();
  if (!riders.length) return null;
  return (
    <div className="rounded-xl border border-class/30 bg-class/8 px-3 py-2">
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-class">{t("roll.riders")}</div>
      <ul className="space-y-1">
        {riders.map((r) => (
          <li key={r.id} className="text-sm leading-snug">
            <span className="font-medium text-ink">{n.l(r.name, { mono: true })}</span>
            {r.damage?.map((d, i) => (
              <span key={i} className="tnum ml-1.5 text-accent">
                +{d.dice}
                {d.type !== "weapon" && <span className="ml-0.5 text-xs text-ink-3">{n.damage(d.type)}</span>}
              </span>
            ))}
            {r.save && <span className="ml-1.5 text-xs text-warn">{t("sheet.save", { ability: n.ability(r.save.ability), dc: r.save.dc })}</span>}
            {r.tags.includes("once-per-turn") && <span className="ml-1.5 text-[11px] text-ink-3">· {t("roll.oncePerTurn")}</span>}
            {r.category === "spell" && <span className="ml-1.5 text-[11px] text-ink-3">· {t("roll.castIt")}</span>}
            {r.trigger && <span className="block text-xs text-ink-3">{n.l(r.trigger, { mono: true })}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* A d20 test (check, save, skill, initiative) opened from anywhere on the sheet. */
interface TestRequest {
  title: string;
  parts: RollPart[];
  kind: RollKind;
  edge: { advantage: boolean; disadvantage: boolean };
}
export const useTest = create<{ req: TestRequest | null; open(r: TestRequest): void; close(): void }>()((set) => ({
  req: null,
  open: (req) => set({ req }),
  close: () => set({ req: null }),
}));

/** The breakdown of a d20 test, with advantage and an in-app roll for those without dice. */
export function TestSheet() {
  const t = useT();
  const { req, close } = useTest();
  const [last, setLast] = useState(req);
  if (req && req !== last) setLast(req);
  const r = req ?? last;
  return (
    <Sheet open={!!req} onOpenChange={(o) => !o && close()} title={r?.title} width="sm">
      {r && <TestBody req={r} onDone={close} />}
    </Sheet>
  );
}

function TestBody({ req, onDone }: { req: TestRequest; onDone: () => void }) {
  const t = useT();
  const { roll } = usePlay();
  const spend = useSpend();
  const physical = useSettings((s) => s.physicalDice);
  const { off, toggle, used, expr } = useBonusParts(req.parts, req);
  const initial: AdvMode = req.edge.advantage && !req.edge.disadvantage ? "adv" : req.edge.disadvantage && !req.edge.advantage ? "dis" : "normal";
  const [mode, setMode] = useState<AdvMode>(initial);
  useEffect(() => setMode(initial), [req, initial]);
  return (
    <div className="space-y-4 pb-2">
      <p className="text-xs text-ink-3">{t("roll.hint")}</p>
      <PartsLine parts={req.parts} off={off} onToggle={toggle} />
      <AdvToggle mode={mode} onChange={setMode} />
      <Button
        variant="primary"
        className="w-full"
        onClick={() => {
          onDone();
          void roll({ expr, label: req.title, kind: req.kind, advantage: mode === "adv", disadvantage: mode === "dis" }).then((rec) => rec && spend(used));
        }}
      >
        <Dices size={15} /> {physical ? t("roll.record") : t("roll.inApp")}
      </Button>
    </div>
  );
}

/** Openers for the sheet's d20 tests: each shows its breakdown before anything is rolled. */
export function useTests() {
  const t = useT();
  const n = useNames();
  const { sheet } = usePlay();
  const open = useTest((s) => s.open);
  return {
    check: (a: Ability) => open({ title: t("sheet.checkOf", { name: n.ability(a) }), parts: testParts(sheet, `ability.${a}.mod`, "check"), kind: "check", edge: edge(sheet, `check.${a}`) }),
    save: (a: Ability) => open({ title: t("sheet.saveOf", { name: n.ability(a) }), parts: testParts(sheet, `save.${a}`, "save"), kind: "save", edge: edge(sheet, `save.${a}`) }),
    skill: (k: string) => {
      const ability = sheet.skills[k]!.ability;
      open({ title: t("sheet.checkOf", { name: n.prof("skill", k) }), parts: testParts(sheet, `skill.${k}`, "check"), kind: "check", edge: edge(sheet, `skill.${k}`, `check.${ability}`) });
    },
    initiative: () => open({ title: t("sheet.initiative"), parts: testParts(sheet, "initiative", "check"), kind: "initiative", edge: edge(sheet, "initiative") }),
  };
}
