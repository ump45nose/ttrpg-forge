import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  badge?: ReactNode;
}

/** Segmented tabs with a sliding highlight. */
export function Tabs<T extends string>({ items, value, onChange, className, size = "md" }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string; size?: "sm" | "md" }) {
  const id = useId();
  return (
    <div role="tablist" className={cn("relative flex gap-1 rounded-xl border border-line bg-surface/70 p-1", className)}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={cn(
              "relative z-0 flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 -z-10 rounded-lg bg-surface-3 shadow-card" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            {it.label}
            {it.badge}
          </button>
        );
      })}
    </div>
  );
}
