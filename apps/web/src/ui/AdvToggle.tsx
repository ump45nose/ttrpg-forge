import { useT } from "../app/i18n";
import { cn } from "./cn";

export type AdvMode = "dis" | "normal" | "adv";

/** Disadvantage / normal / advantage, in that order everywhere. */
export function AdvToggle({ mode, onChange, className }: { mode: AdvMode; onChange: (m: AdvMode) => void; className?: string }) {
  const t = useT();
  return (
    <div role="radiogroup" className={cn("flex gap-1.5", className)}>
      {(["dis", "normal", "adv"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className={cn(
            "h-8 flex-1 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
            mode === m ? (m === "adv" ? "border-good/50 bg-good/12 text-good" : m === "dis" ? "border-bad/50 bg-bad/12 text-bad" : "border-line-strong bg-surface-3 text-ink") : "border-line text-ink-3 hover:text-ink-2",
          )}
        >
          {m === "normal" ? t("dice.normal") : m === "adv" ? t("dice.advantage") : t("dice.disadvantage")}
        </button>
      ))}
    </div>
  );
}
