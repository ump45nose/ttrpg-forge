import { adjustDamage, hpCurrent } from "@forge/core";
import { useEffect, useState } from "react";
import { useT } from "../../app/i18n";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { Tabs } from "../../ui/Tabs";
import { useOnce } from "../../ui/hooks";
import { toast } from "../../ui/Toast";
import { useNames } from "../common/names";
import { usePlay } from "./play";

const TYPES = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "force", "psychic"];
const QUICK = [1, 5, 10];

type Mode = "damage" | "heal" | "temp";

/** Damage / heal / temp HP pad, plus death saves at 0 HP. */
export function HpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const n = useNames();
  const { sheet, state, push, damage, roll } = usePlay();
  const [mode, setMode] = useState<Mode>("damage");
  const [value, setValue] = useState("");
  const [type, setType] = useState<string | undefined>();
  useEffect(() => {
    if (open) {
      setValue("");
      setType(undefined);
    }
  }, [open]);

  const amount = Number(value) || 0;
  const hp = hpCurrent(state, sheet);
  const adj = mode === "damage" ? adjustDamage(sheet, amount, type) : { amount };
  const preview =
    mode === "damage" ? Math.max(0, hp - Math.max(0, adj.amount - state.temp))
    : mode === "heal" ? Math.min(sheet.hpMax, hp + amount)
    : hp;

  // re-armed each time the sheet opens
  const applyOnce = useOnce(open, () => {
    if (mode === "damage") {
      const r = damage(amount, type);
      if (r.rule) toast({ content: t(`sheet.dmgRule.${r.rule}`, { n: r.applied }) });
    } else if (mode === "heal") push({ type: "hp.heal", amount });
    else push({ type: "hp.temp", amount });
    onOpenChange(false);
  });
  const apply = () => amount > 0 && applyOnce();

  const deathSave = async () => {
    const r = await roll({ expr: "1d20", label: t("sheet.hpDialog.deathSaves"), kind: "death" });
    if (!r) return;
    const v = r.result.total;
    if (v === 20) push({ type: "hp.heal", amount: 1 });
    else if (v >= 10) push({ type: "deathsave", result: "success" });
    else {
      push({ type: "deathsave", result: "failure" });
      if (v === 1) push({ type: "deathsave", result: "failure" });
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("sheet.hpDialog.title")}
      width="sm"
      footer={
        <Button variant={mode === "damage" ? "danger" : "primary"} size="lg" className="w-full" disabled={!amount} onClick={apply}>
          {t(`sheet.hpDialog.${mode}`)} {amount ? (mode === "damage" && adj.amount !== amount ? `${adj.amount} (${amount})` : amount) : ""}
        </Button>
      }
    >
      <div className="space-y-4">
        <Tabs
          items={[
            { id: "damage", label: t("sheet.hpDialog.damage") },
            { id: "heal", label: t("sheet.hpDialog.heal") },
            { id: "temp", label: t("sheet.hpDialog.temp") },
          ]}
          value={mode}
          onChange={setMode}
        />
        <div className="flex items-center gap-3">
          <Input
            autoFocus
            inputMode="numeric"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="tnum h-14 flex-1 text-center font-display text-3xl"
            aria-label={t("sheet.hpDialog.amount")}
          />
          <div className="w-28 text-center">
            <div className="text-[10px] tracking-wider text-ink-3 uppercase">{t("sheet.hp")}</div>
            <div className="tnum font-display text-lg">
              <span className="text-ink-3">{hp}</span> → <span className={cn(mode === "damage" ? "text-bad" : "text-good")}>{mode === "temp" ? `${hp}+${Math.max(state.temp, amount)}` : preview}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {QUICK.map((q) => (
            <Button key={q} size="sm" className="flex-1" onClick={() => setValue(String(amount + q))}>
              +{q}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setValue("")}>
            {t("common.reset")}
          </Button>
        </div>
        {mode === "damage" && (
          <div>
            <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">{t("sheet.damageType")}</div>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((d) => {
                const rule = adjustDamage(sheet, 2, d).rule;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setType(type === d ? undefined : d)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      type === d ? "border-accent/60 bg-accent/15 text-accent" : "border-line text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {n.damage(d)}
                    {rule && <span className={cn("ml-1", rule === "vulnerable" ? "text-bad" : "text-good")}>{rule === "immune" ? "∅" : rule === "resist" ? "½" : "×2"}</span>}
                  </button>
                );
              })}
            </div>
            {state.temp > 0 && <div className="mt-2 text-xs text-temp">{t("sheet.tempAbsorbs", { n: state.temp })}</div>}
          </div>
        )}
        {mode === "temp" && <div className="text-xs text-ink-3">{t("sheet.tempHint")}</div>}
        {hp === 0 && (
          <div className="rounded-xl border border-bad/40 bg-bad/8 p-3">
            <div className="mb-2 text-sm font-semibold text-ink">{t("sheet.hpDialog.deathSaves")}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => void deathSave()}>
                {t("common.roll")} d20
              </Button>
              <Button size="sm" onClick={() => push({ type: "deathsave", result: "success" })}>
                + {t("sheet.hpDialog.success")}
              </Button>
              <Button size="sm" variant="danger" onClick={() => push({ type: "deathsave", result: "failure" })}>
                + {t("sheet.hpDialog.failure")}
              </Button>
            </div>
            <div className="mt-2 text-xs text-ink-3">{t("sheet.deathHint")}</div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
