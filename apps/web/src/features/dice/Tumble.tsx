import type { RollResult } from "@forge/core";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "../../ui/cn";

/** Outline of a die seen from above, in a 100×100 box. */
const SHAPES: Record<number, string> = {
  4: "50,8 94,86 6,86",
  6: "14,14 86,14 86,86 14,86",
  8: "50,4 94,50 50,96 6,50",
  10: "50,4 92,40 76,92 24,92 8,40",
  12: "50,4 94,36 78,92 22,92 6,36",
  20: "50,3 92,27 92,73 50,97 8,73 8,27",
};

export function DieShape({ sides, value, tone, size = 48, dim }: { sides: number; value: number | string; tone?: "crit" | "fumble"; size?: number; dim?: boolean }) {
  const points = SHAPES[sides] ?? SHAPES[20]!;
  return (
    <div className={cn("relative shrink-0", dim && "opacity-40")} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <polygon
          points={points}
          strokeLinejoin="round"
          strokeWidth={5}
          className={cn(tone === "crit" ? "fill-good/20 stroke-good" : tone === "fumble" ? "fill-bad/20 stroke-bad" : "fill-surface-3 stroke-accent/70")}
        />
        {sides === 20 && <polygon points="50,24 78,68 22,68" fill="none" strokeWidth={2} className="stroke-accent/30" />}
      </svg>
      <span
        className={cn("tnum absolute inset-0 flex items-center justify-center font-display", sides === 4 && "pt-[18%]", tone === "crit" ? "text-good" : tone === "fumble" ? "text-bad" : "text-ink")}
        style={{ fontSize: size * (String(value).length > 2 ? 0.3 : 0.38) }}
      >
        {value}
      </span>
    </div>
  );
}

const MAX_SHOWN = 4;

/** The dice of a roll, flickering through faces until `landsAt`, then showing what they rolled. */
export function Tumble({ result, landsAt }: { result: RollResult; landsAt: number }) {
  const dice = result.terms.flatMap((t) => (t.kind === "dice" ? t.dice.map((d) => ({ sides: t.sides, ...d })) : []));
  const shown = dice.slice(0, MAX_SHOWN);
  const [faces, setFaces] = useState(() => shown.map((d) => 1 + Math.floor(Math.random() * d.sides)));
  const rolling = landsAt > Date.now();
  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => setFaces(shown.map((d) => 1 + Math.floor(Math.random() * d.sides))), 60);
    return () => clearInterval(id);
    // shown is derived from result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, result]);
  const ms = Math.max(0, landsAt - Date.now()) / 1000;
  return (
    <div className="flex items-center gap-2">
      {shown.map((d, i) => (
        <motion.div
          key={i}
          initial={{ rotate: -120 - i * 40, y: -18, x: -20, scale: 0.7 }}
          animate={{ rotate: [null, 160, 330, 360], y: [null, 6, -4, 0], x: [null, 6, -2, 0], scale: [null, 1.05, 0.98, 1] }}
          transition={{ duration: ms || 0.2, delay: i * 0.04, ease: "easeOut", times: [0, 0.45, 0.8, 1] }}
        >
          <DieShape sides={d.sides} value={rolling ? faces[i]! : d.value} dim={!rolling && !d.kept} />
        </motion.div>
      ))}
      {dice.length > MAX_SHOWN && <span className="text-sm text-ink-3">+{dice.length - MAX_SHOWN}</span>}
    </div>
  );
}
