import { ABILITIES, type CasterProgression, type ClassEntity, type Entity, type FeatEntity, type Formula, type RuleEntity, type SpellEntity, type SubclassEntity } from "@forge/core";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useT } from "../../../app/i18n";
import { useNames } from "../../../features/common/names";
import { Button } from "../../../ui/Button";
import { Input, Textarea } from "../../../ui/Field";
import { Tabs } from "../../../ui/Tabs";
import { classToForm, DEFAULT_ASI, defaultCaster, formToClass, formToSubclass, generatedSpellChoices, parseTable, PRESET_TABLES, slugOf, subclassToForm, tableFormula, type CasterForm, type ClassForm, type SubclassForm } from "./classTemplate";
import { CAST_TEXT, FEAT_CATEGORIES, featToForm, formToFeat, formToRule, formToSpell, ruleToForm, SCHOOLS, spellLists, spellToForm, TERM_CATEGORIES, type FeatForm, type RuleForm, type SpellForm } from "./contentTemplates";
import { Field, MultiPick, Select, toFormula } from "./fields";
import { LevelsEditor } from "./LevelsEditor";
import { FormulaHint, MechanicsEditor } from "./MechanicsEditor";
import { DAMAGE_TYPES, EntityTags, KitEditor, NameFields, useForm, useSkillOptions } from "./shared";

type Props<E> = { e: E; locale: "en" | "zh"; onChange: (e: Entity) => void };

const ACCENTS = ["#b91c1c", "#c2410c", "#ca8a04", "#15803d", "#0e7490", "#1d4ed8", "#6d28d9", "#be185d", "#57534e"];

function AccentPicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACCENTS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className="h-7 w-7 rounded-full border-2 transition-transform" style={{ background: c, borderColor: value === c ? "var(--ink)" : "transparent", transform: value === c ? "scale(1.1)" : undefined }} aria-label={c} />
      ))}
    </div>
  );
}

/* ───────────────────────── class ───────────────────────── */

type ClassTab = "basics" | "gear" | "magic" | "levels";

