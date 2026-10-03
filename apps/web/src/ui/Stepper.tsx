import { Minus, Plus } from "lucide-react";
import { useT } from "../app/i18n";

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label={t("common.decrease")} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40">
        <Minus size={14} />
      </button>
      <span className="tnum w-7 text-center text-sm text-ink">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label={t("common.increase")} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
        <Plus size={14} />
      </button>
    </span>
  );
}
