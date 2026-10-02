import type { LocalizedText } from "@forge/core";
import { Fragment, useMemo } from "react";
import { useL } from "../../app/i18n";
import { useSettings } from "../../app/settings";
import { cn } from "../../ui/cn";
import { useGlossary } from "./glossary";
import { Term } from "./Term";

/** Rules prose with linked terms. Line breaks become paragraphs. */
export function RichText({ text, selfId, className, inline = false }: { text: LocalizedText | undefined; selfId?: string; className?: string; inline?: boolean }) {
  const l = useL();
  const g = useGlossary();
  const auto = useSettings((s) => s.autoTerms);
  const str = l(text, { mono: true });
  const paras = useMemo(() => str.split(/\n+/).map((p) => g.tokenize(p, { auto, selfId })), [str, g, auto, selfId]);
  if (!str) return null;
  const render = (toks: (typeof paras)[number]) => toks.map((t, i) => (typeof t === "string" ? <Fragment key={i}>{t}</Fragment> : <Term key={i} id={t.id} label={t.label} />));
  if (inline || paras.length === 1) return <span className={className}>{render(paras[0]!)}</span>;
  return (
    <span className={cn("block space-y-1.5", className)}>
      {paras.map((p, i) => (
        <span key={i} className="block">
          {render(p)}
        </span>
      ))}
    </span>
  );
}
