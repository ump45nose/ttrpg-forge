import { Minus, Plus } from "lucide-react";

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-2 hover:border-line-strong">
        <Minus size={13} />
      </button>
      <span className="tnum w-7 text-center text-sm">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-2 hover:border-line-strong">
        <Plus size={13} />
      </button>
    </span>
  );
}
