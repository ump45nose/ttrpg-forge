import type { Entity } from "@forge/core";
import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CreateRequest } from "../../../app/creator";
import { useL, useT } from "../../../app/i18n";
import { LOCAL_PACK_ID, useEngine, usePacks } from "../../../app/packs";
import { Button } from "../../../ui/Button";
import { Sheet } from "../../../ui/Sheet";
import { Tabs } from "../../../ui/Tabs";
import { toast } from "../../../ui/Toast";
import { blankEntity, cloneEntity, isWorkshopType, overrideEntity } from "./factory";
import { Field, Select, useLocale } from "./fields";
import { JsonEditor, JsonGuard, useJsonGuard } from "./JsonEditor";
import { MediaFields } from "./MediaFields";
import { BackgroundFormView, ItemFormView, SpeciesFormView } from "./originForms";
import { ClassFormView, FeatFormView, RuleFormView, SpellFormView, SubclassFormView } from "./ruleForms";
import { parseEntity } from "./shared";
import { confirmDialog } from "../../../ui/Confirm";

/** Packs the user can write into: the built-in homebrew pack and house-rule packs made in the app. */
export function useWritablePacks() {
  const packs = usePacks((s) => s.packs);
  const local = packs.find((p) => p.id === LOCAL_PACK_ID);
  return [...(local ? [local] : []), ...packs.filter((p) => p.id !== LOCAL_PACK_ID && p.origin === "homebrew")];
}

const PICTURE_PLACEHOLDER = "[picture]";
const SOUND_PLACEHOLDER = "[sound]";

function initial(req: CreateRequest, locale: "en" | "zh"): Entity | null {
  if (!isWorkshopType(req.type)) return null;
  if (req.mode === "new" || !req.base) return blankEntity(req.type, req.preset, locale);
  if (req.mode === "clone") return cloneEntity(req.base);
  if (req.mode === "override") return overrideEntity(req.base);
  return req.base;
}

