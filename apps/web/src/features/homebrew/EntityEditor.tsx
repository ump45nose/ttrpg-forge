import { ABILITIES, EntitySchema, type BackgroundEntity, type Entity, type ItemEntity, type SpeciesEntity } from "@forge/core";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useL, useT } from "../../app/i18n";
import { useEngine, usePacks } from "../../app/packs";
import { Button } from "../../ui/Button";
import { Input, Textarea } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { Tabs } from "../../ui/Tabs";
import { toast } from "../../ui/Toast";
import { useNames } from "../common/names";
import { EntitySearch } from "./EntitySearch";
import { Field, MultiPick, TagList } from "./fields";
import { JsonEditor } from "./JsonEditor";
import {
  backgroundToForm,
  formToBackground,
  formToItem,
  formToSpecies,
  itemToForm,
  newLocalId,
  speciesToForm,
  type BackgroundForm,
  type ItemForm,
  type SpeciesForm,
} from "./templates";

export type EditableType = "background" | "species" | "item";

export interface EditRequest {
  type: EditableType;
  /** Entity to edit in place (local) or to clone (official). */
  base?: Entity;
  /** true: write back under a fresh local id. */
  clone?: boolean;
}

const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];

const parseEntity = (v: unknown) => {
  const r = EntitySchema.safeParse(v);
  return r.success ? ({ ok: true, value: r.data as Entity } as const) : ({ ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) } as const);
};

