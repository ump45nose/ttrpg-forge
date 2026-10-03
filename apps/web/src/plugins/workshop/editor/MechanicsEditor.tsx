import { ABILITIES, GrantSchema, LANGUAGES_5E, type Ability, type ActionGrant, type Activation, type ChoiceGrant, type Grant, type LocalizedText, type ModifierGrant, type ProficiencyGrant, type ResourceGrant, type SpellGrant } from "@forge/core";
import { ChevronDown, Code2, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { useT } from "../../../app/i18n";
import { EntitySearch } from "../../../features/common/EntitySearch";
import { useNames } from "../../../features/common/names";
import { Button } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { Input } from "../../../ui/Field";
import { Tabs } from "../../../ui/Tabs";
import { spellLists } from "./contentTemplates";
import { Field, MultiPick, Select, TagList, toFormula, useLocale } from "./fields";
import { JsonEditor } from "./JsonEditor";
import { SoundField } from "../../../features/media/SoundField";
import { L, plain } from "./templates";

/**
 * Edits a list of grants: the building blocks of every rule (bonuses, proficiencies,
 * limited-use resources, actions, spells, tags and player choices). Common shapes get
 * a form; anything else is edited as JSON, so no mechanic is out of reach.
 */

const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 7)}`;
const LONG = [{ on: "long" as const, amount: "all" as const }];
const DAMAGE = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];

type Template = "modifier" | "proficiency" | "resource" | "action" | "spell" | "tag" | "choice-skill" | "choice-feat" | "choice-spell" | "choice-ability" | "json";
const TEMPLATES: Template[] = ["modifier", "proficiency", "resource", "action", "spell", "tag", "choice-skill", "choice-feat", "choice-spell", "choice-ability", "json"];

function fromTemplate(tpl: Template, ctx: MechanicsContext): Grant {
  switch (tpl) {
    case "modifier":
      return { type: "modifier", target: "ac", value: 1 };
    case "proficiency":
      return { type: "proficiency", kind: "skill", key: "athletics" };
    case "resource":
      return { type: "resource", id: rid("uses"), name: L("?"), max: 1, recovery: LONG };
    case "action":
      return { type: "action", action: { id: rid("act"), name: L("?"), activation: "action", category: "feature" } };
    case "spell":
      return { type: "spell", spell: "", alwaysPrepared: true };
    case "tag":
      return { type: "tag", tag: "resist:fire" };
    case "choice-skill":
      return { type: "choice", id: rid("skills"), name: { en: "Skills", zh: "技能" }, count: 1, from: { kind: "proficiency", profKind: "skill", keys: "any" } };
    case "choice-feat":
      return { type: "choice", id: rid("feat"), name: { en: "Feat", zh: "专长" }, count: 1, from: { kind: "entity", entityType: "feat", tags: ["general"] } };
    case "choice-spell":
      return { type: "choice", id: rid("spells"), name: { en: "Spells", zh: "法术" }, count: 1, from: { kind: "entity", entityType: "spell", tags: [ctx.spellList ?? "wizard"], minLevel: 0, maxLevel: 0 } };
    case "choice-ability":
      return { type: "choice", id: rid("ability"), name: { en: "Ability Score Increase", zh: "属性值提升" }, count: 1, from: { kind: "ability", abilities: [...ABILITIES], patterns: [[1]], cap: 20 } };
    case "json":
      return { type: "tag", tag: "my-flag" };
  }
}

export interface MechanicsContext {
  /** Slug of the class being edited, for level formulas. */
  classSlug?: string;
  /** Default spell list for spell choices. */
  spellList?: string;
}

export function MechanicsEditor({ grants, onChange, ctx = {}, emptyHint }: { grants: Grant[]; onChange: (g: Grant[]) => void; ctx?: MechanicsContext; emptyHint?: ReactNode }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const resources = grants.flatMap((g) => (g.type === "resource" ? [g] : []));
  const set = (i: number, g: Grant) => onChange(grants.map((x, j) => (j === i ? g : x)));

  return (
    <div className="space-y-1.5">
      {!grants.length && emptyHint && <p className="text-xs text-ink-3">{emptyHint}</p>}
      {grants.map((g, i) => (
        <GrantRow
          key={i}
          g={g}
          open={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
          onChange={(x) => set(i, x)}
          onRemove={() => {
            setOpen(null);
            onChange(grants.filter((_, j) => j !== i));
          }}
          resources={resources}
          ctx={ctx}
        />
      ))}
      <AnimatePresence initial={false}>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-dashed border-line-strong p-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => {
                    onChange([...grants, fromTemplate(tpl, ctx)]);
                    setOpen(grants.length);
                    setAdding(false);
                  }}
                  className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink-2 hover:border-accent hover:text-ink"
                >
                  {t(`workshop.tpl.${tpl}`)}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
        <Plus size={14} /> {t("workshop.addMechanic")}
      </Button>
    </div>
  );
}

function GrantRow({ g, open, onToggle, onChange, onRemove, resources, ctx }: { g: Grant; open: boolean; onToggle: () => void; onChange: (g: Grant) => void; onRemove: () => void; resources: ResourceGrant[]; ctx: MechanicsContext }) {
  const t = useT();
  const [json, setJson] = useState(false);
  const summary = useGrantSummary()(g);
  const hasForm = formFor(g) !== null;
  return (
    <div className={cn("rounded-xl border bg-surface/50 transition-colors", open ? "border-line-strong" : "border-line")}>
      <div className="flex items-center gap-2 py-1.5 pr-1 pl-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-3">{t(`workshop.grant.${g.type}`)}</span>
          <span className="truncate text-sm text-ink">{summary}</span>
          <ChevronDown size={14} className={cn("ml-auto shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
        </button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={onRemove}>
          <Trash2 size={14} />
        </Button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-line px-3 pt-3 pb-3">
          {hasForm && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setJson(!json)} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
                <Code2 size={13} /> {json ? t("homebrew.formTab") : "JSON"}
              </button>
            </div>
          )}
          {!hasForm || json ? <JsonEditor value={g} validate={parseGrant} onValid={onChange} rows={8} /> : <GrantForm g={g} onChange={onChange} resources={resources} ctx={ctx} />}
        </div>
      )}
    </div>
  );
}

const parseGrant = (v: unknown) => {
  const r = GrantSchema.safeParse(v);
  return r.success ? ({ ok: true, value: r.data } as const) : ({ ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) } as const);
};

/** Which grants have a structured form (null → JSON only). */
function formFor(g: Grant): string | null {
  if (g.type === "choice") {
    const f = g.from;
    if (f.kind === "proficiency" || f.kind === "ability") return "choice";
    if (f.kind === "entity" && (f.entityType === "feat" || f.entityType === "spell")) return "choice";
    return null;
  }
  return ["modifier", "proficiency", "resource", "action", "spell", "tag", "feature"].includes(g.type) ? g.type : null;
}

function GrantForm({ g, onChange, resources, ctx }: { g: Grant; onChange: (g: Grant) => void; resources: ResourceGrant[]; ctx: MechanicsContext }) {
  switch (g.type) {
    case "modifier":
      return <ModifierForm g={g} onChange={onChange} ctx={ctx} />;
    case "proficiency":
      return <ProficiencyForm g={g} onChange={onChange} />;
    case "resource":
      return <ResourceForm g={g} onChange={onChange} />;
    case "action":
      return <ActionForm g={g} onChange={onChange} resources={resources} />;
    case "spell":
      return <SpellGrantForm g={g} onChange={onChange} />;
    case "tag":
      return <TagForm tag={g.tag} onChange={(tag) => onChange({ ...g, tag })} />;
    case "choice":
      return <ChoiceForm g={g} onChange={onChange} />;
    case "feature":
      return <NestedFeatureForm g={g} onChange={onChange} ctx={ctx} />;
    default:
      return null;
  }
}

/* ───────────── summaries ───────────── */

export function useGrantSummary() {
  const n = useNames();
  const t = useT();
  return (g: Grant): string => {
    switch (g.type) {
      case "modifier": {
        const v = typeof g.value === "number" && g.value >= 0 && (g.op ?? "add") === "add" ? `+${g.value}` : String(g.value);
        return `${targetName(g.target, n, t)} ${g.op && g.op !== "add" ? `${t(`workshop.op.${g.op}`)} ` : ""}${v}${g.when ? ` · ${t("workshop.when")}` : ""}`;
      }
      case "proficiency":
        return `${n.profKind(g.kind)} · ${n.prof(g.kind, g.key)}${g.level === "expertise" ? ` (${t("prof.expertise")})` : ""}`;
      case "resource":
        return `${n.l(g.name, { mono: true })} × ${g.max}`;
      case "action":
        return `${n.activation(g.action.activation)} · ${n.l(g.action.name, { mono: true })}`;
      case "spell":
        return g.spell ? n.entity(g.spell, true) : "—";
      case "tag":
        return g.label ? n.l(g.label, { mono: true }) : g.tag;
      case "choice":
        return `${n.l(g.name, { mono: true })} × ${g.count}`;
      case "feature":
        return n.l(g.name, { mono: true });
      case "grant":
        return n.entity(g.entity, true);
      case "item":
        return `${n.entity(g.item, true)}${g.qty && g.qty > 1 ? ` ×${g.qty}` : ""}`;
      case "spellcasting":
        return `${n.ability(g.ability)} · ${g.progression}`;
    }
  };
}

/* ───────────── modifier ───────────── */

const TARGET_GROUPS = (skills: string[]) => [
  "ac",
  "hp.max",
  "initiative",
  "speed.walk",
  "speed.fly",
  "speed.swim",
  "speed.climb",
  "sense.darkvision",
  "attack.melee",
  "attack.ranged",
  "damage.melee",
  "damage.ranged",
  "spell.dc",
  "spell.attack",
  ...ABILITIES.map((a) => `ability.${a}.score`),
  ...ABILITIES.map((a) => `save.${a}`),
  ...skills.map((s) => `skill.${s}`),
];

function targetName(target: string, n: ReturnType<typeof useNames>, t: ReturnType<typeof useT>): string {
  const [head, key, tail] = target.split(".");
  if (head === "save" && key) return `${n.ability(key as Ability)}${t("workshop.target.saveSuffix")}`;
  if (head === "skill" && key) return n.prof("skill", key);
  if (head === "ability" && key && tail === "score") return n.ability(key as Ability);
  return t(`workshop.target.${target.replace(/\./g, "_")}`, { defaultValue: target });
}

function ModifierForm({ g, onChange, ctx }: { g: ModifierGrant; onChange: (g: Grant) => void; ctx: MechanicsContext }) {
  const t = useT();
  const n = useNames();
  const skills = useMemo(() => Object.keys(n.engine.reg.system.skills), [n.engine]);
  const targets = TARGET_GROUPS(skills);
  const custom = !targets.includes(g.target);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("workshop.target.label")}>
          <Select value={custom ? "__custom" : g.target} onChange={(v) => onChange({ ...g, target: v === "__custom" ? "" : v })} options={[...targets.map((x) => ({ id: x, label: targetName(x, n, t) })), { id: "__custom", label: t("workshop.custom") }]} />
        </Field>
        <Field label={t("workshop.value")} hint={t("workshop.formulaOk")}>
          <Input value={String(g.value)} onChange={(e) => onChange({ ...g, value: toFormula(e.target.value) })} placeholder="1 / @prof" />
        </Field>
      </div>
      {custom && <Input value={g.target} onChange={(e) => onChange({ ...g, target: e.target.value })} placeholder="passive.perception" />}
      <Tabs
        size="sm"
        items={(["add", "atLeast", "base", "override"] as const).map((op) => ({ id: op, label: t(`workshop.op.${op}`) }))}
        value={g.op ?? "add"}
        onChange={(op) => onChange({ ...g, op: op === "add" ? undefined : op })}
      />
      <Field label={t("workshop.when")} hint={t("common.optional")}>
        <Input value={g.when ?? ""} onChange={(e) => onChange({ ...g, when: e.target.value || undefined })} placeholder="!@equipped.armor" />
      </Field>
      <FormulaHint ctx={ctx} />
    </div>
  );
}

export function FormulaHint({ ctx }: { ctx?: MechanicsContext }) {
  const t = useT();
  return (
    <p className="text-[11px] leading-relaxed text-ink-3">
      {t("workshop.formulaHelp")} <code className="text-ink-2">@prof</code> <code className="text-ink-2">@ability.str.mod</code> <code className="text-ink-2">@level</code>{" "}
      {ctx?.classSlug && <code className="text-ink-2">@class.{ctx.classSlug}.level</code>} <code className="text-ink-2">max(1, …)</code> <code className="text-ink-2">table(@level, 2,2,3…)</code>
    </p>
  );
}

/* ───────────── proficiency ───────────── */

function useProfKeys(kind: ProficiencyGrant["kind"]): { id: string; label: string }[] | "search" | "text" {
  const n = useNames();
  if (kind === "save") return ABILITIES.map((a) => ({ id: a, label: n.ability(a) }));
  if (kind === "skill") return Object.keys(n.engine.reg.system.skills).map((k) => ({ id: k, label: n.prof("skill", k) }));
  if (kind === "armor") return ["light", "medium", "heavy", "shield"].map((k) => ({ id: k, label: n.prof("armor", k) }));
  if (kind === "weapon") return ["simple", "martial"].map((k) => ({ id: k, label: n.prof("weapon", k) }));
  if (kind === "language") return Object.keys(LANGUAGES_5E).map((k) => ({ id: k, label: n.prof("language", k) }));
  return "search";
}

function ProficiencyForm({ g, onChange }: { g: ProficiencyGrant; onChange: (g: Grant) => void }) {
  const t = useT();
  const n = useNames();
  const keys = useProfKeys(g.kind);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("workshop.kind")}>
          <Select
            value={g.kind}
            onChange={(kind) => onChange({ ...g, kind, key: kind === "save" ? "str" : kind === "armor" ? "light" : kind === "weapon" ? "simple" : kind === "skill" ? "athletics" : kind === "language" ? "common" : "" })}
            options={(["skill", "save", "armor", "weapon", "tool", "language"] as const).map((k) => ({ id: k, label: n.profKind(k) }))}
          />
        </Field>
        <Field label={t("prof.proficient")}>
          <Select value={g.level ?? "proficient"} onChange={(level) => onChange({ ...g, level: level === "proficient" ? undefined : level })} options={(["proficient", "expertise", "half"] as const).map((k) => ({ id: k, label: t(`prof.${k}`) }))} />
        </Field>
      </div>
      {Array.isArray(keys) ? (
        <Select value={g.key} onChange={(key) => onChange({ ...g, key })} options={keys} />
      ) : (
        <>
          {g.key && <TagList items={[{ id: g.key, label: n.entity(g.key) }]} onRemove={() => onChange({ ...g, key: "" })} />}
          <EntitySearch type="item" filter={(id) => n.engine.reg.getOf("item", id)?.itemType === "tool" || g.kind === "weapon"} onPick={(key) => onChange({ ...g, key })} />
        </>
      )}
    </div>
  );
}

/* ───────────── resource ───────────── */

const RECOVERY = {
  long: [{ on: "long", amount: "all" }],
  short: [
    { on: "short", amount: "all" },
    { on: "long", amount: "all" },
  ],
  shortOne: [
    { on: "short", amount: 1 },
    { on: "long", amount: "all" },
  ],
} as const satisfies Record<string, ResourceGrant["recovery"]>;
type RecoveryKey = keyof typeof RECOVERY;
const recoveryKey = (r: ResourceGrant["recovery"]): RecoveryKey => (r.some((x) => x.on === "short") ? (r.find((x) => x.on === "short")?.amount === "all" ? "short" : "shortOne") : "long");

/** Text input over a LocalizedText; empty → undefined (names fall back to "?" at the call site). */
export function LocalizedInput({ value, onChange, placeholder }: { value: LocalizedText | undefined; onChange: (v: LocalizedText | undefined) => void; placeholder?: string }) {
  const locale = useLocale();
  return <Input value={plain(value, locale)} placeholder={placeholder} onChange={(e) => onChange(e.target.value ? L(e.target.value) : undefined)} />;
}

function ResourceForm({ g, onChange }: { g: ResourceGrant; onChange: (g: Grant) => void }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Field label={t("homebrew.name")}>
        <LocalizedInput value={g.name} onChange={(name) => onChange({ ...g, name: name ?? L("?") })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("workshop.uses")} hint={t("workshop.formulaOk")}>
          <Input value={String(g.max)} onChange={(e) => onChange({ ...g, max: toFormula(e.target.value) })} placeholder="max(1, @ability.cha.mod)" />
        </Field>
        <Field label={t("workshop.recovery")}>
          <Select value={recoveryKey(g.recovery)} onChange={(k) => onChange({ ...g, recovery: RECOVERY[k].map((r) => ({ ...r })) })} options={(Object.keys(RECOVERY) as RecoveryKey[]).map((k) => ({ id: k, label: t(`workshop.rec.${k}`) }))} />
        </Field>
      </div>
      <p className="text-[11px] text-ink-3">
        id: <code>{g.id}</code> · {t("workshop.resourceHint")}
      </p>
    </div>
  );
}

/* ───────────── action ───────────── */

export function ActionForm({ g, onChange, resources, bare = false }: { g: ActionGrant; onChange: (g: Grant) => void; resources: ResourceGrant[]; bare?: boolean }) {
  const t = useT();
  const n = useNames();
  const a = g.action;
  const set = (p: Partial<typeof a>) => onChange({ ...g, action: { ...a, ...p } });
  const cost = a.cost?.find((c) => "resource" in c) as { resource: string; amount?: string | number } | undefined;
  const dmg = a.damage?.[0];
  return (
    <div className="space-y-3">
      <div className={bare ? "" : "grid grid-cols-[minmax(0,1fr)_auto] gap-2"}>
        {!bare && (
          <Field label={t("homebrew.name")}>
            <LocalizedInput value={a.name} onChange={(name) => set({ name: name ?? L("?") })} />
          </Field>
        )}
        <Field label={t("workshop.activation")}>
          <Select value={a.activation} onChange={(activation) => set({ activation })} options={(["action", "bonus", "reaction", "free", "special", "minute", "hour"] as Activation[]).map((x) => ({ id: x, label: n.activation(x) }))} />
        </Field>
      </div>
      <Field label={t("homebrew.description")} hint={t("common.optional")}>
        <LocalizedInput value={a.text} onChange={(text) => set({ text })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("workshop.cost")}>
          <Select
            value={cost?.resource ?? ""}
            onChange={(resource) => set({ cost: resource ? [{ resource }] : undefined })}
            options={[{ id: "", label: t("workshop.noCost") }, ...resources.map((r) => ({ id: r.id, label: n.l(r.name, { mono: true }) })), ...(cost && !resources.some((r) => r.id === cost.resource) ? [{ id: cost.resource, label: cost.resource }] : [])]}
          />
        </Field>
        <Field label={t("spell.range")} hint={t("common.optional")}>
          <LocalizedInput value={a.range} onChange={(range) => set({ range })} placeholder="30 ft" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("homebrew.damage")} hint={t("common.optional")}>
          <Input value={dmg?.dice ?? ""} placeholder="2d6 + @ability.str.mod" onChange={(e) => set({ damage: e.target.value ? [{ dice: e.target.value, type: dmg?.type ?? "force" }, ...(a.damage?.slice(1) ?? [])] : undefined })} />
        </Field>
        <Field label={t("homebrew.damageType")}>
          <Select value={dmg?.type ?? "force"} onChange={(type) => dmg && set({ damage: [{ ...dmg, type }, ...(a.damage?.slice(1) ?? [])] })} options={[...DAMAGE, "weapon"].map((d) => ({ id: d, label: n.damage(d) }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("workshop.save")} hint={t("common.optional")}>
          <Select value={a.save?.ability ?? ""} onChange={(ab) => set({ save: ab ? { ability: ab as Ability, dc: a.save?.dc ?? "8 + @prof + @ability.con.mod", onSave: a.save?.onSave ?? "half" } : undefined })} options={[{ id: "", label: "—" }, ...ABILITIES.map((x) => ({ id: x, label: n.ability(x) }))]} />
        </Field>
        {a.save && (
          <Field label="DC" hint={t("workshop.formulaOk")}>
            <Input value={String(a.save.dc)} onChange={(e) => set({ save: { ...a.save!, dc: toFormula(e.target.value) } })} />
          </Field>
        )}
      </div>
      <Field label={t("workshop.heal")} hint={t("common.optional")}>
        <Input value={a.heal?.dice ?? ""} placeholder="1d8 + @ability.wis.mod" onChange={(e) => set({ heal: e.target.value ? { dice: e.target.value } : undefined })} />
      </Field>
      <Field label={t("sound.actionSound")} hint={t("sound.actionSoundHint")}>
        <SoundField value={a.sound} onChange={(sound) => set({ sound })} title={t("sound.actionSound")} />
      </Field>
    </div>
  );
}

/* ───────────── spell grant ───────────── */

function SpellGrantForm({ g, onChange }: { g: SpellGrant; onChange: (g: Grant) => void }) {
  const t = useT();
  const n = useNames();
  return (
    <div className="space-y-3">
      {g.spell && <TagList items={[{ id: g.spell, label: n.entity(g.spell) }]} onRemove={() => onChange({ ...g, spell: "" })} />}
      {!g.spell && <EntitySearch type="spell" onPick={(spell) => onChange({ ...g, spell })} placeholder={t("workshop.searchSpell")} />}
      <div className="grid grid-cols-3 gap-2">
        <Field label={t("workshop.freeUses")} hint={t("homebrew.zeroNone")}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={g.free ? String(g.free.max) : "0"}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              onChange({ ...g, free: v > 0 ? { max: v, recovery: g.free?.recovery ?? LONG } : undefined });
            }}
          />
        </Field>
        <Field label={t("workshop.classLevel")} hint={t("common.optional")}>
          <Input type="number" inputMode="numeric" min={0} value={g.classLevel ?? ""} onChange={(e) => onChange({ ...g, classLevel: Number(e.target.value) || undefined })} />
        </Field>
        <Field label={t("workshop.charLevel")} hint={t("common.optional")}>
          <Input type="number" inputMode="numeric" min={0} value={g.minLevel ?? ""} onChange={(e) => onChange({ ...g, minLevel: Number(e.target.value) || undefined })} />
        </Field>
      </div>
      <MultiPick options={[{ id: "always", label: t("spell.always") }]} value={g.alwaysPrepared ? ["always"] : []} onChange={(v) => onChange({ ...g, alwaysPrepared: v.length ? true : undefined })} />
    </div>
  );
}

/* ───────────── tag ───────────── */

const TAG_SUGGEST = [...DAMAGE.map((d) => `resist:${d}`), ...DAMAGE.map((d) => `immune:${d}`), "immune:charmed", "immune:frightened", "immune:poisoned", "adv:save.wis", "adv:initiative", "attacks:2"];

function TagForm({ tag, onChange }: { tag: string; onChange: (t: string) => void }) {
  const t = useT();
  return (
    <Field label={t("workshop.tag")} hint={t("workshop.tagHint")}>
      <Input value={tag} list="ws-tag-suggest" onChange={(e) => onChange(e.target.value.trim())} />
      <datalist id="ws-tag-suggest">
        {TAG_SUGGEST.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  );
}

/* ───────────── choice ───────────── */

const PATTERNS: { id: string; v: number[][] }[] = [
  { id: "1", v: [[1]] },
  { id: "2|11", v: [[2], [1, 1]] },
  { id: "21|111", v: [[2, 1], [1, 1, 1]] },
];

function ChoiceForm({ g, onChange }: { g: ChoiceGrant; onChange: (g: Grant) => void }) {
  const t = useT();
  const n = useNames();
  const from = g.from;
  const setFrom = (p: Partial<typeof from>) => onChange({ ...g, from: { ...from, ...p } as ChoiceGrant["from"] });
  const lists = useMemo(() => spellLists(n.engine.reg), [n.engine]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <Field label={t("homebrew.name")}>
          <LocalizedInput value={g.name} onChange={(name) => onChange({ ...g, name: name ?? L("?") })} />
        </Field>
        <Field label={t("workshop.count")}>
          <Input value={String(g.count)} onChange={(e) => onChange({ ...g, count: toFormula(e.target.value) })} />
        </Field>
      </div>
      {from.kind === "proficiency" && (
        <>
          <Select value={from.profKind} onChange={(profKind) => setFrom({ profKind, keys: "any" })} options={(["skill", "tool", "language", "weapon", "armor", "save"] as const).map((k) => ({ id: k, label: n.profKind(k) }))} />
          {from.profKind === "skill" && (
            <Field label={t("workshop.fromList")} hint={t("workshop.emptyAny")}>
              <MultiPick options={Object.keys(n.engine.reg.system.skills).map((k) => ({ id: k, label: n.prof("skill", k) }))} value={from.keys === "any" ? [] : from.keys} onChange={(keys) => setFrom({ keys: keys.length ? keys : "any" })} />
            </Field>
          )}
          <MultiPick options={[{ id: "expertise", label: t("prof.expertise") }]} value={from.level === "expertise" ? ["expertise"] : []} onChange={(v) => setFrom({ level: v.length ? "expertise" : undefined, requireProficient: v.length ? true : undefined })} />
        </>
      )}
      {from.kind === "ability" && (
        <>
          <MultiPick options={ABILITIES.map((a) => ({ id: a, label: n.ability(a) }))} value={from.abilities} onChange={(abilities) => setFrom({ abilities: abilities as Ability[] })} />
          <Select value={PATTERNS.find((p) => JSON.stringify(p.v) === JSON.stringify(from.patterns))?.id ?? "1"} onChange={(id) => setFrom({ patterns: PATTERNS.find((p) => p.id === id)!.v })} options={PATTERNS.map((p) => ({ id: p.id, label: t(`workshop.pattern.${p.id.replace(/\|/g, "_")}`) }))} />
        </>
      )}
      {from.kind === "entity" && from.entityType === "feat" && (
        <Select value={from.tags?.[0] ?? "general"} onChange={(c) => setFrom({ tags: [c] })} options={(["origin", "general", "fighting-style", "epic-boon"] as const).map((c) => ({ id: c, label: t(`workshop.featCat.${c}`) }))} />
      )}
      {from.kind === "entity" && from.entityType === "spell" && (
        <>
          <Field label={t("workshop.spellList")}>
            <MultiPick options={lists.map((x) => ({ id: x.id, label: n.l(x.name, { mono: true }) }))} value={from.anyTags ?? from.tags ?? []} onChange={(ls) => setFrom(ls.length > 1 ? { anyTags: ls, tags: undefined } : { tags: ls, anyTags: undefined })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("workshop.minSpellLevel")}>
              <Input value={String(from.minLevel ?? 0)} onChange={(e) => setFrom({ minLevel: toFormula(e.target.value) })} />
            </Field>
            <Field label={t("workshop.maxSpellLevel")} hint={t("workshop.formulaOk")}>
              <Input value={String(from.maxLevel ?? 9)} onChange={(e) => setFrom({ maxLevel: toFormula(e.target.value) })} />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────── nested feature (inside options etc.) ───────────── */

function NestedFeatureForm({ g, onChange, ctx }: { g: Extract<Grant, { type: "feature" }>; onChange: (g: Grant) => void; ctx: MechanicsContext }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Field label={t("homebrew.name")}>
        <LocalizedInput value={g.name} onChange={(name) => onChange({ ...g, name: name ?? L("?") })} />
      </Field>
      <Field label={t("homebrew.description")}>
        <LocalizedInput value={g.text} onChange={(text) => onChange({ ...g, text })} />
      </Field>
      <MechanicsEditor grants={g.grants ?? []} onChange={(grants) => onChange({ ...g, grants })} ctx={ctx} />
    </div>
  );
}
