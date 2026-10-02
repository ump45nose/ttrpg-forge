import type { ChoiceView, SpellcastingView, SpellEntity } from "@forge/core";
import { Check, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useT } from "../../../app/i18n";
import { haptic } from "../../../app/settings";
import { cn } from "../../../ui/cn";
import { Tabs } from "../../../ui/Tabs";
import { useNames } from "../../common/names";
import { ChoiceBlock, SpellBadges } from "../ChoiceBlock";
import { InventoryPanel } from "../InventoryPanel";
import { stepOfChoice, useBuilder } from "../state";

const levelOf = (c: ChoiceView) => Number(/@(\d+)/.exec(c.path)?.[1] ?? c.source.level ?? 1);

export function ChoicesStep() {
  const t = useT();
  const { sheet } = useBuilder();
  const groups = useMemo(() => {
    const m = new Map<number, ChoiceView[]>();
    for (const c of sheet.choices) {
      if (stepOfChoice(c.path, c.choice.from.kind) !== "choices") continue;
      const lv = levelOf(c);
      m.set(lv, [...(m.get(lv) ?? []), c]);
    }
    return [...m].sort((a, b) => a[0] - b[0]);
  }, [sheet.choices]);

  if (!sheet.classes.length) return <p className="py-12 text-center text-ink-3">{t("builder.pickFirst")}</p>;

  return (
    <div className="space-y-8">
      {groups.map(([lv, list]) => (
        <section key={lv}>
          <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
            <span className="tnum flex h-6 w-6 items-center justify-center rounded-full bg-class text-[11px] text-white">{lv}</span>
            {t("common.levelN", { n: lv })}
            <span className="h-px flex-1 bg-line" />
          </h2>
          <div className="space-y-3">
            {list.map((c) => (
              <ChoiceBlock key={c.path} ch={c} />
            ))}
          </div>
        </section>
      ))}
      {sheet.spellcasting
        .filter((sc) => sc.mode !== "known" && sc.preparedMax > 0)
        .map((sc) => (
          <PreparedPanel key={sc.classId} sc={sc} />
        ))}
      <InventoryPanel />
    </div>
  );
}

/** Daily prepared spells: from the whole class list (cleric) or from the spellbook (wizard). */
function PreparedPanel({ sc }: { sc: SpellcastingView }) {
  const t = useT();
  const n = useNames();
  const { sheet, build, apply, engine } = useBuilder();
  const prepared = build.prepared[sc.classId] ?? [];
  const always = new Set(sheet.spells.filter((s) => s.classId === sc.classId && s.alwaysPrepared).map((s) => s.spellId));
  const pool = useMemo(() => {
    const ids =
      sc.mode === "prepared"
        ? engine.reg
            .all("spell")
            .filter((s) => s.level > 0 && s.level <= sc.maxSpellLevel && s.tags?.includes(sc.list))
            .map((s) => s.id)
        : sheet.spells.filter((s) => s.classId === sc.classId && s.level > 0 && s.known && !s.path.includes("/prepared=")).map((s) => s.spellId);
    return [...new Set(ids)].map((id) => engine.reg.getOf("spell", id)).filter((s): s is SpellEntity => !!s).sort((a, b) => a.level - b.level || n.l(a.name).localeCompare(n.l(b.name)));
  }, [engine, sc, sheet.spells, n]);
  const levels = [...new Set(pool.map((s) => s.level))];
  const [lv, setLv] = useState<string>("all");
  const count = prepared.filter((id) => !always.has(id)).length;
  const shown = lv === "all" ? pool : pool.filter((s) => String(s.level) === lv);

  const toggle = (id: string) => {
    haptic(6);
    const next = prepared.includes(id) ? prepared.filter((x) => x !== id) : count < sc.preparedMax ? [...prepared, id] : prepared;
    apply([{ op: "setPrepared", classId: sc.classId, spells: next }]);
  };

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
        {t("builder.spellsPrepared")} · {n.entity(sc.classId, true)}
        <span className="h-px flex-1 bg-line" />
        <span className={cn("tnum rounded-full px-2 py-0.5 text-[11px] normal-case", count >= sc.preparedMax ? "bg-good/15 text-good" : "bg-warn/15 text-warn")}>
          {count}/{sc.preparedMax}
        </span>
      </h2>
      {levels.length > 1 && (
        <Tabs size="sm" className="mb-3" items={[{ id: "all", label: t("common.all") }, ...levels.map((l) => ({ id: String(l), label: t("spell.level", { n: l }) }))]} value={lv} onChange={setLv} />
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((s) => {
          const isAlways = always.has(s.id);
          const on = isAlways || prepared.includes(s.id);
          const full = !on && count >= sc.preparedMax;
          return (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.98 }}
              disabled={isAlways || full}
              onClick={() => toggle(s.id)}
              className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors", on ? "border-magic/60 bg-magic/10" : "border-line bg-surface/50 hover:border-line-strong", full && "opacity-45")}
            >
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-magic bg-magic text-white" : "border-line-strong")}>
                {isAlways ? <Lock size={11} /> : on && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{n.l(s.name)}</span>
                  <SpellBadges e={s} />
                </span>
                {s.summary && <span className="block truncate text-xs text-ink-3">{n.l(s.summary)}</span>}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
