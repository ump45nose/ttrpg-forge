import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef, type ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "class";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANT: Record<Variant, string> = {
  primary:
    "text-accent-ink bg-[linear-gradient(180deg,var(--accent-2),var(--accent))] shadow-[0_8px_24px_-10px_var(--accent)] hover:brightness-110",
  secondary: "bg-surface-3 text-ink hover:bg-[color-mix(in_oklab,var(--surface-3)_80%,var(--ink)_8%)] border border-line",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-3/60",
  outline: "border border-line-strong text-ink hover:border-accent hover:text-accent",
  danger: "bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25",
  class: "text-class-ink bg-[linear-gradient(180deg,color-mix(in_oklab,var(--class)_80%,white_20%),var(--class))] shadow-[0_8px_24px_-10px_var(--class)] hover:brightness-110",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", className, disabled, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      disabled={disabled}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-[background,color,filter,border-color,opacity] duration-150 disabled:opacity-40 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  );
});
