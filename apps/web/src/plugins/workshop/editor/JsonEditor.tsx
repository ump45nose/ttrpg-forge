import { CircleCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "../../../app/i18n";
import { cn } from "../../../ui/cn";

/** JSON text editor with live validation; calls onValid only with values that parse and validate. */
export function JsonEditor<T>({ value, validate, onValid, rows = 18 }: { value: T; validate: (v: unknown) => { ok: true; value: T } | { ok: false; errors: string[] }; onValid: (v: T) => void; rows?: number }) {
  const t = useT();
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => setText(JSON.stringify(value, null, 2)), [value]);

  const onChange = (next: string) => {
    setText(next);
    let parsed: unknown;
    try {
      parsed = JSON.parse(next);
    } catch (e) {
      setErrors([(e as Error).message]);
      return;
    }
    const r = validate(parsed);
    if (r.ok) {
      setErrors([]);
      onValid(r.value);
    } else setErrors(r.errors);
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
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