export function ClassFormView({ e, locale, onChange }: Props<ClassEntity>) {
  const t = useT();
  const n = useNames();
  const skills = useSkillOptions();
  const [tab, setTab] = useState<ClassTab>("basics");
  const [f, set] = useForm<ClassForm>(() => classToForm(e, locale), (x) => formToClass(x, e, locale), onChange);
  const slug = slugOf(f.id);
  const isTool = (id: string) => n.engine.reg.getOf("item", id)?.itemType === "tool";

  // what the form adds on its own, shown on the level timeline
  const generated = useMemo(() => {
    const g: Record<number, string[]> = {};
    const add = (l: number, s: string) => (g[l] ??= []).push(s);
    if (f.caster) add(f.caster.level, t("workshop.gen.spellcasting"));
    add(f.subclassLevel, t("workshop.gen.subclass"));
    for (const a of f.asi) add(a.level, t("workshop.gen.asi"));
    if (f.caster?.auto)
      for (const [l, gs] of Object.entries(generatedSpellChoices(slug, f.caster)))
        for (const c of gs) if (c.type === "choice") add(Number(l), `${n.l(c.name, { mono: true })} +${c.count}`);
    return g;
  }, [f.caster, f.subclassLevel, f.asi, slug, t, n]);

  return (
    <div className="space-y-5">
      <Tabs size="sm" items={(["basics", "gear", "magic", "levels"] as const).map((k) => ({ id: k, label: t(`workshop.classTab.${k}`) }))} value={tab} onChange={setTab} />
      {tab === "basics" && (
        <div className="space-y-5">
          <NameFields name={f.name} summary={f.summary} text={f.text} onChange={set} />
          <Field label={t("workshop.accent")}>
            <AccentPicker value={f.accent} onChange={(accent) => set({ accent })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("builder.hitDie")}>
              <Tabs size="sm" items={(["6", "8", "10", "12"] as const).map((d) => ({ id: d, label: `d${d}` }))} value={String(f.hitDie) as "8"} onChange={(d) => set({ hitDie: Number(d) })} />
            </Field>
            <Field label={t("workshop.subclassLevel")}>
              <Select value={String(f.subclassLevel)} onChange={(v) => set({ subclassLevel: Number(v) })} options={[1, 2, 3].map((l) => ({ id: String(l), label: t("common.levelN", { n: l }) }))} />
            </Field>
          </div>
          <Field label={t("builder.primary")}>
            <MultiPick options={ABILITIES.map((a) => ({ id: a, label: n.ability(a) }))} value={f.primary} onChange={(primary) => set({ primary })} max={2} />
          </Field>
          <Field label={t("workshop.asiLevels")} hint={t("workshop.asiHint")}>
            <MultiPick
              options={Array.from({ length: 19 }, (_, i) => i + 2).map((l) => ({ id: String(l), label: String(l) }))}
              value={f.asi.map((a) => String(a.level))}
              onChange={(ls) => set({ asi: ls.map(Number).sort((a, b) => a - b).map((level) => f.asi.find((a) => a.level === level) ?? { level, id: level === 4 ? "feat" : `feat-${level}` }) })}
            />
            {!f.asi.length && (
              <button type="button" className="mt-1 text-xs text-accent" onClick={() => set({ asi: DEFAULT_ASI.map((level) => ({ level, id: level === 4 ? "feat" : `feat-${level}` })) })}>
                {t("workshop.asiDefault")}
              </button>
            )}
          </Field>
          <Field label={t("workshop.maxLevel")} hint={t("workshop.maxLevelHint")}>
            <Input type="number" min={1} max={20} value={f.maxLevel} onChange={(ev) => set({ maxLevel: Math.min(20, Math.max(1, Number(ev.target.value) || 1)) })} />
          </Field>
        </div>
      )}

      {tab === "gear" && (
        <div className="space-y-5">
          <Field label={t("builder.saves")} hint={t("homebrew.usually", { n: 2 })}>
            <MultiPick options={ABILITIES.map((a) => ({ id: a, label: n.ability(a) }))} value={f.saves} onChange={(saves) => set({ saves })} />
          </Field>
          <Field label={t("profKind.armor")}>
            <MultiPick options={["light", "medium", "heavy", "shield"].map((k) => ({ id: k, label: n.prof("armor", k) }))} value={f.armor} onChange={(armor) => set({ armor })} />
          </Field>
          <Field label={t("profKind.weapon")}>
            <MultiPick options={["simple", "martial"].map((k) => ({ id: k, label: n.prof("weapon", k) }))} value={f.weapons.filter((w) => w === "simple" || w === "martial")} onChange={(w) => set({ weapons: [...w, ...f.weapons.filter((x) => x !== "simple" && x !== "martial")] })} />
          </Field>
          <Field label={t("profKind.tool")} hint={t("common.optional")}>
            <EntityTags ids={f.tools} type="item" filter={isTool} onChange={(tools) => set({ tools })} />
          </Field>
          <Field label={t("workshop.skillChoice")} hint={t("workshop.emptyAny")}>
            <div className="mb-2 flex items-center gap-2 text-sm text-ink-2">
              {t("workshop.chooseN")}
              <Input type="number" min={0} max={6} className="h-9 w-16" value={f.skillCount} onChange={(ev) => set({ skillCount: Math.max(0, Number(ev.target.value) || 0) })} />
            </div>
            <MultiPick options={skills} value={f.skills} onChange={(s) => set({ skills: s })} />
          </Field>
          <Field label={t("homebrew.kit")} hint={t("homebrew.kitHint")}>
            <MultiPick options={[{ id: "kit", label: t("workshop.offerKit") }]} value={f.hasKit ? ["kit"] : []} onChange={(v) => set({ hasKit: v.length > 0 })} />
            {f.hasKit && (
              <div className="mt-3 space-y-3">
                <KitEditor kit={f.kit} onChange={(kit) => set({ kit })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("homebrew.kitGold")}>
                    <Input type="number" min={0} value={f.kitGold} onChange={(ev) => set({ kitGold: Math.max(0, Number(ev.target.value) || 0) })} />
                  </Field>
                  <Field label={t("homebrew.altGold")}>
                    <Input type="number" min={0} value={f.altGold} onChange={(ev) => set({ altGold: Math.max(0, Number(ev.target.value) || 0) })} />
                  </Field>
                </div>
              </div>
            )}
          </Field>
          {f.startingExtra.length > 0 && (
            <Field label={t("workshop.startingExtra")}>
              <MechanicsEditor grants={f.startingExtra} onChange={(startingExtra) => set({ startingExtra })} />
            </Field>
          )}
        </div>
      )}

      {tab === "magic" && <CasterEditor slug={slug} caster={f.caster} onChange={(caster) => set({ caster })} />}

      {tab === "levels" && <LevelsEditor levels={f.levels} onChange={(levels) => set({ levels })} to={f.maxLevel} generated={generated} ctx={{ classSlug: slug, spellList: f.caster?.list }} />}
    </div>
  );
}

