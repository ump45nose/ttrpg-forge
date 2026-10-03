import { localize, type Entity } from "@forge/core";
import { ART_REF, ArtImg } from "../../ui/Art";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, AudioLines, Backpack, BookA, Copy, Download, FileJson, GitBranch, Hammer, Medal, Package, Pencil, Plus, ScrollText, Search, Sparkles, Stamp, Swords, Trash2, Users, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ulid } from "ulid";
import { openCreator } from "../../app/creator";
import { useL, useT } from "../../app/i18n";
import { BASE_PACKS, LOCAL_PACK_ID, orderedPacks, useEngine, usePacks } from "../../app/packs";
import { useSettings } from "../../app/settings";
import { downloadJson, importPackFile } from "../../features/library/transfer";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Field";
import { toast } from "../../ui/Toast";
import { WORKSHOP_TYPES, type WorkshopType } from "./editor/factory";
import { PackEditor } from "./editor/PackEditor";
import { CueSounds } from "./CueSounds";

export const TYPE_ICON: Record<WorkshopType, LucideIcon> = {
  class: Swords,
  subclass: GitBranch,
  spell: Sparkles,
  feat: Medal,
  species: Users,
  background: ScrollText,
  item: Backpack,
  rule: BookA,
};

const baseIds = new Set(BASE_PACKS.flatMap((p) => p.entities.map((e) => e.id)));

interface Row {
  e: Entity;
  packId: string;
  packName: string;
}

export function WorkshopPage() {
  const t = useT();
  const l = useL();
  const navigate = useNavigate();
  const packs = usePacks();
  const [filter, setFilter] = useState<WorkshopType | "all">("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string>();

  const rows: Row[] = useMemo(
    () =>
      orderedPacks(packs.packs)
        .reverse()
        .flatMap((p) => p.pack.entities.filter((e) => (WORKSHOP_TYPES as readonly string[]).includes(e.type)).map((e) => ({ e, packId: p.id, packName: l(p.pack.name, { mono: true }) }))),
    [packs.packs, l],
  );
  const counts = useMemo(() => {
    const c: Partial<Record<WorkshopType | "all", number>> = { all: rows.length };
    for (const r of rows) c[r.e.type as WorkshopType] = (c[r.e.type as WorkshopType] ?? 0) + 1;
    return c;
  }, [rows]);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (filter === "all" || r.e.type === filter) && (!needle || `${localize(r.e.name, "zh")} ${localize(r.e.name, "en")} ${r.e.id}`.toLowerCase().includes(needle)));

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-24 sm:px-6">
      <header className="safe-t sticky top-0 z-10 -mx-4 flex items-center gap-2 px-4 pt-4 pb-3 glass sm:-mx-6 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => (history.length > 1 ? history.back() : navigate({ to: "/" }))} aria-label={t("common.back")}>
          <ArrowLeft size={20} />
        </Button>
        <Hammer size={20} className="text-accent" />
        <h1 className="font-display text-xl">{t("workshop.title")}</h1>
      </header>
      <ArtImg id="scene:workshop" focus={[0.5, 0.5]} className="mt-2 h-36 rounded-2xl [mask-image:linear-gradient(to_bottom,black_60%,transparent)] sm:h-52" />
      <p className="mt-2 text-sm text-ink-2">{t("workshop.intro")}</p>

      {/* create */}
      <Section title={t("workshop.create")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORKSHOP_TYPES.map((type) => {
            const Icon = TYPE_ICON[type];
            return (
              <motion.button
                key={type}
                whileTap={{ scale: 0.97 }}
                onClick={() => openCreator({ type, mode: "new" })}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface/60 p-3 text-left transition-colors hover:border-accent/60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors group-hover:border-accent/50 group-hover:text-accent">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-ink">{t(`workshop.type.${type}`)}</span>
                  <span className="block text-[11px] leading-snug text-ink-3">{t(`workshop.typeHint.${type}`)}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </Section>

      {/* my content */}
      <Section title={t("workshop.mine")} aside={<span className="text-xs text-ink-3">{rows.length}</span>}>
        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
          {(["all", ...WORKSHOP_TYPES] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn("inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors", filter === k ? "border-accent bg-accent/15 text-ink" : "border-line text-ink-2 hover:border-line-strong")}
            >
              {k === "all" ? t("workshop.all") : t(`workshop.type.${k}`)}
              {counts[k] ? <span className="tnum text-ink-3">{counts[k]}</span> : null}
            </button>
          ))}
        </div>
        {rows.length > 6 && (
          <div className="relative mb-3">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} className="pl-9" />
          </div>
        )}
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {shown.map((r) => (
              <ContentRow key={`${r.packId}/${r.e.id}`} r={r} />
            ))}
          </AnimatePresence>
          {!shown.length && <p className="py-6 text-center text-sm text-ink-3">{rows.length ? t("workshop.noMatch") : t("workshop.empty")}</p>}
        </div>
      </Section>

      {/* remix official content */}
      <Section title={t("workshop.remix")}>
        <p className="mb-3 text-xs text-ink-3">{t("workshop.remixHint")}</p>
        <RemixSearch />
      </Section>

      {/* sounds */}
      <Section title={t("sound.cues")} icon={<AudioLines size={15} />}>
        <CueSounds />
      </Section>

      {/* packs */}
      <Section title={t("workshop.packs")} icon={<Package size={15} />}>
        <PackList onEdit={setEditing} />
      </Section>
      <PackEditor stored={packs.packs.find((p) => p.id === editing)} onClose={() => setEditing(undefined)} />
    </div>
  );
}

