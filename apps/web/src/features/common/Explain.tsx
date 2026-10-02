import type { Sheet } from "@forge/core";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import { useL, useT } from "../../app/i18n";
import { signed } from "../../ui/AnimatedNumber";
import { cn } from "../../ui/cn";

/** Tap any number to see where it comes from. */
export function Explain({ sheet, stat, children, title }: { sheet: Sheet; stat: string; children: ReactNode; title?: ReactNode }) {
  const t = useT();
  const l = useL();
  const parts = sheet.explain(stat);
  const total = sheet.stats.get(stat);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={12} className="z-50 w-72 rounded-2xl border border-line-strong bg-surface-2 p-3 shadow-float outline-none">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <div className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{title ?? t("builder.why")}</div>
            <div className="tnum font-display text-xl text-ink">{total}</div>
          </div>
          <ul className="space-y-1">
            {parts.map((p, i) => (
              <li key={i} className={cn("flex items-center gap-2 text-sm", (!p.active || p.superseded) && "opacity-45")}>
                <span className={cn("min-w-0 flex-1 truncate", !p.active && "line-through")}>{l(p.label)}</span>
                <span className="text-[10px] text-ink-3 uppercase">{p.op === "add" ? "" : p.op}</span>
                <span className="tnum w-10 text-right font-medium text-ink">{p.op === "add" ? signed(p.value) : p.value}</span>
              </li>
            ))}
          </ul>
          <Popover.Arrow className="fill-surface-2" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