function CasterEditor({ slug, caster, onChange }: { slug: string; caster: CasterForm | null; onChange: (c: CasterForm | null) => void }) {
  const t = useT();
  const n = useNames();
  const lists = useMemo(() => spellLists(n.engine.reg), [n.engine]);
  const progression: CasterProgression | "none" = caster?.progression ?? "none";
  const set = (p: Partial<CasterForm>) => caster && onChange({ ...caster, ...p });
  return (
    <div className="space-y-5">
      <Field label={t("workshop.caster")}>
        <Select
          value={progression}
          onChange={(p) => onChange(p === "none" ? null : caster ? { ...caster, progression: p } : defaultCaster(slug, p))}
          options={(["none", "full", "half", "third", "pact"] as const).map((p) => ({ id: p, label: t(`workshop.prog.${p}`) }))}
        />
      </Field>
      {caster && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("workshop.castAbility")}>
              <Select value={caster.ability} onChange={(ability) => set({ ability })} options={ABILITIES.map((a) => ({ id: a, label: n.ability(a) }))} />
            </Field>
            <Field label={t("workshop.castFrom")}>
              <Select value={String(caster.level)} onChange={(v) => set({ level: Number(v) })} options={[1, 2, 3].map((l) => ({ id: String(l), label: t("common.levelN", { n: l }) }))} />
            </Field>
          </div>
          <Field label={t("workshop.castMode")} hint={t(`workshop.modeHint.${caster.mode}`)}>
            <Tabs size="sm" items={(["prepared", "known", "spellbook"] as const).map((m) => ({ id: m, label: t(`workshop.mode.${m}`) }))} value={caster.mode} onChange={(mode) => set({ mode })} />
          </Field>
          <Field label={t("workshop.spellList")} hint={t("workshop.spellListHint")}>
            <Select
              value={caster.list}
              onChange={(list) => set({ list })}
              options={[...(lists.some((l) => l.id === slug) ? [] : [{ id: slug, label: t("workshop.ownList") }]), ...lists.map((l) => ({ id: l.id, label: l.id === slug ? t("workshop.ownList") : n.l(l.name, { mono: true }) }))]}
            />
          </Field>
          <PerLevelTable label={t("workshop.cantripsTable")} slug={slug} value={caster.cantrips} onChange={(cantrips) => set({ cantrips })} presets={{ full: PRESET_TABLES.fullCantrips, none: PRESET_TABLES.none }} />
          <PerLevelTable
            label={caster.mode === "prepared" ? t("workshop.preparedTable") : t("workshop.knownTable")}
            slug={slug}
            value={caster.prepared}
            onChange={(prepared) => set({ prepared })}
            presets={{ full: PRESET_TABLES.fullPrepared, half: PRESET_TABLES.halfPrepared, third: PRESET_TABLES.thirdPrepared, pact: PRESET_TABLES.pactPrepared }}
          />
          <MultiPick options={[{ id: "auto", label: t("workshop.autoChoices") }]} value={caster.auto ? ["auto"] : []} onChange={(v) => set({ auto: v.length > 0 })} />
          <p className="text-xs text-ink-3">{t("workshop.autoChoicesHint")}</p>
        </>
      )}
    </div>
  );
}

