import type { Character } from "@forge/core";
import { useNavigate } from "@tanstack/react-router";
import { Download, MoreHorizontal, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { useMemo, useRef, useState } from "react";
import { useCharacters } from "../../app/characters";
import { useL, useT } from "../../app/i18n";
import { LOCAL_PACK_ID, useEngine, usePacks } from "../../app/packs";
import { useSettings } from "../../app/settings";
import { Slot } from "../../app/slot";
import { useBuildView } from "../../app/views";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { cn } from "../../ui/cn";
import { Crest } from "../../ui/Crest";
import { Input } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { toast } from "../../ui/Toast";
import { exportCharacter, importCharacterFile } from "./transfer";

export function Library() {
  const t = useT();
  const byId = useCharacters((s) => s.byId);
  const list = useMemo(() => Object.values(byId).sort((a, b) => b.updatedAt - a.updatedAt), [byId]);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const put = useCharacters((s) => s.put);

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-24 sm:px-6">
      <header className="safe-t flex items-center gap-3 pt-5 pb-2">
        <Wordmark />
        <div className="flex-1" />
        <Slot name="library.action" />
        <Button variant="ghost" size="icon" aria-label={t("library.importChar")} onClick={() => fileRef.current?.click()}>
          <Download size={19} />
        </Button>
        <Button variant="ghost" size="icon" aria-label={t("common.settings")} onClick={() => navigate({ to: "/settings" })}>
          <Settings2 size={20} />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const r = await importCharacterFile(f);
            if (r.ok) {
              // custom content travels with the character; keep any local version that already exists
              const local = usePacks.getState();
              const existing = new Set(local.packs.find((p) => p.id === LOCAL_PACK_ID)?.pack.entities.map((x) => x.id));
              for (const e of r.value.homebrew) if (!existing.has(e.id)) await local.upsertLocal(e);
              put(r.value.character);
              toast({ content: r.value.character.name, tone: "good" });
            } else toast({ content: r.errors.join("; "), tone: "bad" }, 6000);
          }}
        />
      </header>

      <section className="mt-6 mb-6 sm:mt-10">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{t("library.title")}</h1>
        <p className="mt-2 text-sm text-ink-2">{t("library.subtitle")}</p>
      </section>

      {list.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NewCard onClick={() => setCreating(true)} />
          <AnimatePresence initial={false}>
            {list.map((c, i) => (
              <CharacterCard key={c.id} c={c} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <CreateSheet open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function Wordmark() {
  const t = useT();
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icon.svg" alt="" className="h-9 w-9 rounded-[10px] shadow-card" />
      <div className="leading-none">
        <div className="font-display text-xl font-bold tracking-[0.18em] text-gold">FORGE</div>
        <div className="mt-1 text-[11px] tracking-wide text-ink-3">{t("app.tagline")}</div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden px-6 py-14 text-center sm:py-20">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative mx-auto mb-6 flex justify-center gap-[-8px]">
        {["class:fighter", "class:wizard", "class:cleric", "class:rogue"].map((id, i) => (
          <motion.div key={id} initial={{ opacity: 0, y: 16, rotate: (i - 1.5) * 8 }} animate={{ opacity: 1, y: 0, rotate: (i - 1.5) * 8 }} transition={{ delay: 0.08 * i, type: "spring", stiffness: 260, damping: 20 }} className="-mx-1.5">
            <Crest id={id} accent={["#b45309", "#4338ca", "#ca8a04", "#334155"][i]} size={64} />
          </motion.div>
        ))}
      </div>
      <h2 className="relative font-display text-2xl text-ink">{t("library.empty")}</h2>
      <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2">{t("library.emptyHint")}</p>
      <Button variant="primary" size="lg" className="relative mt-8" onClick={onCreate}>
        <Sparkles size={18} />
        {t("library.newCharacter")}
      </Button>
    </motion.div>
  );
}

function NewCard({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <motion.button
      layout
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group flex min-h-[148px] flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-accent/40 bg-accent/[0.04] text-accent transition-colors hover:border-accent hover:bg-accent/[0.08]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 transition-transform group-hover:rotate-90">
        <Plus size={22} />
      </span>
      <span className="font-medium">{t("library.newCharacter")}</span>
    </motion.button>
  );
}

function CharacterCard({ c, index }: { c: Character; index: number }) {
  const t = useT();
  const l = useL();
  const engine = useEngine();
  const view = useBuildView(c);
  const navigate = useNavigate();
  const remove = useCharacters((s) => s.remove);
  const locale = useSettings((s) => s.locale);
  if (!view) return null;
  const { sheet } = view;
  const cls = engine.reg.getOf("class", sheet.classes[0]?.id);
  const sub = sheet.classes[0]?.subclass ? engine.reg.get(sheet.classes[0].subclass) : undefined;
  const species = engine.reg.get(sheet.speciesId ?? "");
  const accent = cls?.accent ?? "#d6a85c";
  const pending = sheet.pendingCount;
  const incomplete = !cls || !sheet.speciesId || !sheet.backgroundId || pending > 0;
  const open = () => navigate(incomplete ? { to: "/c/$id/build", params: { id: c.id } } : { to: "/c/$id", params: { id: c.id } });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      className="card group relative cursor-pointer overflow-hidden"
      style={{ ["--class" as string]: accent }}
      onClick={open}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 transition-opacity group-hover:opacity-100" style={{ background: `radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, ${accent} 26%, transparent), transparent 60%)` }} />
      <div className="relative flex gap-4 p-4">
        <Crest id={cls?.id} accent={accent} size={64} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg text-ink">{c.name || t("library.unnamed")}</div>
          <div className="mt-0.5 truncate text-sm text-ink-2">
            {[sheet.level ? t("common.levelN", { n: sheet.level }) : null, species && l(species.name, { mono: true }), cls && l(cls.name, { mono: true })].filter(Boolean).join(" · ") || "—"}
          </div>
          {sub && <div className="mt-0.5 truncate text-xs text-class">{l(sub.name, { mono: true })}</div>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {incomplete ? (
              <Chip tone="warn">{pending > 0 ? t("library.pending", { n: pending }) : t("library.continue")}</Chip>
            ) : (
              <>
                <Chip>AC {sheet.ac}</Chip>
                <Chip tone="bad">HP {sheet.hpMax}</Chip>
              </>
            )}
            <span className="text-[11px] leading-5 text-ink-3">{relativeTime(c.updatedAt, locale)}</span>
          </div>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="-mt-1 -mr-1 h-8 w-8 shrink-0 rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label={t("common.more")}>
              <MoreHorizontal size={18} className="mx-auto" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-40 rounded-xl border border-line-strong bg-surface-2 p-1 shadow-float" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-surface-3" onSelect={() => navigate({ to: "/c/$id/build", params: { id: c.id } })}>
                {t("library.continue")}
              </DropdownMenu.Item>
              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-surface-3" onSelect={() => exportCharacter(c, engine)}>
                {t("common.export")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-bad outline-none data-[highlighted]:bg-bad/10"
                onSelect={() => {
                  if (confirm(t("library.deleteConfirm", { name: c.name || t("library.unnamed") }))) remove(c.id);
                }}
              >
                <Trash2 size={15} /> {t("common.delete")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </motion.div>
  );
}

const NAMES = {
  en: ["Lyra Emberfall", "Thorin Ashbeard", "Seraphine Vale", "Kael Duskwhisper", "Mira Thornwood", "Bram Ironsong", "Isolde Starfall", "Fen Quickfoot"],
  zh: ["莉拉·烬落", "索林·灰须", "瑟拉芬·谷影", "凯尔·暮语", "米拉·棘木", "布拉姆·铁歌", "伊索德·星陨", "芬·疾步"],
};

export function randomName(locale: "en" | "zh" = useSettings.getState().locale) {
  const list = NAMES[locale];
  return list[Math.floor(Math.random() * list.length)]!;
}

function CreateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const engine = useEngine();
  const put = useCharacters((s) => s.put);
  const navigate = useNavigate();
  const locale = useSettings((s) => s.locale);
  const [name, setName] = useState("");
  const [level, setLevel] = useState(3);
  const maxLevel = engine.reg.system.maxLevel;
  const create = () => {
    const c = engine.newCharacter(name.trim() || t("library.unnamed"), { level });
    put(c);
    onOpenChange(false);
    setName("");
    setLevel(3);
    void navigate({ to: "/c/$id/build", params: { id: c.id } });
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("library.newTitle")}
      width="sm"
      footer={
        <Button variant="primary" size="lg" className="w-full" onClick={create}>
          <Sparkles size={18} /> {t("library.create")}
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="flex gap-2 pt-1"
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("library.namePlaceholder")} />
        <Button type="button" variant="secondary" size="icon" className="h-11 w-11 shrink-0" aria-label="random" onClick={() => setName(randomName(locale))}>
          🎲
        </Button>
      </form>
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-ink-2">{t("library.startLevel")}</span>
          <span className="text-xs text-ink-3">{t("library.startLevelHint")}</span>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: Math.min(maxLevel, 20) }, (_, i) => i + 1).map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevel(lv)}
              className={cn(
                "tnum relative h-10 rounded-xl border font-display text-base transition-colors",
                lv === level ? "border-accent text-accent-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              {lv === level && <motion.span layoutId="start-level" className="absolute inset-0 rounded-[11px] bg-[linear-gradient(180deg,var(--accent-2),var(--accent))]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">{lv}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function relativeTime(ts: number, locale: string) {
  const diff = (ts - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "zh" ? "zh-CN" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