function Section({ title, icon, aside, children }: { title: ReactNode; icon?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-ink-3 uppercase">
        {icon}
        {title}
        <span className="h-px flex-1 bg-line" />
        {aside}
      </h2>
      {children}
    </section>
  );
}

function ContentRow({ r }: { r: Row }) {
  const t = useT();
  const l = useL();
  const engine = useEngine();
  const removeIn = usePacks((s) => s.removeIn);
  const Icon = TYPE_ICON[r.e.type as WorkshopType] ?? Hammer;
  const overrides = baseIds.has(r.e.id);
  const parent = r.e.type === "subclass" ? engine.reg.get(r.e.classId) : undefined;
  return (
    <motion.div layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 py-2 pr-1.5 pl-3">
      <ArtImg
        id={r.e.art?.startsWith(ART_REF) ? r.e.art.slice(ART_REF.length) : undefined}
        src={r.e.art && !r.e.art.startsWith(ART_REF) ? r.e.art : undefined}
        size="sm"
        focus={[0.5, 0.3]}
        className="h-9 w-9 shrink-0 rounded-lg border border-line"
        fallback={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2" style={r.e.accent ? { color: r.e.accent, borderColor: `${r.e.accent}66` } : undefined}>
            <Icon size={17} />
          </span>
        }
      />
      <button className="min-w-0 flex-1 text-left" onClick={() => openCreator({ type: r.e.type, mode: "edit", base: r.e })}>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink">{l(r.e.name, { mono: true })}</span>
          {overrides && <Chip tone="warn">{t("workshop.overrides")}</Chip>}
        </span>
        <span className="block truncate text-xs text-ink-3">
          {t(`workshop.type.${r.e.type}`)}
          {parent && ` · ${l(parent.name, { mono: true })}`}
          {r.e.source && !overrides && ` · ${t("workshop.from", { name: l(engine.reg.get(r.e.source)?.name ?? r.e.source, { mono: true }) })}`} · {r.packName}
        </span>
      </button>
      <Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} onClick={() => openCreator({ type: r.e.type, mode: "edit", base: r.e })}>
        <Pencil size={15} />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t("homebrew.clone")} onClick={() => openCreator({ type: r.e.type, mode: "clone", base: r.e })}>
        <Copy size={15} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("common.delete")}
        onClick={() => {
          if (!confirm(t(overrides ? "workshop.restoreConfirm" : "homebrew.deleteConfirm", { name: l(r.e.name, { mono: true }) }))) return;
          void removeIn(r.packId, r.e.id);
        }}
      >
        <Trash2 size={15} />
      </Button>
    </motion.div>
  );
}

function RemixSearch() {
  const t = useT();
  const l = useL();
  const engine = useEngine();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (!q.trim()) return [];
    return engine.reg
      .search(q)
      .filter((e) => (WORKSHOP_TYPES as readonly string[]).includes(e.type) && baseIds.has(e.id))
      .slice(0, 12);
  }, [engine, q]);
  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("workshop.remixSearch")} className="pl-9" />
      </div>
      <div className="mt-2 space-y-1.5">
        {results.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface/50 py-1.5 pr-1.5 pl-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{l(e.name, { mono: true })}</span>
              <span className="block text-[11px] text-ink-3">{t(`workshop.type.${e.type}`)}</span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => openCreator({ type: e.type, mode: "clone", base: e })}>
              <Copy size={14} /> {t("workshop.asNew")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openCreator({ type: e.type, mode: "override", base: e })} title={t("workshop.overrideHint")}>
              <Stamp size={14} /> {t("workshop.override")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackList({ onEdit }: { onEdit: (id: string) => void }) {
  const t = useT();
  const l = useL();
  const locale = useSettings((s) => s.locale);
  const packs = usePacks();
  const fileRef = useRef<HTMLInputElement>(null);
  const mine = orderedPacks(packs.packs);
  return (
    <>
      <p className="mb-3 text-xs text-ink-3">{t("workshop.packsHint")}</p>
      <div className="space-y-1.5">
        {mine.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 py-2 pr-1.5 pl-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">
                {l(p.pack.name, { mono: true })}
                {p.id === LOCAL_PACK_ID && <span className="ml-1.5 text-[10px] text-ink-3">{t("workshop.defaultPack")}</span>}
              </div>
              <div className="truncate text-xs text-ink-3">
                {t("homebrew.entities", { n: p.pack.entities.length })}
                {p.pack.patches?.length ? ` · ${t("homebrew.patches", { n: p.pack.patches.length })}` : ""}
                {p.enabled ? "" : ` · ${t("workshop.disabled")}`}
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(p.id)} aria-label={t("common.edit")}>
              <Pencil size={15} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => downloadJson(p.pack, `${p.id.replace(/[:]/g, "-")}.json`)} aria-label={t("common.export")}>
              <Download size={15} />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            const id = `house:${ulid().toLowerCase()}`;
            await packs.save({ id, origin: "homebrew", enabled: true, updatedAt: Date.now(), pack: { id, version: "1", system: BASE_PACKS[0]!.system, name: { en: "House Rules", zh: "村规" }, entities: [], systemConfig: {}, patches: [] } });
            onEdit(id);
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
          toast({ content: `${localize(r.value.name, locale)} ✓`, tone: "good" });
        }}
      />
    </>
  );
}
