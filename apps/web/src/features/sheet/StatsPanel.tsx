import { ABILITIES, type Ability, type LocalizedText } from "@forge/core";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useT } from "../../app/i18n";
import { signed } from "../../ui/AnimatedNumber";
import { cn } from "../../ui/cn";
import { useNames } from "../common/names";
import { RichText } from "../terms/RichText";
import { usePlay } from "./play";
import { d20, edge } from "./util";

/** Abilities, saves and skills (tap to roll), proficiencies and features. */
export function StatsPanel() {
  const t = useT();
  const n = useNames();
  const { sheet, roll } = usePlay();
  const check = (a: Ability) => void roll({ expr: d20(sheet.abilities[a].mod), label: t("sheet.checkOf", { name: n.ability(a) }), kind: "check", ...edge(sheet, `check.${a}`) });
  const save = (a: Ability) => void roll({ expr: d20(sheet.abilities[a].save), label: t("sheet.saveOf", { name: n.ability(a) }), kind: "save", ...edge(sheet, `save.${a}`) });
  const skills = Object.entries(sheet.skills).sort(([a], [b]) => n.prof("skill", a).localeCompare(n.prof("skill", b)));
  const kinds = ["armor", "weapon", "tool", "language"] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {ABILITIES.map((a) => {
          const v = sheet.abilities[a];
          return (
            <div key={a} className="overflow-hidden rounded-2xl border border-line bg-surface/70">
              <button type="button" onClick={() => check(a)} className="block w-full px-2 pt-2 pb-1 text-center transition-colors hover:bg-surface-3/60">
                <div className="text-[10px] font-semibold tracking-wider text-ink-3 uppercase">{n.ability(a)}</div>
                <div className="font-display text-xl text-ink">{signed(v.mod)}</div>
                <div className="tnum text-[11px] text-ink-3">{v.score}</div>
              </button>
              <button
                type="button"
                onClick={() => save(a)}
                className={cn("flex min-h-8 w-full items-center justify-center gap-1 border-t border-line py-1.5 text-xs transition-colors hover:bg-surface-3/60", v.saveProf ? "text-class" : "text-ink-3")}
              >
                {v.saveProf && <span className="h-1.5 w-1.5 rounded-full bg-class" />}
                {t("sheet.saveShort")} <b className="tnum">{signed(v.save)}</b>
              </button>
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-line bg-surface/60 p-2">
        <div className="mb-1 flex items-baseline justify-between px-1">
          <span className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("sheet.skills")}</span>
          <span className="text-[11px] text-ink-3">
            {t("sheet.passivePerception")} <b className="tnum text-ink">{sheet.skills.perception?.passive ?? 10}</b>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {skills.map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => void roll({ expr: d20(v.value), label: n.prof("skill", k), kind: "check", ...edge(sheet, `skill.${k}`, `check.${v.ability}`) })}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-3/60"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full border", v.prof === "expertise" ? "border-class bg-class" : v.prof ? "border-class bg-class/50" : "border-line-strong")} />
              <span className="min-w-0 flex-1 truncate text-ink">{n.prof("skill", k)}</span>
              <span className="text-[10px] text-ink-3 uppercase">{n.abbr(v.ability)}</span>
              <span className="tnum w-8 text-right font-medium text-ink">{signed(v.value)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-1.5 rounded-2xl border border-line bg-surface/60 p-3 text-sm">
        {kinds.map((k) => {
          const list = sheet.proficiencies.filter((p) => p.kind === k);
          if (!list.length) return null;
          return (
            <div key={k}>
              <span className="mr-2 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{n.profKind(k)}</span>
              <span className="text-ink-2">{list.map((p) => n.prof(k, p.key)).join(t("common.listSep"))}</span>
            </div>
          );
        })}
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("sheet.tabs.features")}</div>
        <div className="space-y-1.5">
          {sheet.features.map((f) => (
            <Feature key={f.id} name={n.l(f.name)} source={n.l(f.source.name, { mono: true })} text={f.text} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Feature({ name, source, text }: { name: string; source: string; text?: LocalizedText }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-surface/60">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
        <span className="shrink-0 text-[11px] text-ink-3">{source}</span>
        <ChevronDown size={14} className={cn("shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && text && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <RichText text={text} className="block px-3 pb-3 text-sm leading-relaxed text-ink-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
