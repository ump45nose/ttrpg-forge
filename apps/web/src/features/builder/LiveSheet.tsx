import { ABILITIES, type Sheet } from "@forge/core";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useT } from "../../app/i18n";
import { AnimatedNumber, signed } from "../../ui/AnimatedNumber";
import { cn } from "../../ui/cn";
import { Crest } from "../../ui/Crest";
import { DiffView } from "../common/DiffView";
import { Explain } from "../common/Explain";
import { useNames } from "../common/names";
import { useBuilder } from "./state";

/** Always-visible character summary. While a candidate is focused, shows the hypothetical sheet with deltas. */
export function LiveSheet({ showDiff = true }: { showDiff?: boolean }) {
  const t = useT();
  const n = useNames();
  const { sheet, preview, character } = useBuilder();
  const s = preview?.sheet ?? sheet;
  const cls = s.classes[0];
  const clsEntity = cls ? n.engine.reg.get(cls.id) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Crest id={character.id} accent={clsEntity?.accent} size={48} initials={character.name.slice(0, 1)} />
        <div className="min-w-0">
          <div className="truncate font-display text-lg leading-tight">{character.name}</div>
          <div className="truncate text-xs text-ink-2">
            {[s.speciesId && n.entity(s.speciesId, true), ...s.classes.map((c) => `${n.entity(c.id, true)} ${c.level}`)].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Tile sheet={s} base={sheet} stat="hp.max" label={t("sheet.hp")} get={(x) => x.hpMax} tone="hp" />
        <Tile sheet={s} base={sheet} stat="ac" label={t("sheet.ac")} get={(x) => x.ac} />
        <Tile sheet={s} base={sheet} stat="initiative" label={t("sheet.initiative")} get={(x) => x.initiative} signed />
        <Tile sheet={s} base={sheet} stat="speed.walk" label={t("sheet.speed")} get={(x) => x.speed.walk} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ABILITIES.map((a) => {
          const v = s.abilities[a];
          const d = v.score - sheet.abilities[a].score;
          return (
            <Explain key={a} sheet={s} stat={`ability.${a}.score`} title={n.ability(a)}>
              <button className={cn("relative rounded-xl border bg-surface/60 px-2 py-1.5 text-center transition-colors", d ? (d > 0 ? "border-good/50" : "border-bad/50") : "border-line hover:border-line-strong")}>
                <div className="text-[10px] tracking-wider text-ink-3 uppercase">{n.ability(a)}</div>
                <div className="flex items-baseline justify-center gap-1">
                  <AnimatedNumber value={v.mod} signed className="font-display text-lg" />
                  <span className="tnum text-xs text-ink-3">{v.score}</span>
                </div>
                {v.saveProf && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-class" title={t("sheet.saves")} />}
                <Delta d={d} />
              </button>
            </Explain>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <span>
          {t("sheet.prof")} <b className="tnum text-ink">{signed(s.prof)}</b>
        </span>
        <span>
          {t("sheet.passive")} <b className="tnum text-ink">{s.skills.perception?.passive ?? 10}</b>
        </span>
        {!!s.senses.darkvision && (
          <span>
            {t("sheet.darkvision")} <b className="tnum text-ink">{s.senses.darkvision}</b>
          </span>
        )}
        {s.spellcasting.map((sc) => (
          <span key={sc.classId}>
            {t("sheet.spellDC")} <b className="tnum text-magic">{sc.dc}</b>
          </span>
        ))}
      </div>

      <Skills sheet={s} base={sheet} />

      <AnimatePresence initial={false}>
        {showDiff && preview && !preview.diff.empty && (
          <motion.div key="diff" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-2xl border border-class/30 bg-class/5 p-3">
              <div className="mb-2 text-[11px] font-semibold tracking-wider text-class uppercase">{t("builder.changes")}</div>
              <DiffView diff={preview.diff} compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Skills({ sheet, base }: { sheet: Sheet; base: Sheet }) {
  const n = useNames();
  const prof = Object.entries(sheet.skills).filter(([, v]) => v.prof);
  if (!prof.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {prof.map(([k, v]) => {
        const isNew = !base.skills[k]?.prof || base.skills[k]?.prof !== v.prof;
        return (
          <Explain key={k} sheet={sheet} stat={`skill.${k}`} title={n.prof("skill", k)}>
            <button className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors", isNew ? "border-good/40 bg-good/10" : "border-line bg-surface-3/50 hover:border-line-strong")}>
              {n.prof("skill", k)}
              <span className="tnum font-semibold">{signed(v.value)}</span>
              {v.prof === "expertise" && <span className="text-[10px] text-class">★</span>}
            </button>
          </Explain>
        );
      })}
    </div>
  );
}

function Tile({ sheet, base, stat, label, get, signed: sgn, tone }: { sheet: Sheet; base: Sheet; stat: string; label: ReactNode; get: (s: Sheet) => number; signed?: boolean; tone?: "hp" }) {
  const v = get(sheet);
  const d = v - get(base);
  return (
    <Explain sheet={sheet} stat={stat} title={label}>
      <button className={cn("relative rounded-xl border bg-surface/60 px-2 py-2 text-center transition-colors", d ? (d > 0 ? "border-good/50" : "border-bad/50") : "border-line hover:border-line-strong")}>
        <div className="text-[10px] tracking-wider text-ink-3 uppercase">{label}</div>
        <AnimatedNumber value={v} signed={sgn} className={cn("font-display text-xl", tone === "hp" && "text-hp")} />
        <Delta d={d} />
      </button>
    </Explain>
  );
}

function Delta({ d }: { d: number }) {
  return (
    <AnimatePresence>
      {d !== 0 && (
        <motion.span
          initial={{ opacity: 0, y: 4, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={cn("tnum absolute -top-2 -right-1.5 rounded-full px-1.5 text-[10px] font-bold shadow", d > 0 ? "bg-good text-bg" : "bg-bad text-white")}
        >
          {signed(d)}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
