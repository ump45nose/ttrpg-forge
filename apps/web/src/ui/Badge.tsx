import { motion } from "motion/react";

/** Small count bubble for pending items. */
export function CountBadge({ n, tone = "warn" }: { n: number; tone?: "warn" | "class" }) {
  if (!n) return null;
  return (
    <motion.span
      key={n}
      initial={{ scale: 0.6 }}
      animate={{ scale: 1 }}
      className={`tnum ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${tone === "warn" ? "bg-warn text-bg" : "bg-class text-class-ink"}`}
    >
      {n}
    </motion.span>
  );
}
