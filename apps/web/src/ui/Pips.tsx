import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useT } from "../app/i18n";
import { cn } from "./cn";

/** Resource uses as tappable gems: filled = available. Large pools (Lay on Hands...) get a stepper instead. */
export function Pips({ max, remaining, onSpend, onRestore, tone = "accent", size = "md" }: { max: number; remaining: number; onSpend?: () => void; onRestore?: () => void; tone?: "accent" | "magic" | "hp" | "class"; size?: "sm" | "md" }) {
  const t = useT();
  if (max > 12) {
    return (
      <div className="inline-flex items-center gap-1">
        <button type="button" disabled={!onSpend || remaining <= 0} onClick={onSpend} aria-label={t("sheet.pipSpend")} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40">
          <Minus size={15} />
        </button>
        <span className="tnum min-w-14 text-center text-sm text-ink-2">
          <b className="text-ink">{remaining}</b> / {max}
        </span>
        <button type="button" disabled={!onRestore || remaining >= max} onClick={onRestore} aria-label={t("sheet.pipRestore")} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40">
          <Plus size={15} />
        </button>
      </div>
    );
  }
  const color = { accent: "var(--accent)", magic: "var(--magic)", hp: "var(--hp)", class: "var(--class)" }[tone];
  return (
    <div className="-mx-1 flex flex-wrap">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < remaining;
        return (
          // the gem is small; the button around it is finger-sized
          <motion.button
            key={i}
            type="button"
            aria-label={filled ? t("sheet.pipSpend") : t("sheet.pipRestore")}
            whileTap={{ scale: 0.8 }}
            onClick={() => (filled ? onSpend?.() : onRestore?.())}
            className={cn("flex items-center justify-center", size === "sm" ? "h-8 w-6" : "h-8 w-7")}
          >
            <span
              className={cn("rotate-45 rounded-[4px] border transition-colors duration-200", size === "sm" ? "h-3 w-3" : "h-4 w-4")}
              style={{
                borderColor: filled ? color : "var(--line-strong)",
                background: filled ? `linear-gradient(135deg, color-mix(in oklab, ${color} 55%, white), ${color})` : "transparent",
                boxShadow: filled ? `0 0 10px -2px ${color}` : "none",
              }}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
