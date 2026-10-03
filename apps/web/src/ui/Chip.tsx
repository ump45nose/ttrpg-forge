import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "accent" | "good" | "bad" | "warn" | "info" | "magic" | "class";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface-3/70 text-ink-2 border-line",
  accent: "bg-accent/12 text-accent border-accent/30",
  good: "bg-good/12 text-good border-good/30",
  bad: "bg-bad/12 text-bad border-bad/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  info: "bg-info/12 text-info border-info/30",
  magic: "bg-magic/12 text-magic border-magic/30",
  class: "bg-class/15 text-class border-class/35",
};

export function Chip({ tone = "neutral", className, children, icon }: { tone?: Tone; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-4 whitespace-nowrap", TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
