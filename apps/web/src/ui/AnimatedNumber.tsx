import { animate, useMotionValue, useTransform, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { reducedMotion } from "../app/settings";

/** Number that rolls to its new value (HP, AC, ability scores). */
export function AnimatedNumber({ value, signed = false, className }: { value: number; signed?: boolean; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => {
    const n = Math.round(v);
    return signed && n >= 0 ? `+${n}` : String(n);
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reducedMotion()) {
      first.current = false;
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { type: "spring", stiffness: 140, damping: 22 });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
