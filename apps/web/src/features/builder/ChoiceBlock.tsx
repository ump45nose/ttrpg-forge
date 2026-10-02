import { choiceCandidates, type Ability, type BuildOp, type ChoiceCandidate, type ChoiceView, type Entity } from "@forge/core";
import { Check, Info, Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useT } from "../../app/i18n";
import { haptic } from "../../app/settings";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Field";
import { useIsDesktop } from "../../ui/hooks";
import { Sheet } from "../../ui/Sheet";
import { DiffView } from "../common/DiffView";
import { GrantList } from "../common/GrantList";
import { useNames } from "../common/names";
import { useBuilder } from "./state";

/** One pending/finished choice: skills, fighting style, feat, spells, equipment, ability increases... */
export function ChoiceBlock({ ch, hideSource = false }: { ch: ChoiceView; hideSource?: boolean }) {
  const n = useNames();
  const { sheet } = useBuilder();
  const candidates = useMemo(() => choiceCandidates(n.engine.reg, sheet, ch), [n.engine, sheet, ch]);
  const kind = ch.choice.from.kind;
  const done = ch.remaining <= 0;

  return (
    <motion.section layout="position" className={cn("card p-4", !done && "border-warn/30")}>
      <header className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{n.l(ch.choice.name)}</h3>
          {!hideSource && <div className="mt-0.5 truncate text-xs text-ink-3">{n.l(ch.source.name)}</div>}
          {ch.choice.text && <p className="mt-1 text-xs leading-relaxed text-ink-2">{n.l(ch.choice.text, { mono: true })}</p>}
        </div>
        <Counter selected={kind === "ability" ? (ch.selected.length ? 1 : 0) : ch.selected.length} count={ch.count} />
      </header>
      {kind === "ability" ? (
        <AbilityChoiceEditor ch={ch} />
      ) : kind === "proficiency" ? (
        <ChipGrid ch={ch} candidates={candidates} />
      ) : kind === "options" ? (
        <OptionCards ch={ch} candidates={candidates} />
      ) : (
        <EntityList ch={ch} candidates={candidates} />
      )}
    </motion.section>
  );
}

function Counter({ selected, count }: { selected: number; count: number }) {
  const done = selected >= count;
  return (
    <motion.span
      key={done ? "done" : "todo"}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("tnum inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold", done ? "bg-good/15 text-good" : "bg-warn/15 text-warn")}
    >
      {done && <Check size={12} strokeWidth={3} />}
      {selected}/{count}
    </motion.span>
  );
}

const toggleOp = (ch: ChoiceView, id: string): BuildOp[] => [{ op: "toggleChoice", path: ch.path, id, max: ch.count }];

/** Hover → preview in the live sheet. */
function usePreviewHandlers(ch: ChoiceView) {
  const { setFocus } = useBuilder();
  const desktop = useIsDesktop();
  return (c: ChoiceCandidate) =>
    desktop
      ? {
          onMouseEnter: () => c.valid && setFocus(toggleOp(ch, c.id)),
          onMouseLeave: () => setFocus(null),
        }
      : {};
}

