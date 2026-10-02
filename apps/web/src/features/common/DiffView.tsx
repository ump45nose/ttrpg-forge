import type { SheetDiff } from "@forge/core";
import { ArrowRight, Minus, Plus, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useT } from "../../app/i18n";
import { signed } from "../../ui/AnimatedNumber";
import { cn } from "../../ui/cn";
import { useNames } from "./names";

/** "If you pick this": what is gained, lost and changed — the heart of the preview. */
export function DiffView({ diff, compact = false }: { diff: SheetDiff; compact?: boolean }) {
  const t = useT();
  const n = useNames();
  if (diff.empty) return <div className="py-3 text-sm text-ink-3">{t("builder.noChanges")}</div>;

  const stats = diff.stats.filter((s) => !s.stat.startsWith("skill.") || Math.abs(s.delta) > 0);
  const gains: ReactNode[] = [];
  const losses: ReactNode[] = [];
  const profLabel = (id: string) => {
    // id = kind:key:level, where key itself may contain ":" (item:longsword)
    const kind = id.slice(0, id.indexOf(":"));
    const level = id.slice(id.lastIndexOf(":") + 1);
    const key = id.slice(kind.length + 1, id.length - level.length - 1);
    return `${n.prof(kind, key)}${level === "expertise" ? ` (${t("prof.expertise")})` : ""}`;
  };
  diff.entities.added.forEach((e) => gains.push(<Item key={`e${e.id}`} kind={t(`entity.${e.detail}`, { defaultValue: "" })}>{n.l(e.name)}</Item>));
  diff.features.added.forEach((f) => gains.push(<Item key={`f${f.id}`}>{n.l(f.name)}</Item>));
  diff.resources.added.forEach((r) => gains.push(<Item key={`r${r.id}`}>{`${n.l(r.name)} ×${r.detail}`}</Item>));
  diff.spells.added.forEach((s) => gains.push(<Item key={`s${s.id}`} kind="✦">{n.l(s.name)}</Item>));
  diff.proficiencies.added.forEach((p) => gains.push(<Item key={`p${p.id}`} kind={t(`profKind.${p.detail}`)}>{profLabel(p.id)}</Item>));
  diff.entities.removed.forEach((e) => losses.push(<Item key={`e${e.id}`}>{n.l(e.name)}</Item>));
  diff.features.removed.forEach((f) => losses.push(<Item key={`f${f.id}`}>{n.l(f.name)}</Item>));
  diff.spells.removed.forEach((s) => losses.push(<Item key={`s${s.id}`}>{n.l(s.name)}</Item>));
  diff.proficiencies.removed.forEach((p) => losses.push(<Item key={`p${p.id}`} kind={t(`profKind.${p.detail}`)}>{profLabel(p.id)}</Item>));
  diff.resources.removed.forEach((r) => losses.push(<Item key={`r${r.id}`}>{n.l(r.name)}</Item>));
  const cap = compact ? 8 : 40;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-3">
      {(stats.length > 0 || diff.slots.length > 0 || diff.resources.changed.length > 0) && (
        <div className={cn("grid gap-1.5", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
          {[...stats, ...diff.slots, ...diff.resources.changed].slice(0, compact ? 6 : 30).map((s) => (
            <div key={s.stat} className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs", s.delta > 0 ? "border-good/25 bg-good/8" : "border-bad/25 bg-bad/8")}>
              <span className="min-w-0 flex-1 truncate text-ink-2">{statLabel(s.stat, n) ?? n.l(s.label)}</span>
              <span className="tnum text-ink-3">{s.before}</span>
              <ArrowRight size={11} className="text-ink-3" />
              <span className={cn("tnum font-semibold", s.delta > 0 ? "text-good" : "text-bad")}>{s.after}</span>
              <span className={cn("tnum text-[10px]", s.delta > 0 ? "text-good" : "text-bad")}>({signed(s.delta)})</span>
            </div>
          ))}
        </div>
      )}
      {gains.length > 0 && (
        <Group icon={<Plus size={12} />} title={t("builder.gains")} tone="good">
          {gains.slice(0, cap)}
          {gains.length > cap && <span className="text-xs text-ink-3">+{gains.length - cap}</span>}
        </Group>
      )}
      {losses.length > 0 && (
        <Group icon={<Minus size={12} />} title={t("builder.loses")} tone="bad">
          {losses.slice(0, cap)}
        </Group>
      )}
      {diff.choices.added.length > 0 && (
        <Group icon={<TriangleAlert size={12} />} title={t("builder.newChoices")} tone="warn">
          {diff.choices.added.map((c) => (
            <Item key={c.id}>{`${n.l(c.name)} ×${c.detail}`}</Item>
          ))}
        </Group>
      )}
      {diff.issues.added.length > 0 && (
        <div className="space-y-1">
          {diff.issues.added.map((i, k) => (
            <div key={k} className="flex items-start gap-1.5 text-xs text-bad">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              {n.l(i.message)}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function statLabel(stat: string, n: ReturnType<typeof useNames>): string | undefined {
  const m = /^ability\.(\w+)/.exec(stat);
  if (m) return n.ability(m[1] as never);
  const s = /^skill\.(.+)$/.exec(stat);
  if (s) return n.prof("skill", s[1]!);
  return undefined;
}

function Group({ icon, title, tone, children }: { icon: ReactNode; title: string; tone: "good" | "bad" | "warn"; children: ReactNode }) {
  const c = { good: "text-good", bad: "text-bad", warn: "text-warn" }[tone];
  return (
    <div>
      <div className={cn("mb-1.5 flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase", c)}>
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Item({ children, kind }: { children: ReactNode; kind?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-3/60 px-2 py-0.5 text-xs text-ink">
      {kind && <span className="text-[10px] text-ink-3">{kind}</span>}
      {children}
    </span>
  );
}
