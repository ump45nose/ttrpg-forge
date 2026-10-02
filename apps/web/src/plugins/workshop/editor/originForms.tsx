import { ABILITIES, type ActionGrant, type BackgroundEntity, type Entity, type ItemEntity, type SpeciesEntity } from "@forge/core";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "../../../app/i18n";
import { useEngine } from "../../../app/packs";
import { useNames } from "../../../features/common/names";
import { Button } from "../../../ui/Button";
import { Input, Textarea } from "../../../ui/Field";
import { Tabs } from "../../../ui/Tabs";
import { Field, MultiPick, Select } from "./fields";
import { ActionForm, MechanicsEditor } from "./MechanicsEditor";
import { DAMAGE_TYPES, EntityTags, ExtraNote, KitEditor, NameFields, useForm, useSkillOptions } from "./shared";
import { backgroundToForm, formToBackground, formToItem, formToSpecies, itemToForm, MASTERIES, RARITIES, speciesToForm, WEAPON_PROPS, type BackgroundForm, type ItemForm, type SpeciesForm } from "./templates";

/* ---------------- background ---------------- */

export function BackgroundFormView({ e, locale, onChange }: { e: BackgroundEntity; locale: "en" | "zh"; onChange: (e: Entity) => void }) {
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

/* ---------------- species ---------------- */

export function SpeciesFormView({ e, locale, onChange }: { e: SpeciesEntity; locale: "en" | "zh"; onChange: (e: Entity) => void }) {
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
  const [f, set] = useForm<ItemForm>(() => itemToForm(e, locale), (x) => formToItem(x, e, locale), onChange);
  return (
    <div className="space-y-5">
      <Field label={t("homebrew.name")}>
        <Input value={f.name} onChange={(ev) => set({ name: ev.target.value })} />
      </Field>
      <Field label={t("homebrew.itemType")}>
        <Tabs size="sm" items={(["gear", "weapon", "armor", "tool"] as const).map((k) => ({ id: k, label: t(`itemType.${k}`) }))} value={f.itemType} onChange={(itemType) => set({ itemType })} />
      </Field>
      {f.itemType === "weapon" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Tabs size="sm" items={(["simple", "martial"] as const).map((k) => ({ id: k, label: n.prof("weapon", k) }))} value={f.weaponCategory} onChange={(weaponCategory) => set({ weaponCategory })} />
            <Tabs size="sm" items={(["melee", "ranged"] as const).map((k) => ({ id: k, label: t(`workshop.weaponKind.${k}`) }))} value={f.weaponKind} onChange={(weaponKind) => set({ weaponKind })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("homebrew.damage")}>
              <Input value={f.damage} onChange={(ev) => set({ damage: ev.target.value })} placeholder="1d8" />
            </Field>
            <Field label={t("homebrew.damageType")}>
              <Select value={f.damageType} onChange={(damageType) => set({ damageType })} options={DAMAGE_TYPES.map((d) => ({ id: d, label: n.damage(d) }))} />
            </Field>
          </div>
          <Field label={t("workshop.properties")}>
            <MultiPick options={WEAPON_PROPS.map((p) => ({ id: p, label: t(`workshop.prop.${p}`) }))} value={f.properties} onChange={(properties) => set({ properties })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("spell.range")} hint={t("common.optional")}>
              <Input value={f.range} placeholder="20/60" onChange={(ev) => set({ range: ev.target.value })} />
            </Field>
            {f.properties.includes("versatile") && (
              <Field label={t("workshop.prop.versatile")}>
                <Input value={f.versatile} placeholder="1d10" onChange={(ev) => set({ versatile: ev.target.value })} />
              </Field>
            )}
            <Field label={t("profKind.mastery")}>
              <Select value={f.mastery} onChange={(mastery) => set({ mastery })} options={[{ id: "", label: "—" }, ...MASTERIES.map((m) => ({ id: m, label: n.entity(`mastery:${m}`, true) || m }))]} />
            </Field>
          </div>
        </div>
      )}
      {f.itemType === "armor" && (
        <div className="space-y-3">
          <Tabs size="sm" items={(["light", "medium", "heavy", "shield"] as const).map((k) => ({ id: k, label: n.prof("armor", k) }))} value={f.armorCategory} onChange={(armorCategory) => set({ armorCategory, ac: armorCategory === "shield" ? 2 : f.ac })} />
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
      <UseEditor f={f} set={set} />
      <div className="space-y-3 rounded-2xl border border-magic/25 bg-magic/5 p-3">
        <div className="text-xs font-semibold tracking-wide text-magic uppercase">{t("workshop.magicItem")}</div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label={t("workshop.rarity")}>
            <Select value={f.rarity} onChange={(rarity) => set({ rarity })} options={[{ id: "", label: t("workshop.mundane") }, ...RARITIES.map((r) => ({ id: r, label: t(`workshop.rar.${r}`) }))]} />
          </Field>
          <MultiPick options={[{ id: "att", label: t("workshop.attunement") }]} value={f.attunement ? ["att"] : []} onChange={(v) => set({ attunement: v.length > 0 })} />
        </div>
        <Field label={t("workshop.whileEquipped")} hint={t("workshop.whileEquippedHint")}>
          <MechanicsEditor grants={f.grants} onChange={(grants) => set({ grants })} />
        </Field>
      </div>
    </div>
  );
}

/** Usable items: potions, bombs, scrolls of a homebrew kind. Shown with a "Use" button on the sheet. */
function UseEditor({ f, set }: { f: ItemForm; set: (p: Partial<ItemForm>) => void }) {
  const t = useT();
  const usable = !!f.use;
  const g: ActionGrant = { type: "action", action: { id: "use", name: f.name || "?", ...(f.use ?? { activation: "bonus" }) } };
  return (
    <div className="space-y-3 rounded-2xl border border-warn/25 bg-warn/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold tracking-wide text-warn uppercase">{t("workshop.useTitle")}</div>
        <MultiPick
          options={[
            { id: "use", label: t("workshop.usable") },
            { id: "consumable", label: t("workshop.consumable") },
          ]}
          value={[...(usable ? ["use"] : []), ...(f.consumable ? ["consumable"] : [])]}
          onChange={(v) => set({ use: v.includes("use") ? (f.use ?? { activation: "bonus" }) : undefined, consumable: v.includes("consumable") })}
        />
      </div>
      <p className="text-xs text-ink-3">{t("workshop.useHint")}</p>
      {usable && (
        <ActionForm
          bare
          g={g}
          resources={[]}
          onChange={(next) => {
            if (next.type !== "action") return;
            const { id: _id, name: _name, ...use } = next.action;
            set({ use });
          }}
        />
      )}
    </div>
  );
}
