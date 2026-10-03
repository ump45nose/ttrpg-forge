import { CircleCheck, TriangleAlert } from "lucide-react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { useT } from "../../../app/i18n";
import { cn } from "../../../ui/cn";

/** Text that doesn't parse or validate yet, kept so nothing the user typed is lost. */
export interface JsonDraft {
  text: string;
  errors: string[];
}

/**
 * Editors nested in a form (e.g. one grant as JSON) report here while their text is
 * invalid, so the enclosing editor can refuse to save the last valid version instead.
 */
export const JsonGuard = createContext<((id: string, invalid: boolean) => void) | null>(null);

/** JSON text editor with live validation; calls onValid only with values that parse and validate. */
export function JsonEditor<T>({
  value,
  validate,
  onValid,
  draft,
  onDraft,
  rows = 18,
}: {
  value: T;
  validate: (v: unknown) => { ok: true; value: T } | { ok: false; errors: string[] };
  onValid: (v: T) => void;
  /** Invalid text from an earlier visit, restored instead of `value`. */
  draft?: JsonDraft;
  /** The current invalid text, or null once it's valid again. */
  onDraft?: (d: JsonDraft | null) => void;
  rows?: number;
}) {
  const t = useT();
  const id = useId();
  const report = useContext(JsonGuard);
  const [text, setText] = useState(() => draft?.text ?? JSON.stringify(value, null, 2));
  const [errors, setErrors] = useState<string[]>(draft?.errors ?? []);
  // what this editor last handed out: when it comes back as `value`, the text is already right
  const emitted = useRef<string | undefined>(draft ? JSON.stringify(value) : undefined);

  useEffect(() => {
    const json = JSON.stringify(value);
    if (json === emitted.current) return;
    emitted.current = json;
    setText(JSON.stringify(value, null, 2));
    setErrors([]);
  }, [value]);
  useEffect(() => report?.(id, errors.length > 0), [report, id, errors.length]);
  useEffect(() => () => report?.(id, false), [report, id]);

  const onChange = (next: string) => {
    setText(next);
    let parsed: unknown;
    try {
      parsed = JSON.parse(next);
    } catch (e) {
      const errs = [(e as Error).message];
      setErrors(errs);
      onDraft?.({ text: next, errors: errs });
      return;
    }
    const r = validate(parsed);
    if (r.ok) {
      setErrors([]);
      onDraft?.(null);
      emitted.current = JSON.stringify(r.value);
      onValid(r.value);
    } else {
      setErrors(r.errors);
      onDraft?.({ text: next, errors: r.errors });
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        aria-invalid={errors.length > 0}
        className={cn("w-full rounded-xl border bg-bg/60 p-3 font-mono text-xs leading-relaxed text-ink outline-none", errors.length ? "border-bad/50" : "border-line focus:border-accent")}
      />
      {errors.length ? (
        <ul className="space-y-0.5 text-xs text-bad">
          {errors.slice(0, 5).map((e, i) => (
            <li key={i} className="flex gap-1.5">
              <TriangleAlert size={13} className="mt-px shrink-0" />
              {e}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-good">
          <CircleCheck size={13} /> {t("homebrew.valid")}
        </div>
      )}
    </div>
  );
}

/** Tracks invalid JSON in an editor: the draft of the main JSON tab plus any nested editors. */
export function useJsonGuard() {
  const [draft, setDraft] = useState<JsonDraft | null>(null);
  const [nested, setNested] = useState<ReadonlySet<string>>(new Set());
  const report = useRef((id: string, invalid: boolean) =>
    setNested((s) => {
      if (s.has(id) === invalid) return s;
      const next = new Set(s);
      if (invalid) next.add(id);
      else next.delete(id);
      return next;
    }),
  ).current;
  return { draft, setDraft, report, invalid: !!draft || nested.size > 0, reset: () => setDraft(null) };
}
