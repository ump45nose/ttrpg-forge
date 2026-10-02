import type { Grant } from "@forge/core";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../ui/cn";
import { useNames } from "./names";

/** Human-readable rendering of what an entity grants (features first, then the small stuff). */
export function GrantList({ grants, className, dense = false }: { grants: Grant[] | undefined; className?: string; dense?: boolean }) {
  const n = useNames();
  if (!grants?.length) return null;
  const rows: ReactNode[] = [];
  const chips: ReactNode[] = [];
  grants.forEach((g, i) => {
    switch (g.type) {
      case "feature":
        rows.push(
          <div key={i} className="rounded-xl border border-line bg-surface/50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
              {n.l(g.name)}
              {g.minLevel && <span className="text-[10px] text-ink-3">Lv{g.minLevel}+</span>}
            </div>
            {g.text && <p className={cn("mt-0.5 text-xs leading-relaxed text-ink-2", dense && "line-clamp-2")}>{n.l(g.text, { mono: true })}</p>}
          </div>,
        );
        break;
      case "choice":
        chips.push(
          <Pill key={i} tone="warn">
            {n.l(g.name)}
          </Pill>,
        );
        break;
      case "proficiency":
        chips.push(
          <Pill key={i}>
            <span className="text-ink-3">{n.profKind(g.kind)}</span> {n.prof(g.kind, g.key)}
            {g.level === "expertise" && ` (${n.t("prof.expertise")})`}
          </Pill>,
        );
        break;
      case "resource":
        chips.push(<Pill key={i}>{n.l(g.name)}</Pill>);
        break;
      case "action":
        chips.push(
          <Pill key={i} tone="accent">
            <span className="text-ink-3">{n.activation(g.action.activation)}</span> {n.l(g.action.name)}
          </Pill>,
        );
        break;
      case "grant":
        chips.push(
          <Pill key={i} tone="accent">
            {n.entity(g.entity)}
          </Pill>,
        );
        break;
      case "spell":
        chips.push(
          <Pill key={i} tone="magic">
            <Sparkles size={11} /> {n.entity(g.spell)}
            {g.minLevel && <span className="text-[10px] text-ink-3">Lv{g.minLevel}</span>}
          </Pill>,
        );
        break;
      case "item":
        chips.push(<Pill key={i}>{`${n.entity(g.item)}${g.qty && g.qty > 1 ? ` ×${g.qty}` : ""}`}</Pill>);
        break;
      case "spellcasting":
        chips.push(
          <Pill key={i} tone="magic">
            {n.t("sheet.spellDC")} · {n.ability(g.ability)}
          </Pill>,
        );
        break;
      case "modifier":
      case "tag":
        if (g.label) chips.push(<Pill key={i}>{n.l(g.label)}</Pill>);
        break;
    }
  });
  return (
    <div className={cn("space-y-2", className)}>
      {rows}
      {chips.length > 0 && <div className="flex flex-wrap gap-1.5">{chips}</div>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "magic" | "warn" }) {
  const c = {
    neutral: "border-line bg-surface-3/50 text-ink",
    accent: "border-class/30 bg-class/10 text-ink",
    magic: "border-magic/30 bg-magic/10 text-ink",
    warn: "border-warn/30 bg-warn/10 text-ink",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs", c)}>{children}</span>;
}
