import type { ClassEntity, Entity } from "@forge/core";
import { Dices, Minus, Plus } from "lucide-react";
import { useT } from "../../../app/i18n";
import { AnimatedNumber } from "../../../ui/AnimatedNumber";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { GrantList } from "../../common/GrantList";
import { useNames } from "../../common/names";
import { LevelTimeline } from "../ChoiceBlock";
import { EntityPicker } from "../EntityPicker";
import { useBuilder } from "../state";
import { afterLanding, rollDice } from "../../dice/store";
import { Tabs } from "../../../ui/Tabs";
import { cn } from "../../../ui/cn";

export function ClassStep() {
  const { build } = useBuilder();
  return (
    <EntityPicker
      type="class"
      current={build.levels[0]?.classId}
      opsFor={(id) => [{ op: "setClass", id }]}
      lead={(e, cur) =>
        cur &&
        e.type === "class" && (
          <div className="space-y-2">
            <LevelPicker e={e} />
            <HpPicker e={e} />
          </div>
        )
      }
      showcase={(e, cur) => <ClassShowcase e={e} isCurrent={cur} />}
    />
  );
}

/** Highest level the loaded content defines for a class. */
export function maxLevelOf(c: ClassEntity): number {
  return Math.max(1, ...Object.keys(c.levels).map(Number));
}

function ClassShowcase({ e, isCurrent }: { e: Entity; isCurrent: boolean }) {
  const t = useT();
  const n = useNames();
  const { build } = useBuilder();
  if (e.type !== "class") return null;
  const saves = e.starting.flatMap((g) => (g.type === "proficiency" && g.kind === "save" ? [g.key] : []));
  const level = build.levels.length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="class">
          {t("builder.hitDie")} d{e.hitDie}
        </Chip>
        <Chip>
          {t("builder.primary")} · {e.primaryAbility.map((a) => n.ability(a)).join(" / ")}
        </Chip>
        <Chip>
          {t("builder.saves")} · {saves.map((a) => n.ability(a as never)).join(" / ")}
        </Chip>
        <Chip>{t("builder.subclassAt", { n: e.subclassLevel })}</Chip>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase">{t("common.levelN", { n: 1 })}</h3>
        <GrantList grants={e.starting} dense />
      </div>
      <div>
        <h3 className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase">{t("builder.features")}</h3>
        <div className="pl-3">
          <LevelTimeline levels={e.levels} highlight={isCurrent ? level : 0} />
        </div>
      </div>
    </div>
  );
}

/** Level for the chosen class, right under its title. */
function LevelPicker({ e }: { e: ClassEntity }) {
  const t = useT();
  const { build, apply, engine } = useBuilder();
  const level = build.levels.length;
  const contentMax = maxLevelOf(e);
  const max = Math.min(engine.reg.system.maxLevel, contentMax);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-class/30 bg-class/8 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{t("builder.level")}</div>
        <div className="text-xs text-ink-3">
          1 – {max}
          {contentMax < engine.reg.system.maxLevel && ` · ${t("builder.contentTo", { n: contentMax })}`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="icon-sm" disabled={level <= 1} onClick={() => apply([{ op: "setLevel", level: level - 1 }])} aria-label={t("builder.levelDown")}>
          <Minus size={16} />
        </Button>
        <AnimatedNumber value={level} className="w-8 text-center font-display text-2xl" />
        <Button variant="secondary" size="icon-sm" disabled={level >= max} onClick={() => apply([{ op: "setLevel", level: level + 1 }])} aria-label={t("builder.levelUp")}>
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}

/**
 * Hit points for the levels after the first: average, maximum, or rolled — with the app,
 * or on real dice and typed in. Level 1 always takes the full Hit Die.
 */
function HpPicker({ e }: { e: ClassEntity }) {
  const t = useT();
  const { build, apply, engine, sheet } = useBuilder();
  const level = build.levels.length;
  if (level < 2) return null;
  const forcedMax = engine.reg.system.hp.levelUp === "max";
  const die = e.hitDie;
  const rolls = build.levels.slice(1).map((l) => l.hp);
  const set = (method: "average" | "max" | "rolled", next: (number | undefined)[] = rolls) => apply(engine.hpMethodOps(build, method, next));
  const rollAll = async () => {
    const r = await rollDice({ expr: `${level - 1}d${die}`, label: `${t("builder.hp.title")} · ${level - 1}d${die}`, kind: "hitdie" });
    if (r) await afterLanding(r);
    const term = r?.result.terms[0];
    if (term && "dice" in term) set("rolled", term.dice.map((d) => d.value));
  };
  return (
    <div className="space-y-3 rounded-2xl border border-class/30 bg-class/8 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium">{t("builder.hp.title")}</div>
        <div className="tnum text-xs text-ink-3">{t("builder.hp.total", { n: sheet.hpMax })}</div>
      </div>
      {forcedMax ? (
        <p className="text-xs text-ink-3">{t("builder.hp.forcedMax")}</p>
      ) : (
        <>
          <Tabs
            size="sm"
            items={(["average", "max", "rolled"] as const).map((m) => ({ id: m, label: t(`builder.hp.${m}`) }))}
            value={build.hpMethod}
            onChange={(m) => set(m)}
          />
          <p className="text-xs text-ink-3">{t(`builder.hp.${build.hpMethod}Hint`, { avg: Math.floor(die / 2) + 1, die })}</p>
          {build.hpMethod === "rolled" && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {rolls.map((v, i) => (
                  <label key={i} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-ink-3">{t("common.levelN", { n: i + 2 })}</span>
                    <input
                      inputMode="numeric"
                      aria-label={t("builder.hp.levelRoll", { n: i + 2 })}
                      value={v ?? ""}
                      placeholder={String(Math.floor(die / 2) + 1)}
                      onChange={(ev) => {
                        const n = Number(ev.target.value.replace(/\D/g, ""));
                        set("rolled", rolls.map((x, j) => (j === i ? (n >= 1 ? Math.min(die, n) : undefined) : x)));
                      }}
                      className={cn("tnum h-9 w-full rounded-lg border bg-surface text-center text-sm outline-none focus:border-class", v ? "border-line-strong text-ink" : "border-line text-ink-3")}
                    />
                  </label>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => void rollAll()}>
                <Dices size={15} /> {t("builder.hp.rollAll", { expr: `${level - 1}d${die}` })}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
