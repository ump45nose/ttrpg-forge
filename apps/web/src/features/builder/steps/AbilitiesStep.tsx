import { ABILITIES, abilityMod, pointBuyCost, roll, type Ability, type AbilityScores, type Build } from "@forge/core";
import { Dices, Minus, Plus, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useT } from "../../../app/i18n";
import { haptic } from "../../../app/settings";
import { AnimatedNumber, signed } from "../../../ui/AnimatedNumber";
import { Button } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { Tabs } from "../../../ui/Tabs";
import { Explain } from "../../common/Explain";
import { useNames } from "../../common/names";
import { ChoiceBlock } from "../ChoiceBlock";
import { stepOfChoice, useBuilder } from "../state";

type Method = Build["abilityMethod"];

export function AbilitiesStep() {
  const t = useT();
  const n = useNames();
  const { build, sheet, apply, engine } = useBuilder();
  const sys = engine.reg.system;
  const method = build.abilityMethod;
  const base = build.baseAbilities;
  const [picked, setPicked] = useState<Ability>();
  const cls = build.levels[0] ? engine.reg.getOf("class", build.levels[0].classId) : undefined;
  const primary = new Set<Ability>(cls?.primaryAbility ?? []);
  const cost = pointBuyCost(base, sys);
  const left = sys.pointBuy.budget - (cost ?? 0);
  const swappable = method === "standard" || method === "roll";

  const setScores = (scores: Partial<AbilityScores>, m: Method = method) => apply([{ op: "setAbilities", method: m, scores }]);

  const switchMethod = (m: Method) => {
    if (m === method) return;
    if (m === "standard") setScores(arrange(sys.standardArray, primary), m);
    else if (m === "pointbuy") setScores(Object.fromEntries(ABILITIES.map((a) => [a, 8])) as AbilityScores, m);
    else if (m === "roll") rollAll();
    else setScores({}, m);
  };

  function rollAll() {
    haptic([8, 30, 8]);
    const values = ABILITIES.map(() => roll("4d6kh3").total);
    setScores(arrange(values, primary), "roll");
  }

  const onPick = (a: Ability) => {
    if (!swappable) return;
    if (!picked) return setPicked(a);
    if (picked !== a) {
      haptic(8);
      setScores({ [picked]: base[a], [a]: base[picked] });
    }
    setPicked(undefined);
  };

  const step = (a: Ability, d: number) => {
    const v = base[a] + d;
    if (method === "pointbuy") {
      if (v < sys.pointBuy.min || v > sys.pointBuy.max) return;
      const c = pointBuyCost({ ...base, [a]: v }, sys);
      if (c === null || c > sys.pointBuy.budget) return;
    } else if (v < 3 || v > 20) return;
    setScores({ [a]: v });
  };

  const abilityChoices = sheet.choices.filter((c) => stepOfChoice(c.path, c.choice.from.kind) === "abilities");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs items={(["standard", "pointbuy", "roll", "manual"] as const).map((m) => ({ id: m, label: t(`builder.methods.${m}`) }))} value={method} onChange={switchMethod} size="sm" />
        {method === "pointbuy" && (
          <motion.span key={left} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className={cn("tnum rounded-full px-3 py-1 text-sm font-semibold", left < 0 ? "bg-bad/15 text-bad" : left === 0 ? "bg-good/15 text-good" : "bg-accent/15 text-accent")}>
            {t("builder.pointsLeft", { n: left })}
          </motion.span>
        )}
        {method === "roll" && (
          <Button variant="outline" size="sm" onClick={rollAll}>
            <Dices size={15} /> {t("builder.rollAll")}
          </Button>
        )}
        {swappable && primary.size > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setScores(arrange(ABILITIES.map((a) => base[a]), primary))}>
            <Sparkles size={15} /> {t("builder.recommended")}
          </Button>
        )}
      </div>
      {swappable && <p className="text-xs text-ink-3">{t("builder.swapHint")}</p>}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ABILITIES.map((a) => {
          const v = sheet.abilities[a];
          const bonus = v.score - base[a];
          const isPicked = picked === a;
          return (
            <motion.div
              key={a}
              layout
              onClick={() => onPick(a)}
              className={cn(
                "card relative flex items-center gap-3 p-3 transition-colors",
                swappable && "cursor-pointer",
                isPicked && "border-class ring-2 ring-class/40",
                picked && !isPicked && "hover:border-class/60",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{n.ability(a)}</span>
                  {primary.has(a) && <span className="rounded bg-class/20 px-1.5 text-[10px] font-semibold text-class">{t("builder.primary")}</span>}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
                  <span>
                    {t("builder.base")} <b className="tnum text-ink-2">{base[a]}</b>
                  </span>
                  {bonus !== 0 && (
                    <span className="text-good">
                      {t("builder.bonus")} <b className="tnum">{signed(bonus)}</b>
                    </span>
                  )}
                </div>
              </div>
              {!swappable && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="icon-sm" onClick={() => step(a, -1)} aria-label="-">
                    <Minus size={14} />
                  </Button>
                  <Button variant="secondary" size="icon-sm" onClick={() => step(a, 1)} aria-label="+">
                    <Plus size={14} />
                  </Button>
                </div>
              )}
              <Explain sheet={sheet} stat={`ability.${a}.score`} title={n.ability(a)}>
                <button onClick={(e) => e.stopPropagation()} className="flex w-16 flex-col items-center rounded-xl border border-line bg-surface/70 py-1.5">
                  <AnimatedNumber value={v.score} className="font-display text-2xl leading-none" />
                  <span className={cn("tnum mt-0.5 text-xs font-semibold", abilityMod(v.score) >= 0 ? "text-ink-2" : "text-bad")}>{signed(v.mod)}</span>
                </button>
              </Explain>
            </motion.div>
          );
        })}
      </div>

      {abilityChoices.map((c) => (
        <ChoiceBlock key={c.path} ch={c} />
      ))}
    </div>
  );
}

/** Put the highest values on the class's primary abilities, then Con, then the rest. */
function arrange(values: number[], primary: Set<Ability>): AbilityScores {
  const sorted = [...values].sort((a, b) => b - a);
  const order: Ability[] = [...ABILITIES.filter((a) => primary.has(a)), ...(primary.has("con") ? [] : (["con"] as Ability[])), ...ABILITIES.filter((a) => !primary.has(a) && a !== "con")];
  const out = {} as AbilityScores;
  order.forEach((a, i) => (out[a] = sorted[i] ?? 10));
  return out;
}
