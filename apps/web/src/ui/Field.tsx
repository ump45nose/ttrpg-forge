import { Switch as RSwitch } from "radix-ui";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent/60 focus:bg-surface-2",
        className,
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("min-h-28 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent/60", className)}
      {...rest}
    />
  );
});

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="text-xs font-semibold tracking-wide text-ink-2 uppercase">{children}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
      </div>
      <RSwitch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-7 w-12 shrink-0 rounded-full border border-line bg-surface-3 transition-colors data-[state=checked]:border-accent/50 data-[state=checked]:bg-accent"
      >
        <RSwitch.Thumb className="block h-5.5 w-5.5 translate-x-0.5 rounded-full bg-ink shadow transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-accent-ink" />
      </RSwitch.Root>
    </label>
  );
}