function ChipGrid({ ch, candidates }: { ch: ChoiceView; candidates: ChoiceCandidate[] }) {
  const n = useNames();
  const { apply } = useBuilder();
  const hover = usePreviewHandlers(ch);
  return (
    <div className="flex flex-wrap gap-1.5">
      {candidates.map((c) => (
        <motion.button
          key={c.id}
          whileTap={c.valid || c.selected ? { scale: 0.94 } : undefined}
          disabled={!c.valid && !c.selected}
          title={c.reason ? n.l(c.reason) : undefined}
          onClick={() => {
            haptic(6);
            apply(toggleOp(ch, c.id));
          }}
          {...hover(c)}
          className={cn(
            "relative inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors",
            c.selected
              ? "border-class/70 bg-class/18 text-ink shadow-[0_6px_18px_-10px_var(--class)]"
              : c.valid
                ? "border-line bg-surface/60 text-ink-2 hover:border-line-strong hover:text-ink"
                : "cursor-not-allowed border-line/50 text-ink-3/60 line-through",
          )}
        >
          <AnimatePresence initial={false}>
            {c.selected && (
              <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden text-class">
                <Check size={14} strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
          {n.l(c.name, { mono: true })}
        </motion.button>
      ))}
    </div>
  );
}

function OptionCards({ ch, candidates }: { ch: ChoiceView; candidates: ChoiceCandidate[] }) {
  const n = useNames();
  const { apply } = useBuilder();
  const hover = usePreviewHandlers(ch);
  const options = ch.choice.from.kind === "options" ? ch.choice.from.options : [];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {candidates.map((c) => {
        const opt = options.find((o) => o.id === c.id);
        return (
          <motion.button
            key={c.id}
            whileTap={{ scale: 0.98 }}
            disabled={!c.valid && !c.selected}
            onClick={() => {
              haptic(6);
              apply(toggleOp(ch, c.id));
            }}
            {...hover(c)}
            className={cn(
              "relative rounded-xl border p-3 text-left transition-colors",
              c.selected ? "border-class/70 bg-class/12" : "border-line bg-surface/50 hover:border-line-strong",
              !c.valid && !c.selected && "opacity-50",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", c.selected ? "border-class bg-class text-white" : "border-line-strong")}>
                {c.selected && <Check size={10} strokeWidth={4} />}
              </span>
              <span className="text-sm font-medium text-ink">{n.l(c.name)}</span>
            </div>
            {c.text && <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{n.l(c.text, { mono: true })}</p>}
            {opt && !c.text && <GrantList grants={opt.grants} dense className="mt-2" />}
            {c.reason && <p className="mt-1 text-xs text-bad">{n.l(c.reason)}</p>}
          </motion.button>
        );
      })}
    </div>
  );
}

function EntityList({ ch, candidates }: { ch: ChoiceView; candidates: ChoiceCandidate[] }) {
  const t = useT();
  const n = useNames();
  const { apply } = useBuilder();
  const hover = usePreviewHandlers(ch);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<ChoiceCandidate>();
  const isSpell = ch.choice.from.kind === "entity" && ch.choice.from.entityType === "spell";
  const q = query.trim().toLowerCase();
  const shown = q ? candidates.filter((c) => [n.l(c.name), ...(c.entity?.aliases ?? [])].join(" ").toLowerCase().includes(q) || c.id.includes(q)) : candidates;
  const toggle = (c: ChoiceCandidate) => {
    haptic(6);
    apply(toggleOp(ch, c.id));
  };

  return (
    <>
      {candidates.length > 10 && (
        <div className="relative mb-3">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("common.search")} className="pl-9" />
        </div>
      )}
      <div className={cn("grid gap-2", isSpell ? "sm:grid-cols-2" : "")}>
        {shown.map((c) => (
          <div
            key={c.id}
            {...hover(c)}
            className={cn(
              "group relative flex items-center gap-2 rounded-xl border transition-colors",
              c.selected ? "border-class/70 bg-class/12" : "border-line bg-surface/50 hover:border-line-strong",
              !c.valid && !c.selected && "opacity-50",
            )}
          >
            <button
              disabled={!c.valid && !c.selected}
              onClick={() => (isSpell ? toggle(c) : setDetail(c))}
              className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 text-left"
            >
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors", c.selected ? "border-class bg-class text-white" : "border-line-strong")}>
                {c.selected && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <span className="truncate">{n.l(c.name)}</span>
                  {c.entity?.type === "spell" && <SpellBadges e={c.entity} />}
                </span>
                {(c.summary || c.reason) && <span className={cn("block truncate text-xs", c.reason ? "text-bad" : "text-ink-3")}>{n.l(c.reason ?? c.summary)}</span>}
              </span>
            </button>
            <button onClick={() => setDetail(c)} className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label={t("common.details")}>
              <Info size={16} />
            </button>
          </div>
        ))}
      </div>
      <CandidateDetail ch={ch} candidate={detail} onClose={() => setDetail(undefined)} />
    </>
  );
}

export function SpellBadges({ e }: { e: Entity }) {
  const t = useT();
  if (e.type !== "spell") return null;
  return (
    <span className="flex shrink-0 items-center gap-1 text-[10px] font-normal text-ink-3">
      <span className="rounded bg-magic/15 px-1 text-magic">{e.level === 0 ? t("spell.cantrip") : t("spell.level", { n: e.level })}</span>
      {e.concentration && <span title={t("spell.concentration")}>Ⓒ</span>}
      {e.ritual && <span title={t("spell.ritual")}>Ⓡ</span>}
    </span>
  );
}

/** Full text + "what changes" + choose/remove — the mobile way to compare candidates. */
function CandidateDetail({ ch, candidate, onClose }: { ch: ChoiceView; candidate: ChoiceCandidate | undefined; onClose: () => void }) {
  const t = useT();
  const n = useNames();
  const { engine, build, sheet, issues, apply } = useBuilder();
  const p = useMemo(() => (candidate ? engine.preview(build, sheet, toggleOp(ch, candidate.id), issues) : undefined), [engine, build, sheet, issues, ch, candidate]);
  const e = candidate?.entity;
  return (
    <Sheet
      open={!!candidate}
      onOpenChange={(o) => !o && onClose()}
      title={candidate ? n.l(candidate.name) : ""}
      description={e?.type === "spell" ? <SpellMeta e={e} /> : candidate?.summary ? n.l(candidate.summary) : undefined}
      footer={
        candidate && (
          <Button
            variant={candidate.selected ? "danger" : "class"}
            size="lg"
            className="w-full"
            disabled={!candidate.valid && !candidate.selected}
            onClick={() => {
              apply(toggleOp(ch, candidate.id));
              onClose();
            }}
          >
            {candidate.selected ? t("common.remove") : t("common.choose")}
          </Button>
        )
      }
    >
      {candidate && (
        <div className="space-y-4">
          {candidate.reason && <Chip tone="bad">{n.l(candidate.reason)}</Chip>}
          {candidate.text && <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{n.l(candidate.text, { mono: true })}</p>}
          {e?.type === "spell" && e.higherLevels && (
            <p className="text-sm text-ink-2">
              <Sparkles size={13} className="mr-1 inline text-magic" />
              {n.l(e.higherLevels, { mono: true })}
            </p>
          )}
          {e && e.type !== "spell" && <GrantList grants={e.grants} />}
          {e?.type === "subclass" && <LevelTimeline levels={e.levels} />}
          {p && (
            <div className="rounded-2xl border border-class/30 bg-class/5 p-3">
              <div className="mb-2 text-[11px] font-semibold tracking-wider text-class uppercase">{t("builder.changes")}</div>
              <DiffView diff={p.diff} />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function SpellMeta({ e }: { e: Entity }) {
  const t = useT();
  const n = useNames();
  if (e.type !== "spell") return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      <span>{e.level === 0 ? t("spell.cantrip") : t("spell.level", { n: e.level })}</span>
      <span>{n.l(e.castingTime)}</span>
      <span>{n.l(e.range)}</span>
      <span>{e.components}</span>
      <span>{n.l(e.duration)}</span>
    </span>
  );
}

/** Per-level features of a class or subclass. */
export function LevelTimeline({ levels, from = 1, to = 20, highlight }: { levels: Record<string, import("@forge/core").Grant[]>; from?: number; to?: number; highlight?: number }) {
  const t = useT();
  const entries = Object.entries(levels)
    .map(([lv, g]) => [Number(lv), g] as const)
    .filter(([lv]) => lv >= from && lv <= to)
    .sort((a, b) => a[0] - b[0]);
  return (
    <ol className="relative space-y-3 border-l border-line pl-5">
      {entries.map(([lv, grants]) => (
        <li key={lv} className="relative">
          <span
            className={cn(
              "tnum absolute top-0.5 -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold",
              highlight !== undefined && lv <= highlight ? "border-class bg-class text-white" : "border-line-strong bg-surface-2 text-ink-3",
            )}
          >
            {lv}
          </span>
          <div className="mb-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("common.levelN", { n: lv })}</div>
          <GrantList grants={grants} dense />
        </li>
      ))}
    </ol>
  );
}

/* ───────── ability increases (+2/+1 or +1/+1/+1) ───────── */

function AbilityChoiceEditor({ ch }: { ch: ChoiceView }) {
  const n = useNames();
  const { apply, sheet } = useBuilder();
  const from = ch.choice.from.kind === "ability" ? ch.choice.from : undefined;
  const patterns = from?.patterns ?? [];
  const cap = from?.cap ?? 20;
  const current = new Map(ch.selected.map((s) => [s.split(":")[0] as Ability, Number(s.split(":")[1])]));
  const curPattern = [...current.values()].sort((a, b) => b - a).join(",");
  const [patternIdx, setPatternIdx] = useState(() => Math.max(0, patterns.findIndex((p) => [...p].sort((a, b) => b - a).join(",") === curPattern)));
  const pattern = [...(patterns[patternIdx] ?? [1, 1, 1])].sort((a, b) => b - a);

  const set = (sel: Map<Ability, number>) => apply([{ op: "setChoice", path: ch.path, selected: [...sel].map(([a, v]) => `${a}:${v}`) }]);

  /** Assign `amount` to ability `a` within the current pattern. */
  const assign = (a: Ability, amount: number) => {
    const next = new Map([...current].filter(([, v]) => pattern.includes(v)));
    if (next.get(a) === amount) next.delete(a);
    else {
      next.delete(a);
      // keep the pattern's multiset: drop the oldest holder of this amount if it's full
      const holders = [...next].filter(([, v]) => v === amount);
      const allowed = pattern.filter((v) => v === amount).length;
      if (holders.length >= allowed) next.delete(holders[0]![0]);
      next.set(a, amount);
    }
    set(next);
  };

  const amounts = [...new Set(pattern)];
  return (
    <div>
      {patterns.length > 1 && (
        <div className="mb-3 inline-flex rounded-xl border border-line bg-surface/60 p-1">
          {patterns.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setPatternIdx(i);
                if (ch.selected.length) apply([{ op: "setChoice", path: ch.path, selected: [] }]);
              }}
              className={cn("tnum relative rounded-lg px-3 py-1 text-sm transition-colors", i === patternIdx ? "text-ink" : "text-ink-3 hover:text-ink-2")}
            >
              {i === patternIdx && <motion.span layoutId={`pat-${ch.path}`} className="absolute inset-0 rounded-lg bg-surface-3" />}
              <span className="relative">{[...p].sort((a, b) => b - a).map((v) => `+${v}`).join(" / ")}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(from?.abilities ?? []).map((a) => {
          const v = current.get(a);
          const score = sheet.abilities[a].score;
          return (
            <div key={a} className={cn("rounded-xl border p-2 text-center transition-colors", v ? "border-class/60 bg-class/10" : "border-line bg-surface/50")}>
              <div className="text-xs text-ink-2">{n.ability(a)}</div>
              <div className="tnum font-display text-lg">{score}</div>
              <div className="mt-1 flex justify-center gap-1">
                {amounts.map((amt) => {
                  const active = v === amt;
                  const over = !active && score - (v ?? 0) + amt > cap;
                  return (
                    <button
                      key={amt}
                      disabled={over}
                      onClick={() => assign(a, amt)}
                      className={cn(
                        "tnum h-7 min-w-9 rounded-lg border px-1.5 text-xs font-semibold transition-colors",
                        active ? "border-class bg-class text-white" : "border-line text-ink-2 hover:border-class/60",
                        over && "opacity-30",
                      )}
                    >
                      +{amt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
