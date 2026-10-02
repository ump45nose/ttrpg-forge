import { EntitySchema, type Entity } from "@forge/core";
import { useMemo, useState } from "react";
import { useT } from "../../../app/i18n";
import { EntitySearch } from "../../../features/common/EntitySearch";
import { useNames } from "../../../features/common/names";
import { Input, Textarea } from "../../../ui/Field";
import { Stepper } from "../../../ui/Stepper";
import { Field, TagList } from "./fields";
import type { Kit } from "./templates";

export const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];

export const parseEntity = (v: unknown) => {
  const r = EntitySchema.safeParse(v);
  return r.success ? ({ ok: true, value: r.data as Entity } as const) : ({ ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) } as const);
};

/** Structured editor for local homebrew content, with a raw JSON fallback. */
/* ---------------- shared bits ---------------- */

/** Form state lives here (so half-filled rows survive); every edit is pushed out as an entity. */
export function useForm<F>(init: () => F, toEntity: (f: F) => Entity, onChange: (e: Entity) => void) {
  const [f, setF] = useState(init);
  const set = (p: Partial<F>) => {
    const next = { ...f, ...p };
    setF(next);
    onChange(toEntity(next));
  };
  return [f, set] as const;
}

export function useSkillOptions() {
  const n = useNames();
  return useMemo(() => Object.keys(n.engine.reg.system.skills).map((k) => ({ id: k, label: n.prof("skill", k) })), [n]);
}

export function NameFields({ name, summary, text, onChange }: { name: string; summary: string; text: string; onChange: (p: { name?: string; summary?: string; text?: string }) => void }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Field label={t("homebrew.name")}>
        <Input value={name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label={t("homebrew.summary")} hint={t("common.optional")}>
        <Input value={summary} onChange={(e) => onChange({ summary: e.target.value })} />
      </Field>
      <Field label={t("homebrew.description")} hint={t("homebrew.termHint", { ex: "{{rule:advantage}}" })}>
        <Textarea rows={3} value={text} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
    </div>
  );
}

export function EntityTags({ ids, onChange, type, filter, placeholder }: { ids: string[]; onChange: (ids: string[]) => void; type: "feat" | "item" | "spell" | "class"; filter?: (id: string) => boolean; placeholder?: string }) {
  const n = useNames();
  return (
    <>
      <TagList items={ids.map((id) => ({ id, label: n.entity(id) }))} onRemove={(id) => onChange(ids.filter((x) => x !== id))} />
      <EntitySearch type={type} filter={(id) => !ids.includes(id) && (!filter || filter(id))} onPick={(id) => onChange([...ids, id])} placeholder={placeholder} />
    </>
  );
}

export function ExtraNote({ count }: { count: number }) {
  const t = useT();
  if (!count) return null;
  return <p className="rounded-xl border border-line bg-surface-3/40 px-3 py-2 text-xs text-ink-3">{t("homebrew.extraKept", { n: count })}</p>;
}

export function KitEditor({ kit, onChange }: { kit: Kit[]; onChange: (k: Kit[]) => void }) {
  const n = useNames();
  const setQty = (i: number, qty: number) => onChange(qty <= 0 ? kit.filter((_, j) => j !== i) : kit.map((k, j) => (j === i ? { ...k, qty } : k)));
  return (
    <div className="space-y-2">
      {kit.map((k, i) => (
        <div key={k.item} className="flex items-center gap-2 rounded-xl border border-line bg-surface/50 px-3 py-1.5">
          <span className="flex-1 truncate text-sm">{n.entity(k.item)}</span>
          <Stepper value={k.qty} onChange={(q) => setQty(i, q)} />
        </div>
      ))}
      <EntitySearch type="item" filter={(id) => id !== "item:gp" && !kit.some((k) => k.item === id)} onPick={(item) => onChange([...kit, { item, qty: 1 }])} />
    </div>
  );
}