/** Structured editor for local homebrew content, with a raw JSON fallback. */
export function EntityEditor({ req, onClose, onSaved }: { req: EditRequest | null; onClose: () => void; onSaved?: (e: Entity) => void }) {
  const t = useT();
  const l = useL();
  const locale = l({ en: "en", zh: "zh" }) as "en" | "zh";
  const upsert = usePacks((s) => s.upsertLocal);
  const [tab, setTab] = useState<"form" | "json">("form");
  const [entity, setEntity] = useState<Entity | null>(null);

  useEffect(() => {
    setTab("form");
    if (!req) return setEntity(null);
    const fresh = (() => {
      const id = newLocalId(req.type);
      if (req.type === "background") return formToBackground({ ...backgroundToForm(req.base as BackgroundEntity | undefined, locale), id });
      if (req.type === "species") return formToSpecies({ ...speciesToForm(req.base as SpeciesEntity | undefined, locale), id });
      return formToItem({ ...itemToForm(req.base as ItemEntity | undefined, locale), id }, req.base as ItemEntity | undefined);
    })();
    if (req.base && !req.clone) setEntity(req.base);
    else if (req.base) {
      // clone: keep every field of the original, new id, mark the source
      const name = l(req.base.name, { mono: true });
      setEntity({ ...req.base, ...fresh, name: { en: `${name}*`, zh: `${name}*` }, source: req.base.id } as Entity);
    } else setEntity(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req || !entity) return <Sheet open={false} onOpenChange={onClose}>{null}</Sheet>;

  const save = async () => {
    if (l(entity.name, { mono: true }).trim() === "?") return toast({ content: t("homebrew.nameRequired"), tone: "bad" });
    const r = parseEntity(entity);
    if (!r.ok) return toast({ content: r.errors[0], tone: "bad" });
    await upsert(r.value);
    toast({ content: `${l(r.value.name, { mono: true })} ✓`, tone: "good" });
    onSaved?.(r.value);
    onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={req.base && !req.clone ? t("homebrew.editTitle", { type: t(`entity.${req.type}`) }) : t("homebrew.newTitle", { type: t(`entity.${req.type}`) })}
      description={req.clone && req.base ? t("homebrew.cloneOf", { name: l(req.base.name, { mono: true }) }) : t("homebrew.localHint")}
      width="lg"
      footer={
        <Button variant="primary" size="lg" className="w-full" onClick={save}>
          {t("common.save")}
        </Button>
      }
    >
      <Tabs className="mb-4" items={[{ id: "form", label: t("homebrew.formTab") }, { id: "json", label: t("homebrew.advancedTab") }]} value={tab} onChange={setTab} />
      {tab === "json" ? (
        <JsonEditor value={entity} validate={parseEntity} onValid={(e) => setEntity({ ...e, id: entity.id })} rows={22} />
      ) : entity.type === "background" ? (
        <BackgroundFormView e={entity} locale={locale} onChange={setEntity} />
      ) : entity.type === "species" ? (
        <SpeciesFormView e={entity} locale={locale} onChange={setEntity} />
      ) : entity.type === "item" ? (
        <ItemFormView e={entity} locale={locale} onChange={setEntity} />
      ) : null}
    </Sheet>
  );
}

/* ---------------- shared bits ---------------- */

/** Form state lives here (so half-filled rows survive); every edit is pushed out as an entity. */
function useForm<F>(init: () => F, toEntity: (f: F) => Entity, onChange: (e: Entity) => void) {
  const [f, setF] = useState(init);
  const set = (p: Partial<F>) => {
    const next = { ...f, ...p };
    setF(next);
    onChange(toEntity(next));
  };
  return [f, set] as const;
}

function useSkillOptions() {
  const n = useNames();
  return useMemo(() => Object.keys(n.engine.reg.system.skills).map((k) => ({ id: k, label: n.prof("skill", k) })), [n]);
}

function NameFields({ name, summary, text, onChange }: { name: string; summary: string; text: string; onChange: (p: { name?: string; summary?: string; text?: string }) => void }) {
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

function EntityTags({ ids, onChange, type, filter, placeholder }: { ids: string[]; onChange: (ids: string[]) => void; type: "feat" | "item" | "spell"; filter?: (id: string) => boolean; placeholder?: string }) {
  const n = useNames();
  return (
    <>
      <TagList items={ids.map((id) => ({ id, label: n.entity(id) }))} onRemove={(id) => onChange(ids.filter((x) => x !== id))} />
      <EntitySearch type={type} filter={(id) => !ids.includes(id) && (!filter || filter(id))} onPick={(id) => onChange([...ids, id])} placeholder={placeholder} />
    </>
  );
}

function ExtraNote({ count }: { count: number }) {
  const t = useT();
  if (!count) return null;
  return <p className="rounded-xl border border-line bg-surface-3/40 px-3 py-2 text-xs text-ink-3">{t("homebrew.extraKept", { n: count })}</p>;
}

/* ---------------- background ---------------- */

function BackgroundFormView({ e, locale, onChange }: { e: BackgroundEntity; locale: "en" | "zh"; onChange: (e: Entity) => void }) {
  const t = useT();
  const n = useNames();
  const engine = useEngine();
  const skills = useSkillOptions();
  const [f, set] = useForm<BackgroundForm>(() => backgroundToForm(e, locale), (x) => ({ ...formToBackground(x), source: e.source }), onChange);
  const isTool = (id: string) => engine.reg.getOf("item", id)?.itemType === "tool";

  return (
    <div className="space-y-5">
      <NameFields name={f.name} summary={f.summary} text={f.text} onChange={set} />
      <Field label={t("homebrew.bgAbilities")} hint={t("homebrew.bgAbilitiesHint")}>
        <MultiPick options={ABILITIES.map((a) => ({ id: a, label: n.ability(a) }))} value={f.abilities} onChange={(abilities) => set({ abilities })} max={3} />
      </Field>
      <Field label={t("homebrew.originFeat")}>
        <EntityTags ids={f.feat ? [f.feat] : []} type="feat" filter={(id) => engine.reg.getOf("feat", id)?.category === "origin"} onChange={(ids) => set({ feat: ids.at(-1) ?? "" })} />
      </Field>
      <Field label={t("profKind.skill")} hint={t("homebrew.usually", { n: 2 })}>
        <MultiPick options={skills} value={f.skills} onChange={(s) => set({ skills: s })} />
      </Field>
      <Field label={t("profKind.tool")} hint={t("homebrew.usually", { n: 1 })}>
        <EntityTags ids={f.tools} type="item" filter={isTool} onChange={(tools) => set({ tools })} />
      </Field>
      <Field label={t("homebrew.kit")} hint={t("homebrew.kitHint")}>
        <KitEditor kit={f.kit} onChange={(kit) => set({ kit })} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label={t("homebrew.kitGold")}>
            <Input type="number" inputMode="numeric" min={0} value={f.kitGold} onChange={(ev) => set({ kitGold: Math.max(0, Number(ev.target.value) || 0) })} />
          </Field>
          <Field label={t("homebrew.altGold")}>
            <Input type="number" inputMode="numeric" min={0} value={f.altGold} onChange={(ev) => set({ altGold: Math.max(0, Number(ev.target.value) || 0) })} />
          </Field>
        </div>
      </Field>
      <ExtraNote count={f.extra.length} />
    </div>
  );
}

function KitEditor({ kit, onChange }: { kit: { item: string; qty: number }[]; onChange: (k: { item: string; qty: number }[]) => void }) {
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

/* ---------------- species ---------------- */

function SpeciesFormView({ e, locale, onChange }: { e: SpeciesEntity; locale: "en" | "zh"; onChange: (e: Entity) => void }) {
  const t = useT();
  const n = useNames();
  const skills = useSkillOptions();
  const [f, set] = useForm<SpeciesForm>(() => speciesToForm(e, locale), (x) => ({ ...formToSpecies(x), source: e.source }), onChange);
  const setTrait = (i: number, p: Partial<SpeciesForm["traits"][number]>) => set({ traits: f.traits.map((tr, j) => (j === i ? { ...tr, ...p } : tr)) });

  return (
    <div className="space-y-5">
      <NameFields name={f.name} summary={f.summary} text={f.text} onChange={set} />
      <Field label={t("homebrew.size")} hint={t("homebrew.sizeHint")}>
        <MultiPick
          options={(["small", "medium", "large"] as const).map((s) => ({ id: s, label: t(`size.${s}`) }))}
          value={f.sizes}
          onChange={(sizes) => set({ sizes })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("sheet.speed")}>
          <Input type="number" inputMode="numeric" step={5} value={f.speed} onChange={(ev) => set({ speed: Number(ev.target.value) || 0 })} />
        </Field>
        <Field label={t("homebrew.darkvision")} hint={t("homebrew.zeroNone")}>
          <Input type="number" inputMode="numeric" step={30} value={f.darkvision} onChange={(ev) => set({ darkvision: Number(ev.target.value) || 0 })} />
        </Field>
      </div>
      <Field label={t("profKind.skill")} hint={t("common.optional")}>
        <MultiPick options={skills} value={f.skills} onChange={(s) => set({ skills: s })} />
      </Field>
      <Field label={t("homebrew.resistances")} hint={t("common.optional")}>
        <MultiPick options={DAMAGE_TYPES.map((d) => ({ id: d, label: n.damage(d) }))} value={f.resist} onChange={(resist) => set({ resist })} />
      </Field>
      <Field label={t("homebrew.innateSpells")} hint={t("common.optional")}>
        <EntityTags ids={f.spells} type="spell" onChange={(spells) => set({ spells })} />
      </Field>
      <Field label={t("homebrew.traits")}>
        <div className="space-y-2">
          {f.traits.map((tr, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-line bg-surface/50 p-3">
              <div className="flex gap-2">
                <Input value={tr.name} placeholder={t("homebrew.traitName")} onChange={(ev) => setTrait(i, { name: ev.target.value })} />
                <Button variant="ghost" size="sm" aria-label={t("common.remove")} onClick={() => set({ traits: f.traits.filter((_, j) => j !== i) })}>
                  <Trash2 size={15} />
                </Button>
              </div>
              <Textarea rows={2} value={tr.text} placeholder={t("homebrew.traitText")} onChange={(ev) => setTrait(i, { text: ev.target.value })} />
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => set({ traits: [...f.traits, { name: "", text: "" }] })}>
            <Plus size={14} /> {t("homebrew.addTrait")}
          </Button>
        </div>
      </Field>
      <ExtraNote count={f.extra.length} />
    </div>
  );
}

/* ---------------- item ---------------- */

export function ItemFormView({ e, locale, onChange }: { e: ItemEntity; locale: "en" | "zh"; onChange: (e: Entity) => void }) {
  const t = useT();
  const n = useNames();
  const [f, set] = useForm<ItemForm>(() => itemToForm(e, locale), (x) => formToItem(x, e), onChange);
  return (
    <div className="space-y-5">
      <Field label={t("homebrew.name")}>
        <Input value={f.name} onChange={(ev) => set({ name: ev.target.value })} />
      </Field>
      <Field label={t("homebrew.itemType")}>
        <Tabs
          size="sm"
          items={(["gear", "weapon", "armor", "tool"] as const).map((k) => ({ id: k, label: t(`itemType.${k}`) }))}
          value={f.itemType}
          onChange={(itemType) => set({ itemType })}
        />
      </Field>
      {f.itemType === "weapon" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("homebrew.damage")}>
            <Input value={f.damage} onChange={(ev) => set({ damage: ev.target.value })} placeholder="1d8" />
          </Field>
          <Field label={t("homebrew.damageType")}>
            <select value={f.damageType} onChange={(ev) => set({ damageType: ev.target.value })} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent">
              {DAMAGE_TYPES.map((d) => (
                <option key={d} value={d}>
                  {n.damage(d)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {f.itemType === "armor" && (
        <div className="space-y-3">
          <Tabs
            size="sm"
            items={(["light", "medium", "heavy", "shield"] as const).map((k) => ({ id: k, label: n.prof("armor", k) }))}
            value={f.armorCategory}
            onChange={(armorCategory) => set({ armorCategory, ac: armorCategory === "shield" ? 2 : f.ac })}
          />
          <Field label={f.armorCategory === "shield" ? t("homebrew.acBonus") : t("homebrew.baseAc")} hint={f.armorCategory === "light" ? t("homebrew.acLight") : f.armorCategory === "medium" ? t("homebrew.acMedium") : undefined}>
            <Input type="number" inputMode="numeric" value={f.ac} onChange={(ev) => set({ ac: Number(ev.target.value) || 0 })} />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("homebrew.weight")} hint="lb">
          <Input type="number" inputMode="decimal" min={0} step={0.5} value={f.weight} onChange={(ev) => set({ weight: Number(ev.target.value) || 0 })} />
        </Field>
        <Field label={t("homebrew.cost")}>
          <Input value={f.cost} placeholder="10 GP" onChange={(ev) => set({ cost: ev.target.value })} />
        </Field>
      </div>
      <Field label={t("homebrew.notes")} hint={t("common.optional")}>
        <Textarea rows={3} value={f.text} onChange={(ev) => set({ text: ev.target.value })} />
      </Field>
    </div>
  );
}
