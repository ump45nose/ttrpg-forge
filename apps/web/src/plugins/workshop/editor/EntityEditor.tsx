import type { Entity } from "@forge/core";
import { useEffect, useState } from "react";
import type { CreateRequest } from "../../../app/creator";
import { useL, useT } from "../../../app/i18n";
import { LOCAL_PACK_ID, useEngine, usePacks } from "../../../app/packs";
import { Button } from "../../../ui/Button";
import { Sheet } from "../../../ui/Sheet";
import { Tabs } from "../../../ui/Tabs";
import { toast } from "../../../ui/Toast";
import { blankEntity, cloneEntity, isWorkshopType, overrideEntity } from "./factory";
import { Field, Select, useLocale } from "./fields";
import { JsonEditor } from "./JsonEditor";
import { BackgroundFormView, ItemFormView, SpeciesFormView } from "./originForms";
import { ClassFormView, FeatFormView, RuleFormView, SpellFormView, SubclassFormView } from "./ruleForms";
import { parseEntity } from "./shared";

/** Packs the user can write into: the built-in homebrew pack and house-rule packs made in the app. */
export function useWritablePacks() {
  const packs = usePacks((s) => s.packs);
  const local = packs.find((p) => p.id === LOCAL_PACK_ID);
  return [...(local ? [local] : []), ...packs.filter((p) => p.id !== LOCAL_PACK_ID && p.origin === "homebrew")];
}

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

  useEffect(() => {
    setTab("form");
    setFormKey((k) => k + 1);
    setEntity(req ? initial(req, locale) : null);
    const owner = req?.mode === "edit" && req.base ? engine.reg.packOf(req.base.id) : undefined;
    setTarget(owner && writable.some((p) => p.id === owner) ? owner : LOCAL_PACK_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req || !entity) return <Sheet open={false} onOpenChange={onClose}>{null}</Sheet>;

  const save = async () => {
    if (l(entity.name, { mono: true }).trim() === "?") return toast({ content: t("homebrew.nameRequired"), tone: "bad" });
    const r = parseEntity(entity);
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

  const props = { e: entity as never, locale, onChange: setEntity };
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
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={description}
      width="lg"
      footer={
        <div className="flex items-center gap-2">
          {writable.length > 1 && (
            <div className="min-w-0 flex-1">
              <Select value={target} onChange={setTarget} options={writable.map((p) => ({ id: p.id, label: `${t("workshop.saveTo")} ${l(p.pack.name, { mono: true })}` }))} />
            </div>
          )}
          <Button variant="primary" size="lg" className={writable.length > 1 ? "shrink-0" : "w-full"} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      }
    >
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
        <JsonEditor value={entity} validate={parseEntity} onValid={(e) => setEntity({ ...e, id: entity.id })} rows={22} />
      ) : (
        <div key={formKey}>{form ?? <Field label="">{t("workshop.jsonOnly")}</Field>}</div>
      )}
    </Sheet>
  );
}