/** Structured editor for every Workshop type, with a raw JSON fallback. */
export function EntityEditor({ req, onClose }: { req: CreateRequest | null; onClose: () => void }) {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const engine = useEngine();
  const upsertIn = usePacks((s) => s.upsertIn);
  const writable = useWritablePacks();
  const [tab, setTab] = useState<"form" | "json">("form");
  // remount the form after JSON edits so it re-reads the entity
  const [formKey, setFormKey] = useState(0);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [target, setTarget] = useState(LOCAL_PACK_ID);
  // the typed forms rebuild the entity from their own fields, so media lives beside them
  const [media, setMedia] = useState<Pick<Entity, "art" | "sound">>({});
  // invalid JSON must never "save" the last valid version and close: keep the text, refuse to save
  const guard = useJsonGuard();

  // a picture is a long data URL: keep it out of the JSON text (the placeholder stands for "unchanged")
  const jsonValue = useMemo(
    () => (entity ? { ...entity, art: media.art && !media.art.startsWith("art:") ? PICTURE_PLACEHOLDER : media.art, sound: media.sound ? SOUND_PLACEHOLDER : undefined } : null),
    [entity, media],
  ) as Entity;

  useEffect(() => {
    setTab("form");
    setFormKey((k) => k + 1);
    guard.reset();
    const e = req ? initial(req, locale) : null;
    setEntity(e);
    setMedia({ art: e?.art, sound: e?.sound });
    const owner = req?.mode === "edit" && req.base ? engine.reg.packOf(req.base.id) : undefined;
    setTarget(owner && writable.some((p) => p.id === owner) ? owner : LOCAL_PACK_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req || !entity) return <Sheet open={false} onOpenChange={onClose}>{null}</Sheet>;

  const withMedia: Entity = { ...entity, ...media };
  const close = async () => {
    if (guard.invalid && !(await confirmDialog({ title: t("workshop.discardInvalid"), confirmLabel: t("workshop.discard"), tone: "danger" }))) return;
    onClose();
  };
  const save = async () => {
    if (guard.invalid) return toast({ content: t("workshop.fixJsonFirst"), tone: "bad" }, 6000);
    if (l(entity.name, { mono: true }).trim() === "?") return toast({ content: t("homebrew.nameRequired"), tone: "bad" });
    const r = parseEntity(withMedia);
    if (!r.ok) return toast({ content: r.errors[0], tone: "bad" }, 6000);
    await upsertIn(target, r.value);
    toast({ content: `${l(r.value.name, { mono: true })} ✓`, tone: "good" });
    req.onSaved?.(r.value);
    onClose();
  };

  const typeName = t(`entity.${req.type}`, { defaultValue: t(`workshop.type.${req.type}`) });
  const title = req.mode === "edit" ? t("homebrew.editTitle", { type: typeName }) : req.mode === "override" ? t("workshop.overrideTitle", { type: typeName }) : t("homebrew.newTitle", { type: typeName });
  const description =
    req.mode === "clone" && req.base
      ? t("workshop.cloneOf", { name: l(req.base.name, { mono: true }) })
      : req.mode === "override" && req.base
        ? t("workshop.overrideOf", { name: l(req.base.name, { mono: true }) })
        : t("workshop.savedTo");

  // editing the form means leaving the broken JSON behind
  const props = { e: entity as never, locale, onChange: (e: Entity) => (guard.setDraft(null), setEntity(e)) };
  const form =
    entity.type === "class" ? <ClassFormView {...props} />
    : entity.type === "subclass" ? <SubclassFormView {...props} />
    : entity.type === "spell" ? <SpellFormView {...props} />
    : entity.type === "feat" ? <FeatFormView {...props} />
    : entity.type === "rule" ? <RuleFormView {...props} />
    : entity.type === "background" ? <BackgroundFormView {...props} />
    : entity.type === "species" ? <SpeciesFormView {...props} />
    : entity.type === "item" ? <ItemFormView {...props} />
    : null;

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && close()}
      title={title}
      description={description}
      width="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {guard.invalid && (
            <p role="alert" className="flex w-full items-center gap-1.5 text-xs text-bad">
              <TriangleAlert size={13} className="shrink-0" /> {t("workshop.fixJsonFirst")}
            </p>
          )}
          {writable.length > 1 && (
            <div className="min-w-0 flex-1">
              <Select value={target} onChange={setTarget} options={writable.map((p) => ({ id: p.id, label: `${t("workshop.saveTo")} ${l(p.pack.name, { mono: true })}` }))} />
            </div>
          )}
          <Button variant="primary" size="lg" className={writable.length > 1 ? "shrink-0" : "w-full"} disabled={guard.invalid} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <JsonGuard.Provider value={guard.report}>
      <Tabs
        className="mb-4"
        items={[
          { id: "form", label: t("homebrew.formTab") },
          { id: "json", label: t("homebrew.advancedTab") },
        ]}
        value={tab}
        onChange={(v) => {
          if (v === "form") setFormKey((k) => k + 1);
          setTab(v);
        }}
      />
      {tab === "json" ? (
        <JsonEditor
          value={jsonValue}
          draft={guard.draft ?? undefined}
          onDraft={guard.setDraft}
          validate={parseEntity}
          onValid={(e) => {
            setEntity({ ...e, id: entity.id });
            setMedia((m) => ({ art: e.art === PICTURE_PLACEHOLDER ? m.art : e.art, sound: e.sound === SOUND_PLACEHOLDER ? m.sound : e.sound }));
          }}
          rows={22}
        />
      ) : (
        <div className="space-y-5">
          {guard.draft && (
            <div className="flex items-center gap-2 rounded-xl border border-bad/40 bg-bad/8 px-3 py-2 text-sm text-ink-2">
              <TriangleAlert size={15} className="shrink-0 text-bad" />
              <span className="min-w-0 flex-1">{t("workshop.jsonDraftKept")}</span>
              <Button size="sm" variant="secondary" onClick={() => setTab("json")}>
                {t("workshop.backToJson")}
              </Button>
            </div>
          )}
          <MediaFields
            type={entity.type}
            art={media.art}
            onArt={(art) => setMedia((m) => ({ ...m, art }))}
            sound={media.sound}
            onSound={(sound) => setMedia((m) => ({ ...m, sound }))} describe={[l(entity.name, { mono: true }), entity.summary && l(entity.summary, { mono: true })].filter((x) => x && x !== "?").join(" — ")} />
          <div key={formKey}>{form ?? <Field label="">{t("workshop.jsonOnly")}</Field>}</div>
        </div>
      )}
      </JsonGuard.Provider>
    </Sheet>
  );
}
