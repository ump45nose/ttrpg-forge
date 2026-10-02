import { createContext, useContext, type ReactNode } from "react";
import { useL } from "../../app/i18n";
import { cn } from "../../ui/cn";
import { useMediaQuery } from "../../ui/hooks";
import { useGlossary } from "./glossary";
import { termHover, useTerms } from "./store";

/** Nesting depth: 0 in page content, n+1 inside tooltip n. */
export const TermDepth = createContext(0);

export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");

const TONE: Record<string, string> = {
  condition: "text-warn decoration-warn/50",
  spell: "text-magic decoration-magic/50",
  mastery: "text-class decoration-class/50",
  hazard: "text-bad decoration-bad/50",
};

/** A hoverable/tappable rules term. Renders its localized name unless children/label are given. */
export function Term({ id, label, children, className, plain = false }: { id: string; label?: string; children?: ReactNode; className?: string; plain?: boolean }) {
  const l = useL();
  const level = useContext(TermDepth);
  const g = useGlossary();
  const fine = useFinePointer();
  const term = g.get(id);
  if (!term) return <>{children ?? label ?? id}</>;
  const content = children ?? label ?? l(term.name, { mono: true });

  return (
    <span
      role="button"
      tabIndex={0}
      data-term={id}
      onMouseEnter={fine ? (e) => termHover.enter(level, id, e.currentTarget) : undefined}
      onMouseLeave={fine ? () => termHover.leave(level) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (fine) termHover.click(level, id, e.currentTarget);
        else useTerms.getState().push(id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          termHover.click(level, id, e.currentTarget);
        }
      }}
      className={cn(
        "cursor-help rounded-[3px] transition-colors outline-none focus-visible:bg-accent/15",
        !plain && "underline decoration-dotted decoration-1 underline-offset-[3px] hover:bg-accent/10",
        !plain && (TONE[term.category] ?? "text-info decoration-info/50"),
        className,
      )}
    >
      {content}
    </span>
  );
}
