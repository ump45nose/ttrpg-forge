import type { Entity, EntityType } from "@forge/core";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useL, useT } from "../../app/i18n";
import { useEngine } from "../../app/packs";
import { Input } from "../../ui/Field";

/** Search-as-you-type picker over registry entities. */
export function EntitySearch({ type, filter, onPick, placeholder, meta }: { type: EntityType; filter?: (id: string) => boolean; onPick: (id: string) => void; placeholder?: string; meta?: (e: Entity) => string | undefined }) {
  const t = useT();
  const l = useL();
  const engine = useEngine();
  const [q, setQ] = useState("");
  const results = useMemo(() => (q.trim() ? engine.reg.search(q, type).filter((e) => !filter || filter(e.id)).slice(0, 8) : []), [engine, q, type, filter]);
  return (
    <div className="relative">
      <Search size={15} className="absolute top-3 left-3 text-ink-3" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? t("common.search")} className="pl-9" />
      {results.length > 0 && (
        <div className="mt-1 overflow-hidden rounded-xl border border-line bg-surface-2">
          {results.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                onPick(e.id);
                setQ("");
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-3"
            >
              <Plus size={14} className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{l(e.name)}</span>
                {/* tells two things with the same name apart better than an id would */}
                {e.summary && <span className="block truncate text-xs text-ink-3">{l(e.summary)}</span>}
              </span>
              {meta?.(e) && <span className="tnum shrink-0 text-xs text-ink-3">{meta(e)}</span>}
            </button>
          ))}
        </div>
      )}
      {q.trim() && !results.length && <p className="mt-1 px-3 py-2 text-xs text-ink-3">{t("common.noResults")}</p>}
    </div>
  );
}
