import { parseDice } from "@forge/core";
import { useRouterState } from "@tanstack/react-router";
import { Dices, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useT } from "../../app/i18n";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { landNow, rollDetail, rollDice, submitPhysical, useDice, type RollRecord } from "./store";
import { Tumble } from "./Tumble";

const QUICK = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20", "1d100"];

/** Global dice: a floating button on play pages, the result tray, and the physical-dice prompt. */
export function DiceDock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const showButton = /^\/c\/[^/]+\/?$/.test(path);
  const open = useDice((s) => s.dockOpen);
  const setDock = useDice((s) => s.setDock);
  return (
    <>
      <AnimatePresence>
        {showButton && (
          <motion.button
            key="dice-fab"
            type="button"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setDock(true)}
            aria-label="dice"
            className="safe-b fixed right-4 bottom-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/40 bg-[linear-gradient(160deg,var(--surface-3),var(--surface-2))] text-accent shadow-float lg:right-6 lg:bottom-6"
          >
            <Dices size={26} />
          </motion.button>
        )}
      </AnimatePresence>
      <ResultTray />
      <DockSheet open={open} onOpenChange={setDock} />
      <PhysicalPrompt />
    </>
  );
}

export function RollFace({ rec, size = "lg", pop }: { rec: RollRecord; size?: "sm" | "lg"; pop?: boolean }) {
  const t = useT();
  const r = rec.result;
  return (
    <div className="flex items-center gap-3">
      <motion.div
        initial={pop ? { scale: 1.45, rotate: -6 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 17 }}
        className={cn(
          "tnum flex shrink-0 items-center justify-center rounded-xl border font-display",
          size === "lg" ? "h-14 min-w-14 px-2 text-3xl" : "h-10 min-w-10 px-1.5 text-xl",
          r.crit ? "border-good/60 bg-good/15 text-good shadow-[0_0_24px_-6px_var(--good)]" : r.fumble ? "border-bad/60 bg-bad/15 text-bad" : "border-line-strong bg-surface-3 text-ink",
        )}
      >
        {r.total}
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{rec.label ?? r.expr}</div>
        <div className="truncate text-xs text-ink-3">
          <span className="tnum">{r.expr}</span> · <span className="tnum">{rollDetail(r)}</span>
          {rec.physical && " · 🎲"}
        </div>
        {(r.crit || r.fumble) && <div className={cn("text-xs font-semibold", r.crit ? "text-good" : "text-bad")}>{r.crit ? t("sheet.crit") : t("sheet.fumble")}</div>}
      </div>
    </div>
  );
}

/** True while a roll's dice are still tumbling; re-renders when they settle. */
function useRolling(rec: RollRecord | null | undefined): boolean {
  const [, tick] = useState(0);
  const rolling = !!rec && rec.landsAt > Date.now();
  useEffect(() => {
    if (!rec || !rolling) return;
    const id = setTimeout(() => tick((x) => x + 1), rec.landsAt - Date.now());
    return () => clearTimeout(id);
  }, [rec, rolling]);
  return rolling;
}