function PerLevelTable({ label, slug, value, onChange, presets }: { label: string; slug: string; value: Formula | undefined; onChange: (v: Formula | undefined) => void; presets: Record<string, readonly number[]> }) {
  const t = useT();
  const vals = parseTable(value ?? 0, slug);
  return (
    <Field label={label}>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {Object.entries(presets).map(([k, v]) => (
          <button key={k} type="button" onClick={() => onChange(tableFormula(slug, [...v]))} className="h-7 rounded-lg border border-line px-2 text-xs text-ink-2 hover:border-accent hover:text-ink">
            {t(`workshop.preset.${k}`)}
          </button>
        ))}
      </div>
      {vals ? (
        <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
          {vals.map((v, i) => (
            <label key={i} className="flex flex-col items-center rounded-lg border border-line bg-surface/60 py-1">
              <span className="text-[10px] text-ink-3">{i + 1}</span>
              <input
                type="number"
                min={0}
                value={v}
                onChange={(ev) => onChange(tableFormula(slug, vals.map((x, j) => (j === i ? Math.max(0, Number(ev.target.value) || 0) : x))))}
                className="tnum w-full bg-transparent text-center text-sm text-ink outline-none"
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          <Input value={String(value ?? "")} onChange={(ev) => onChange(ev.target.value ? toFormula(ev.target.value) : undefined)} />
          <p className="text-[11px] text-ink-3">{t("workshop.customFormula")}</p>
        </div>
      )}
    </Field>
  );
}

/* ───────────────────────── subclass ───────────────────────── */

export function SubclassFormView({ e, locale, onChange }: Props<SubclassEntity>) {
  const t = useT();
  const n = useNames();
  const [f, set] = useForm<SubclassForm>(() => subclassToForm(e, locale), (x) => formToSubclass(x, e, locale), onChange);
  const classes = n.engine.reg.all("class");
  const parent = n.engine.reg.getOf("class", f.classId);
  const caster = parent && Object.values(parent.levels).flat().find((g) => g.type === "spellcasting");
  return (
    <div className="space-y-5">
      <Field label={t("workshop.parentClass")}>
        <Select value={f.classId} onChange={(classId) => set({ classId })} options={classes.map((c) => ({ id: c.id, label: n.l(c.name, { mono: true }) }))} />
      </Field>
      <NameFields name={f.name} summary={f.summary} text={f.text} onChange={set} />
      <Field label={t("workshop.accent")} hint={t("common.optional")}>
        <AccentPicker value={f.accent} onChange={(accent) => set({ accent })} />
      </Field>
      <Field label={t("workshop.classTab.levels")} hint={t("workshop.subclassLevelsHint", { n: parent?.subclassLevel ?? 3 })}>
        <LevelsEditor
          levels={f.levels}
          onChange={(levels) => set({ levels })}
          from={parent?.subclassLevel ?? 3}
          generated={f.levels[String(parent?.subclassLevel ?? 3)]?.length ? {} : { [parent?.subclassLevel ?? 3]: [t("workshop.gen.subclass")] }}
          ctx={{ classSlug: slugOf(f.classId), spellList: caster?.type === "spellcasting" ? caster.list : undefined }}
        />
      </Field>
      <FormulaHint ctx={{ classSlug: slugOf(f.classId) }} />
    </div>
  );
}

/* ───────────────────────── spell ───────────────────────── */

export function SpellFormView({ e, locale, onChange }: Props<SpellEntity>) {
  const t = useT();
  const n = useNames();
  const lists = useMemo(() => spellLists(n.engine.reg), [n.engine]);
  const [f, set] = useForm<SpellForm>(() => ({ ...spellToForm(e, locale), id: e.id }), (x) => formToSpell(x, e, locale), onChange);
  const extraLists = f.lists.filter((l) => !lists.some((x) => x.id === l));
  return (
    <div className="space-y-5">
      <NameFields name={f.name} summary={f.summary} text={f.text} onChange={set} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("workshop.spellLevel")}>
          <Select value={String(f.level)} onChange={(v) => set({ level: Number(v) })} options={Array.from({ length: 10 }, (_, i) => ({ id: String(i), label: i === 0 ? t("spell.cantrip") : t("spell.level", { n: i }) }))} />
        </Field>
        <Field label={t("workshop.school")}>
          <Select value={f.school} onChange={(school) => set({ school })} options={SCHOOLS.map((s) => ({ id: s, label: t(`workshop.schoolName.${s}`) }))} />
        </Field>
      </div>
      <Field label={t("workshop.spellLists")}>
        <MultiPick options={[...lists.map((l) => ({ id: l.id, label: n.l(l.name, { mono: true }) })), ...extraLists.map((l) => ({ id: l, label: l }))]} value={f.lists} onChange={(ls) => set({ lists: ls })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("spell.castingTime")}>
          <Select
            value={f.activation}
            onChange={(activation) => set({ activation, castingTime: CAST_TEXT[activation]?.[locale === "en" ? 0 : 1] ?? f.castingTime })}
            options={(["action", "bonus", "reaction", "minute", "hour", "special"] as const).map((a) => ({ id: a, label: n.activation(a) }))}
          />
        </Field>
        <Field label={t("workshop.castingText")}>
          <Input value={f.castingTime} onChange={(ev) => set({ castingTime: ev.target.value })} />
        </Field>
        <Field label={t("spell.range")}>
          <Input value={f.range} onChange={(ev) => set({ range: ev.target.value })} />
        </Field>
        <Field label={t("spell.duration")}>
          <Input value={f.duration} onChange={(ev) => set({ duration: ev.target.value })} />
        </Field>
      </div>
      <Field label={t("spell.components")}>
        <MultiPick
          options={[
            { id: "v", label: "V" },
            { id: "s", label: "S" },
            { id: "m", label: "M" },
            { id: "c", label: t("spell.concentration") },
            { id: "r", label: t("spell.ritual") },
          ]}
          value={[f.v && "v", f.s && "s", f.m && "m", f.concentration && "c", f.ritual && "r"].filter(Boolean) as string[]}
          onChange={(v) => set({ v: v.includes("v"), s: v.includes("s"), m: v.includes("m"), concentration: v.includes("c"), ritual: v.includes("r") })}
        />
        {f.m && <Input className="mt-2" value={f.material} placeholder={t("workshop.material")} onChange={(ev) => set({ material: ev.target.value })} />}
      </Field>
      <div className="space-y-3 rounded-2xl border border-magic/25 bg-magic/5 p-3">
        <div className="text-xs font-semibold tracking-wide text-magic uppercase">{t("workshop.spellMechanics")}</div>
        <Tabs size="sm" items={(["none", "attack", "save"] as const).map((r) => ({ id: r, label: t(`workshop.resolve.${r}`) }))} value={f.resolve} onChange={(resolve) => set({ resolve })} />
        {f.resolve === "save" && (
          <div className="grid grid-cols-2 gap-3">
            <Select value={f.saveAbility} onChange={(saveAbility) => set({ saveAbility })} options={ABILITIES.map((a) => ({ id: a, label: n.ability(a) }))} />
            <Select value={f.onSave} onChange={(onSave) => set({ onSave })} options={(["half", "none"] as const).map((o) => ({ id: o, label: t(`workshop.onSave.${o}`) }))} />
          </div>
        )}
        <Field label={t("homebrew.damage")}>
          <div className="space-y-2">
            {f.damage.map((d, i) => (
              <div key={i} className="flex gap-2">
                <Input value={d.dice} placeholder="2d6" onChange={(ev) => set({ damage: f.damage.map((x, j) => (j === i ? { ...x, dice: ev.target.value } : x)) })} />
                <Select className="max-w-36" value={d.type} onChange={(type) => set({ damage: f.damage.map((x, j) => (j === i ? { ...x, type } : x)) })} options={DAMAGE_TYPES.map((x) => ({ id: x, label: n.damage(x) }))} />
                <Button type="button" variant="ghost" size="icon" aria-label={t("common.remove")} onClick={() => set({ damage: f.damage.filter((_, j) => j !== i) })}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => set({ damage: [...f.damage, { dice: "", type: "fire" }] })}>
              <Plus size={14} /> {t("workshop.addDamage")}
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("workshop.heal")} hint={t("common.optional")}>
            <Input value={f.heal} placeholder="2d8 + @spellmod" onChange={(ev) => set({ heal: ev.target.value })} />
          </Field>
          {f.level > 0 ? (
            <Field label={t("workshop.upcast")} hint={t("common.optional")}>
              <Input value={f.upcastDamage} placeholder="1d6" onChange={(ev) => set({ upcastDamage: ev.target.value })} />
            </Field>
          ) : (
            <div className="flex items-end pb-1">
              <MultiPick options={[{ id: "s", label: t("workshop.cantripScaling") }]} value={f.cantripScaling ? ["s"] : []} onChange={(v) => set({ cantripScaling: v.length > 0 })} />
            </div>
          )}
        </div>
      </div>
      <Field label={t("workshop.higherLevels")} hint={t("common.optional")}>
        <Textarea rows={2} value={f.higherLevels} onChange={(ev) => set({ higherLevels: ev.target.value })} />
      </Field>
    </div>
  );
}

/* ───────────────────────── feat ───────────────────────── */

export function FeatFormView({ e, locale, onChange }: Props<FeatEntity>) {
  const t = useT();
  const n = useNames();
  const [f, set] = useForm<FeatForm>(() => ({ ...featToForm(e, locale), id: e.id }), (x) => formToFeat(x, e, locale), onChange);
  return (
    <div className="space-y-5">
      <NameFields name={f.name} summary={f.summary} text={f.text} onChange={set} />
      <Field label={t("workshop.featCategory")}>
        <Tabs size="sm" items={FEAT_CATEGORIES.map((c) => ({ id: c, label: t(`workshop.featCat.${c}`) }))} value={f.category} onChange={(category) => set({ category })} />
      </Field>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Field label={t("workshop.prereqLevel")}>
          <Input type="number" min={0} max={20} value={f.prereqLevel} onChange={(ev) => set({ prereqLevel: Math.max(0, Number(ev.target.value) || 0) })} />
        </Field>
        <Field label={t("workshop.prereqText")} hint={t("common.optional")}>
          <Input value={f.prereqText} placeholder={t("workshop.prereqTextPh")} onChange={(ev) => set({ prereqText: ev.target.value })} />
        </Field>
      </div>
      <Field label={t("workshop.prereqFormula")} hint={t("common.optional")}>
        <Input value={f.prereqFormula} placeholder="@ability.str.score >= 13" onChange={(ev) => set({ prereqFormula: ev.target.value })} />
      </Field>
      <MultiPick options={[{ id: "r", label: t("workshop.repeatable") }]} value={f.repeatable ? ["r"] : []} onChange={(v) => set({ repeatable: v.length > 0 })} />
      <Field label={t("workshop.featAsi")} hint={t("workshop.featAsiHint")}>
        <MultiPick options={ABILITIES.map((a) => ({ id: a, label: n.ability(a) }))} value={f.asi} onChange={(asi) => set({ asi })} />
      </Field>
      <Field label={t("workshop.mechanics")}>
        <MechanicsEditor grants={f.grants} onChange={(grants) => set({ grants })} emptyHint={t("workshop.mechanicsEmpty")} />
      </Field>
      <FormulaHint />
    </div>
  );
}

/* ───────────────────────── glossary term ───────────────────────── */

export function RuleFormView({ e, locale, onChange }: Props<RuleEntity>) {
  const t = useT();
  const [f, set] = useForm<RuleForm>(() => ({ ...ruleToForm(e, locale), id: e.id }), (x) => formToRule(x, e, locale), onChange);
  return (
    <div className="space-y-5">
      <Field label={t("homebrew.name")}>
        <Input value={f.name} onChange={(ev) => set({ name: ev.target.value })} />
      </Field>
      <Field label={t("workshop.aliases")} hint={t("workshop.aliasesHint")}>
        <Input value={f.aliases} onChange={(ev) => set({ aliases: ev.target.value })} />
      </Field>
      <Field label={t("workshop.termCategory")}>
        <Select value={f.category} onChange={(category) => set({ category })} options={TERM_CATEGORIES.map((c) => ({ id: c, label: t(`termCat.${c}`) }))} />
      </Field>
      <Field label={t("homebrew.description")} hint={t("homebrew.termHint", { ex: "{{rule:advantage}}" })}>
        <Textarea rows={6} value={f.text} onChange={(ev) => set({ text: ev.target.value })} />
      </Field>
    </div>
  );
}
