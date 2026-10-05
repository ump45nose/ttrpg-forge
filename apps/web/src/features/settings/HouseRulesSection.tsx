import { DND5E_2024 } from "@forge/core";
import { useT } from "../../app/i18n";
import { setLocalPointBuy, useEngine } from "../../app/packs";
import { Button } from "../../ui/Button";
import { Stepper } from "../../ui/Stepper";
import { Tabs } from "../../ui/Tabs";

const MAXES = [15, 16, 17, 18] as const;

/** Table house rules that are a number or two: point buy for now. Saved in the local homebrew pack. */
export function HouseRulesSection() {
  const t = useT();
  const engine = useEngine();
  const pb = engine.reg.system.pointBuy;
  const base = DND5E_2024.pointBuy;
  const changed = pb.max !== base.max || pb.budget !== base.budget;
  const set = (p: Partial<{ max: number; budget: number }>) => {
    const next = { max: pb.max, budget: pb.budget, ...p };
    void setLocalPointBuy(next.max === base.max && next.budget === base.budget ? null : next);
  };
  const above = MAXES.filter((m) => m > 15 && m <= pb.max).map((m) => `${m} = ${pb.cost[m]}`);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-sm font-medium text-ink-2">{t("houseRules.pointBuyMax")}</div>
        <Tabs items={MAXES.map((m) => ({ id: String(m), label: String(m) }))} value={String(MAXES.includes(pb.max as never) ? pb.max : 15)} onChange={(v) => set({ max: Number(v) })} />
        <p className="mt-1.5 text-xs text-ink-3">{above.length ? t("houseRules.costAbove", { list: above.join(" · ") }) : t("houseRules.pointBuyMaxHint")}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink-2">{t("houseRules.pointBuyBudget")}</div>
          <div className="text-xs text-ink-3">{t("houseRules.pointBuyBudgetHint", { n: base.budget })}</div>
        </div>
        <Stepper value={pb.budget} min={1} onChange={(v) => set({ budget: v })} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-xs text-ink-3">{changed ? t("houseRules.active") : t("houseRules.default")}</span>
        <Button variant="secondary" size="sm" disabled={!changed} onClick={() => void setLocalPointBuy(null)}>
          {t("houseRules.reset")}
        </Button>
      </div>
    </div>
  );
}