function ResultTray() {
  const t = useT();
  const last = useDice((s) => s.last);
  const dismiss = useDice((s) => s.dismiss);
  const [hold, setHold] = useState(false);
  const rolling = useRolling(last);
  useEffect(() => {
    setHold(false);
  }, [last?.id]);
  useEffect(() => {
    if (!last || hold || rolling) return;
    const id = setTimeout(dismiss, last.result.crit || last.result.fumble ? 6000 : 4200);
    return () => clearTimeout(id);
  }, [last, hold, rolling, dismiss]);
  const r = last?.result;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[55] flex justify-center px-4">
      <AnimatePresence>
        {last && (
          <motion.div
            key={last.id}
            initial={{ opacity: 0, y: -24, scale: 0.9, rotate: -2 }}
            animate={!rolling && r?.fumble ? { opacity: 1, y: 0, scale: 1, rotate: 0, x: [0, -8, 7, -5, 3, 0] } : { opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28, x: { duration: 0.4 } }}
            onClick={() => (rolling ? landNow() : hold ? dismiss() : setHold(true))}
            className={cn(
              "glass pointer-events-auto relative w-full max-w-sm cursor-pointer overflow-hidden rounded-2xl border p-3 shadow-float transition-colors duration-300",
              rolling ? "border-line-strong" : r?.crit ? "border-good/70 shadow-[0_0_40px_-8px_var(--good)]" : r?.fumble ? "border-bad/70" : "border-line-strong",
            )}
          >
            {!rolling && r?.crit && (
              <motion.span
                aria-hidden
                initial={{ opacity: 0.9, scale: 0.4, rotate: 0 }}
                animate={{ opacity: 0, scale: 2.4, rotate: 40 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="pointer-events-none absolute top-1/2 left-10 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[repeating-conic-gradient(from_0deg,color-mix(in_oklab,var(--good)_55%,transparent)_0deg_8deg,transparent_8deg_30deg)]"
              />
            )}
            {rolling ? (
              <div className="flex items-center gap-3">
                <Tumble result={last.result} landsAt={last.landsAt} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{last.label ?? last.result.expr}</div>
                  <div className="text-xs text-ink-3">{t("dice.tapToSkip")}</div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <RollFace rec={last} pop={last.landsAt > last.at} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DockSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const history = useDice((s) => s.history);
  const clear = useDice((s) => s.clear);
  // don't spoil the roll that is still tumbling in the tray
  const rolling = useRolling(history[0]);
  const shown = rolling ? history.slice(1) : history;
  const [expr, setExpr] = useState("1d20");
  const [mode, setMode] = useState<"normal" | "adv" | "dis">("normal");
  let valid = true;
  try {
    parseDice(expr);
  } catch {
    valid = false;
  }
  const go = (x = expr) => {
    void rollDice({ expr: x, advantage: mode === "adv", disadvantage: mode === "dis" });
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("dice.title")}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && valid && go()} aria-label={t("dice.expression")} className={cn("tnum", !valid && "border-bad/60")} />
          <Button variant="primary" size="lg" disabled={!valid} onClick={() => go()}>
            {t("dice.roll")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <Button key={q} size="sm" onClick={() => (setExpr(q), go(q))}>
              {q.replace(/^1/, "")}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["normal", "adv", "dis"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("h-8 flex-1 rounded-lg border text-xs font-medium transition-colors", mode === m ? (m === "adv" ? "border-good/50 bg-good/12 text-good" : m === "dis" ? "border-bad/50 bg-bad/12 text-bad" : "border-line-strong bg-surface-3 text-ink") : "border-line text-ink-3")}
            >
              {m === "normal" ? t("dice.normal") : m === "adv" ? t("dice.advantage") : t("dice.disadvantage")}
            </button>
          ))}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{t("dice.history")}</div>
            {!!history.length && (
              <button type="button" className="text-xs text-ink-3 hover:text-ink" onClick={clear}>
                {t("dice.clear")}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {shown.slice(0, 30).map((h) => (
              <div key={h.id} className="rounded-xl border border-line bg-surface/60 p-2">
                <RollFace rec={h} size="sm" />
              </div>
            ))}
            {!shown.length && <div className="text-sm text-ink-3">—</div>}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** "Roll 2d6 and enter the total" when physical dice are on. */
function PhysicalPrompt() {
  const t = useT();
  const ask = useDice((s) => s.ask);
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [ask]);
  if (!ask) return <Sheet open={false} onOpenChange={() => {}}>{null}</Sheet>;
  const n = Number(value);
  const ok = value !== "" && Number.isInteger(n) && n >= 0;
  const adv = ask.req.advantage && !ask.req.disadvantage ? t("dice.advantage") : ask.req.disadvantage && !ask.req.advantage ? t("dice.disadvantage") : "";
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && submitPhysical(ask, null)}
      title={ask.req.label ?? t("dice.physical")}
      description={t(ask.d20 ? "dice.enterD20" : "dice.enterTotal", { dice: ask.dice }) + (adv ? ` · ${adv}` : "")}
      width="sm"
    >
      {ask.d20 ? (
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((v) => (
            <Button key={v} size="md" variant={v === 20 ? "primary" : v === 1 ? "danger" : "secondary"} className="tnum" onClick={() => submitPhysical(ask, v)}>
              {v}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <Input autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && ok && submitPhysical(ask, n)} className="tnum text-center text-2xl" />
          <Button variant="primary" size="lg" disabled={!ok} onClick={() => submitPhysical(ask, n)}>
            {t("common.confirm")}
          </Button>
        </div>
      )}
      <button type="button" onClick={() => submitPhysical(ask, null)} className="mt-3 flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
        <X size={12} /> {t("common.cancel")}
      </button>
    </Sheet>
  );
}
