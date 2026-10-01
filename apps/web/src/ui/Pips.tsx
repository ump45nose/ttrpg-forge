import { motion } from "motion/react";
import { cn } from "./cn";

/** Resource uses as tappable gems: filled = available. */
export function Pips({ max, remaining, onSpend, onRestore, tone = "accent", size = "md" }: { max: number; remaining: number; onSpend?: () => void; onRestore?: () => void; tone?: "accent" | "magic" | "hp" | "class"; size?: "sm" | "md" }) {
  if (max > 12) {
    return (
      <span className="tnum text-sm text-ink-2">
        <b className="text-ink">{remaining}</b> / {max}
      </span>
    );
  }
  const color = { accent: "var(--accent)", magic: "var(--magic)", hp: "var(--hp)", class: "var(--class)" }[tone];
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < remaining;
        return (
          <motion.button
            key={i}
            type="button"
            aria-label={filled ? "spend" : "restore"}
            whileTap={{ scale: 0.8 }}
            onClick={() => (filled ? onSpend?.() : onRestore?.())}
            className={cn("relative rotate-45 rounded-[4px] border transition-colors duration-200", size === "sm" ? "h-3 w-3" : "h-4 w-4")}
            style={{
              borderColor: filled ? color : "var(--line-strong)",
              background: filled ? `linear-gradient(135deg, color-mix(in oklab, ${color} 55%, white), ${color})` : "transparent",
              boxShadow: filled ? `0 0 10px -2px ${color}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}
