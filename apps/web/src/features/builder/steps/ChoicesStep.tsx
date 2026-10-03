import type { ChoiceView, SpellcastingView, SpellEntity } from "@forge/core";
import { Check, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useT } from "../../../app/i18n";
import { haptic } from "../../../app/settings";
import { cn } from "../../../ui/cn";
import { Tabs } from "../../../ui/Tabs";
import { useNames } from "../../common/names";
import { ChoiceBlock, SpellBadges, FoldButton } from "../ChoiceBlock";
import { InventoryPanel } from "../InventoryPanel";
import { choiceAnchor, preparedAnchor, stepOfChoice, unprepared, useBuilder } from "../state";

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
      <OpenList />
      {groups.map(([lv, list]) => (
        <section key={lv}>
          <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
            <span className="tnum flex h-6 w-6 items-center justify-center rounded-full bg-class text-[11px] text-class-ink">{lv}</span>
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
export function PreparedPanel({ sc }: { sc: SpellcastingView }) {
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
  const [expanded, setExpanded] = useState(false);
  // what was prepared when the list was opened again: those come first, so changing one is quick
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());
  // a full list folds down to the spells actually prepared (it can run to a hundred entries)
  const folded = count >= sc.preparedMax && !expanded;
  const byPin = (list: SpellEntity[]) => (pinned.size ? [...list].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id))) : list);
  const shown = folded ? pool.filter((s) => always.has(s.id) || prepared.includes(s.id)) : byPin(lv === "all" ? pool : pool.filter((s) => String(s.level) === lv));
  const toggleFold = () => {
    if (folded) setPinned(new Set(prepared));
    setExpanded(folded);
  };

  const toggle = (id: string) => {
    haptic(6);
    const next = prepared.includes(id) ? prepared.filter((x) => x !== id) : count < sc.preparedMax ? [...prepared, id] : prepared;
    apply([{ op: "setPrepared", classId: sc.classId, spells: next }]);
  };

  return (
    <section id={preparedAnchor(sc.classId)} className="scroll-mt-[calc(var(--builder-head,0px)+3.5rem)]">
      <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
        {t("builder.spellsPrepared")} · {n.entity(sc.classId, true)}
        <span className="h-px flex-1 bg-line" />
        <span className={cn("tnum rounded-full px-2 py-0.5 text-[11px] normal-case", count >= sc.preparedMax ? "bg-good/15 text-good" : "bg-warn/15 text-warn")}>
          {count}/{sc.preparedMax}
        </span>
      </h2>
      {count === 0 && <p className="mb-3 rounded-xl border border-warn/30 bg-warn/8 px-3 py-2 text-xs text-warn">{t("builder.review.preparedNone")}</p>}
      {!folded && levels.length > 1 && (
        <Tabs size="sm" className="mb-3" items={[{ id: "all", label: t("common.all") }, ...levels.map((l) => ({ id: String(l), label: t("spell.level", { n: l }) }))]} value={lv} onChange={setLv} />
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      {count >= sc.preparedMax && <FoldButton folded={folded} total={pool.length} onToggle={toggleFold} />}
    </section>
  );
}

/**
 * What's still open on this (long) page, as a sticky row of chips: tap one to jump there.
 * Sits right under the builder header.
 */
function OpenList() {
  const t = useT();
  const n = useNames();
  const { sheet, build } = useBuilder();
  const open = sheet.choices.filter((c) => c.remaining > 0 && stepOfChoice(c.path, c.choice.from.kind) === "choices");
  const prep = unprepared(sheet, build);
  if (!open.length && !prep.length) return null;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <nav aria-label={t("builder.openList")} className="glass sticky top-[var(--builder-head,0px)] z-20 -mx-4 border-b border-line px-4 py-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border">
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
        <span className="shrink-0 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("builder.openList")}</span>
        {open.map((c) => (
          <button key={c.path} type="button" onClick={() => jump(choiceAnchor(c.path))} className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-warn/40 bg-warn/10 px-2.5 text-xs text-ink hover:border-warn">
            {n.l(c.choice.name)}
            <span className="tnum text-warn">{c.selected.length}/{c.count}</span>
          </button>
        ))}
        {prep.map((p) => (
          <button key={p.classId} type="button" onClick={() => jump(preparedAnchor(p.classId))} className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-magic/40 bg-magic/10 px-2.5 text-xs text-ink hover:border-magic">
            {t("builder.spellsPrepared")}
            <span className="tnum text-magic">{p.count}/{p.max}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
