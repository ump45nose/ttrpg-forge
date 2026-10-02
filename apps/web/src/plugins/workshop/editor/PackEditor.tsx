import { DND5E_2024, parseRulePack, type RulePack, type SystemConfig } from "@forge/core";
import { useEffect, useState } from "react";
import { useL, useT } from "../../../app/i18n";
import type { StoredPack } from "../../../app/db";
import { useEngine, usePacks } from "../../../app/packs";
import { Button } from "../../../ui/Button";
import { Input, Label } from "../../../ui/Field";
import { Sheet } from "../../../ui/Sheet";
import { Tabs } from "../../../ui/Tabs";
import { toast } from "../../../ui/Toast";
import { JsonEditor } from "./JsonEditor";

/** Edit a user pack: common house-rule numbers as a form, anything else as JSON. */
export function PackEditor({ stored, onClose }: { stored: StoredPack | undefined; onClose: () => void }) {
  const t = useT();
  const l = useL();
  const save = usePacks((s) => s.save);
  const sys = useEngine().reg.system;
  const [tab, setTab] = useState<"rules" | "json">("rules");
  const [draft, setDraft] = useState<RulePack | undefined>(stored?.pack);
  useEffect(() => setDraft(stored?.pack), [stored]);
  if (!stored || !draft) return <Sheet open={false} onOpenChange={onClose}>{null}</Sheet>;

  const cfg = draft.systemConfig ?? {};
  const setCfg = (patch: SystemConfig) => setDraft({ ...draft, systemConfig: mergeConfig(cfg, patch) });
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={l(draft.name)}
      description={`${draft.id} · ${t("homebrew.entities", { n: draft.entities.length })} · ${t("homebrew.patches", { n: draft.patches?.length ?? 0 })}`}
      width="lg"
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={async () => {
            await save({ ...stored, pack: draft });
            toast({ content: t("common.save") + " ✓", tone: "good" });
            onClose();
          }}
        >
          {t("common.save")}
        </Button>
      }
    >
      <Tabs className="mb-4" items={[{ id: "rules", label: t("homebrew.rulesTab") }, { id: "json", label: "JSON" }]} value={tab} onChange={setTab} />
      {tab === "rules" ? (
        <div className="space-y-5">
          <div>
            <Label>{t("homebrew.packName")}</Label>
            <Input value={typeof draft.name === "string" ? draft.name : draft.name.zh ?? draft.name.en} onChange={(e) => setDraft({ ...draft, name: { en: e.target.value, zh: e.target.value } })} />
          </div>
          <p className="text-xs text-ink-3">{t("homebrew.rulesHint")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumField label={t("homebrew.maxLevel")} value={cfg.maxLevel} placeholder={sys.maxLevel} onChange={(v) => setCfg({ maxLevel: num(v) })} />
            <NumField label={t("homebrew.abilityCap")} value={cfg.abilityCap} placeholder={sys.abilityCap} onChange={(v) => setCfg({ abilityCap: num(v) })} />
            <NumField label={t("homebrew.pointBudget")} value={cfg.pointBuy?.budget} placeholder={DND5E_2024.pointBuy.budget} onChange={(v) => setCfg({ pointBuy: { budget: num(v) } })} />
            <NumField label={t("homebrew.pointMin")} value={cfg.pointBuy?.min} placeholder={DND5E_2024.pointBuy.min} onChange={(v) => setCfg({ pointBuy: { min: num(v) } })} />
            <NumField label={t("homebrew.pointMax")} value={cfg.pointBuy?.max} placeholder={DND5E_2024.pointBuy.max} onChange={(v) => setCfg({ pointBuy: { max: num(v) } })} />
          </div>
          <div>
            <Label>{t("homebrew.standardArray")}</Label>
            <Input
              placeholder={DND5E_2024.standardArray.join(", ")}
              defaultValue={cfg.standardArray?.join(", ") ?? ""}
              onBlur={(e) => {
                const arr = e.target.value.split(/[,，\s]+/).filter(Boolean).map(Number);
                setCfg({ standardArray: arr.length === 6 && arr.every(Number.isFinite) ? arr : undefined });
              }}
            />
          </div>
          <div>
            <Label>{t("homebrew.hpLevelUp")}</Label>
            <Tabs
              size="sm"
              items={[
                { id: "average", label: t("homebrew.hpAverage") },
                { id: "max", label: t("homebrew.hpMax") },
              ]}
              value={cfg.hp?.levelUp ?? "average"}
              onChange={(v) => setCfg({ hp: { levelUp: v } })}
            />
          </div>
        </div>
      ) : (
        <JsonEditor value={draft} validate={parseRulePack} onValid={setDraft} rows={22} />
      )}
    </Sheet>
  );
}

function NumField({ label, value, placeholder, onChange }: { label: string; value: number | undefined; placeholder: number; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" inputMode="numeric" value={value ?? ""} placeholder={String(placeholder)} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Like a deep merge, but `undefined` clears a field and empty objects disappear. */
function mergeConfig(base: Record<string, unknown>, patch: Record<string, unknown>): SystemConfig {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const merged = mergeConfig((out[k] as Record<string, unknown>) ?? {}, v as Record<string, unknown>);
      if (Object.keys(merged).length) out[k] = merged;
      else delete out[k];
    } else if (v === undefined || (typeof v === "number" && Number.isNaN(v))) delete out[k];
    else out[k] = v;
  }
  return out as SystemConfig;
}
