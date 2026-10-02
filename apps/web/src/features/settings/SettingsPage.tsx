import { localize } from "@forge/core";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Download, FileJson, Package, Pencil, Plus, Puzzle, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { ulid } from "ulid";
import { useCharacters } from "../../app/characters";
import { host, useHostRevision } from "../../app/host";
import { useL, useT } from "../../app/i18n";
import { BASE_PACKS, LOCAL_PACK_ID, orderedPacks, useEngine, usePacks } from "../../app/packs";
import { useSettings } from "../../app/settings";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { cn } from "../../ui/cn";
import { Switch } from "../../ui/Field";
import { Tabs } from "../../ui/Tabs";
import { toast } from "../../ui/Toast";
import { PackEditor } from "../homebrew/PackEditor";
import { downloadJson, importPackFile } from "../library/transfer";

export function SettingsPage() {
  const t = useT();
  const l = useL();
  const s = useSettings();
  const navigate = useNavigate();
  useHostRevision();
  const themes = host.get("themes");
  const packs = usePacks();
  const fileRef = useRef<HTMLInputElement>(null);
  const characters = useCharacters((x) => x.byId);
  const engine = useEngine();
  const ordered = orderedPacks(packs.packs);
  const [editing, setEditing] = useState<string>();

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-24 sm:px-6">
      <header className="safe-t sticky top-0 z-10 -mx-4 flex items-center gap-2 px-4 pt-4 pb-3 glass sm:-mx-6 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label={t("common.back")}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="font-display text-xl">{t("settings.title")}</h1>
      </header>

      <Section title={t("settings.language")}>
        <Tabs
          items={[
            { id: "zh", label: "中文" },
            { id: "en", label: "English" },
          ]}
          value={s.locale}
          onChange={(v) => s.set({ locale: v })}
        />
        <Switch checked={s.bilingual} onChange={(v) => s.set({ bilingual: v })} label={t("settings.bilingual")} hint={t("settings.bilingualHint")} />
        <Switch checked={s.autoTerms} onChange={(v) => s.set({ autoTerms: v })} label={t("settings.autoTerms")} hint={t("settings.autoTermsHint")} />
      </Section>

      <Section title={t("settings.theme")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {themes.map((th) => {
            const active = th.id === s.theme;
            return (
              <motion.button
                key={th.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => s.set({ theme: th.id })}
                className={cn("relative overflow-hidden rounded-2xl border p-3 text-left transition-colors", active ? "border-accent" : "border-line hover:border-line-strong")}
                style={{ background: th.tokens["--bg"] }}
              >
                <div className="flex gap-1.5">
                  {(th.swatch ?? []).map((c, i) => (
                    <span key={i} className="h-6 w-6 rounded-full border border-white/10" style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-3 text-sm font-medium" style={{ color: th.tokens["--ink"] }}>
                  {l(th.name, { mono: true })}
                </div>
                {active && (
                  <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: th.tokens["--accent"], color: th.tokens["--accent-ink"] }}>
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
        <div className="mt-4">
          <div className="mb-2 text-sm text-ink-2">{t("settings.motion")}</div>
          <Tabs
            items={(["system", "full", "reduced"] as const).map((m) => ({ id: m, label: t(`settings.motionOpts.${m}`) }))}
            value={s.motion}
            onChange={(v) => s.set({ motion: v })}
          />
        </div>
      </Section>

      <Section title={t("dice.title")}>
        <Switch checked={s.physicalDice} onChange={(v) => s.set({ physicalDice: v })} label={t("settings.physicalDice")} hint={t("settings.physicalDiceHint")} />
        <Switch checked={s.haptics} onChange={(v) => s.set({ haptics: v })} label={t("settings.haptics")} />
      </Section>

      <Section title={t("settings.packs")} icon={<Package size={16} />}>
        <p className="mb-3 text-xs text-ink-3">{t("homebrew.orderHint")}</p>
        <div className="space-y-2">
          {BASE_PACKS.map((p) => (
            <Row
              key={p.id}
              title={l(p.name)}
              meta={`${p.id} · v${p.version} · ${p.license ?? ""}`}
              badge={
                <div className="flex items-center gap-1">
                  <Chip tone="accent">{t("settings.builtin")}</Chip>
                  <Button variant="ghost" size="icon-sm" onClick={() => downloadJson(p, `${p.id}.json`)} aria-label={t("common.export")}>
                    <Download size={15} />
                  </Button>
                </div>
              }
            />
          ))}
          {ordered.map((p, i) => {
            const st = engine.reg.statsOf(p.id);
            const isLocal = p.id === LOCAL_PACK_ID;
            const meta = [
              t("homebrew.entities", { n: p.pack.entities.length }),
              st?.overrides ? t("homebrew.overrides", { n: st.overrides }) : "",
              p.pack.patches?.length ? t("homebrew.patches", { n: p.pack.patches.length }) : "",
              st?.systemConfig ? t("homebrew.systemChanged") : "",
              st?.missingTargets.length ? t("homebrew.missing", { n: st.missingTargets.length }) : "",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Row
                key={p.id}
                title={l(p.pack.name)}
                meta={meta}
                badge={
                  <div className="flex items-center gap-0.5">
                    {!isLocal && (
                      <>
                        <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => void packs.move(p.id, -1)} aria-label="up">
                          <ChevronUp size={15} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" disabled={i >= ordered.length - (ordered.at(-1)?.id === LOCAL_PACK_ID ? 2 : 1)} onClick={() => void packs.move(p.id, 1)} aria-label="down">
                          <ChevronDown size={15} />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(p.id)} aria-label={t("common.edit")}>
                      <Pencil size={15} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => downloadJson(p.pack, `${p.id}.json`)} aria-label={t("common.export")}>
                      <Download size={15} />
                    </Button>
                    <Switch checked={p.enabled} onChange={(v) => void packs.save({ ...p, enabled: v })} label="" />
                    {!isLocal && (
                      <Button variant="ghost" size="icon-sm" onClick={() => void packs.remove(p.id)} aria-label={t("common.delete")}>
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const id = `house:${ulid().toLowerCase()}`;
              await packs.save({ id, origin: "homebrew", enabled: true, updatedAt: Date.now(), pack: { id, version: "1", system: BASE_PACKS[0]!.system, name: { en: "House Rules", zh: "村规" }, entities: [], systemConfig: {}, patches: [] } });
              setEditing(id);
            }}
          >
            <Plus size={16} /> {t("homebrew.newHouse")}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileJson size={16} /> {t("settings.importPack")}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const r = await importPackFile(f);
            if (!r.ok) return toast({ content: r.errors.slice(0, 3).join("; "), tone: "bad" }, 7000);
            await packs.save({ id: r.value.id, pack: r.value, enabled: true, origin: "import", updatedAt: Date.now() });
            toast({ content: `${localize(r.value.name, s.locale)} ✓`, tone: "good" });
          }}
        />
        <PackEditor stored={packs.packs.find((p) => p.id === editing)} onClose={() => setEditing(undefined)} />
      </Section>

      <Section title={t("settings.plugins")} icon={<Puzzle size={16} />}>
        <div className="space-y-2">
          {host.list().map(({ plugin, enabled }) => (
            <Row
              key={plugin.manifest.id}
              title={l(plugin.manifest.name)}
              meta={`${plugin.manifest.id} · v${plugin.manifest.version}`}
              badge={
                plugin.manifest.builtin && plugin.manifest.kind !== "presentation" ? (
                  <Chip tone="accent">{t("settings.builtin")}</Chip>
                ) : (
                  <Switch
                    checked={enabled}
                    onChange={(v) => {
                      if (v) host.enable(plugin.manifest.id);
                      else host.disable(plugin.manifest.id);
                      const disabled = new Set(s.disabledPlugins);
                      if (v) disabled.delete(plugin.manifest.id);
                      else disabled.add(plugin.manifest.id);
                      s.set({ disabledPlugins: [...disabled] });
                    }}
                    label=""
                  />
                )
              }
            />
          ))}
        </div>
      </Section>

      <Section title={t("settings.data")}>
        <p className="mb-3 text-sm text-ink-2">{t("settings.storageHint")}</p>
        <Button variant="outline" onClick={() => downloadJson({ characters: Object.values(characters), packs: packs.packs }, `forge-backup-${new Date().toISOString().slice(0, 10)}.json`)}>
          {t("settings.exportAll")}
        </Button>
      </Section>

      <Section title={t("settings.attribution")}>
        {BASE_PACKS.map((p) => (
          <p key={p.id} className="text-xs leading-relaxed text-ink-3">
            {l(p.attribution, { mono: true })}
          </p>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-ink-3 uppercase">
        {icon}
        {title}
      </h2>
      <div className="card p-4">{children}</div>
    </section>
  );
}

function Row({ title, meta, badge }: { title: ReactNode; meta?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{title}</div>
        {meta && <div className="truncate text-xs text-ink-3">{meta}</div>}
      </div>
      {badge}
    </div>
  );
}
