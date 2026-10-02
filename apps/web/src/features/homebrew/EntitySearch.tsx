import type { EntityType } from "@forge/core";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useL, useT } from "../../app/i18n";
import { useEngine } from "../../app/packs";
import { Input } from "../../ui/Field";

/** Search-as-you-type picker over registry entities. */
export function EntitySearch({ type, filter, onPick, placeholder }: { type: EntityType; filter?: (id: string) => boolean; onPick: (id: string) => void; placeholder?: string }) {
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
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-3"
            >
              <Plus size={14} className="text-ink-3" />
              <span className="flex-1 truncate">{l(e.name)}</span>
              <span className="text-[10px] text-ink-3">{e.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
