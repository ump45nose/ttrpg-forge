import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Redo2, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useCharacter } from "../../app/characters";
import { useT } from "../../app/i18n";
import { Slot } from "../../app/slot";
import { Button } from "../../ui/Button";
import { Crest } from "../../ui/Crest";
import { useIsDesktop } from "../../ui/hooks";
import { Tabs } from "../../ui/Tabs";
import { useNames } from "../common/names";
import { ActionsPanel } from "./ActionsPanel";
import { CombatBar } from "./CombatBar";
import { InventoryPanel } from "./InventoryPanel";
import { LogPanel } from "./LogPanel";
import { PlayProvider, usePlay } from "./play";
import { ResourcesPanel } from "./ResourcesPanel";
import { StatsPanel } from "./StatsPanel";
import { Vitals } from "./Vitals";

export function SheetPage() {
  const { id } = useParams({ from: "/c/$id" });
  const character = useCharacter(id);
  const navigate = useNavigate();
  useEffect(() => {
    if (!character) void navigate({ to: "/" });
  }, [character, navigate]);
  if (!character) return null;
  return (
    <PlayProvider character={character}>
      <PlaySheet />
    </PlayProvider>
  );
}

type Tab = "actions" | "inventory" | "resources" | "skills" | "log";

/** The table view: pinned vitals and turn economy over abilities, resources, stats and the log. */
function PlaySheet() {
  const t = useT();
  const n = useNames();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const { character, sheet, undo, redo, canUndo, canRedo } = usePlay();
  const [tab, setTab] = useState<Tab>("actions");
  const cls = sheet.classes[0];
  const accent = cls ? n.engine.reg.get(cls.id)?.accent : undefined;

  useEffect(() => {
    const root = document.documentElement;
    if (accent) root.style.setProperty("--class", accent);
    return () => {
      root.style.removeProperty("--class");
    };
  }, [accent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const subtitle = [sheet.speciesId && n.entity(sheet.speciesId, true), ...sheet.classes.map((c) => `${n.entity(c.subclass ?? c.id, true)} ${c.level}`)].filter(Boolean).join(" · ");
  const tabs = desktop ? (["actions", "inventory", "skills"] as const) : (["actions", "inventory", "resources", "skills", "log"] as const);
  const current: Tab = (tabs as readonly Tab[]).includes(tab) ? tab : "actions";

  return (
    <div className="min-h-dvh">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(900px_500px_at_80%_-10%,color-mix(in_oklab,var(--class)_18%,transparent),transparent_70%)]" />

      <div className="safe-t relative mx-auto flex max-w-6xl items-center gap-2 px-3 pt-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label={t("common.back")}>
          <ArrowLeft size={20} />
        </Button>
        <Crest id={character.id} accent={accent} size={36} initials={character.name.slice(0, 1)} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg leading-tight">{character.name}</div>
          <div className="truncate text-xs text-ink-3">{subtitle}</div>
        </div>
        <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={undo} aria-label={t("common.undo")} title={t("common.undo")}>
          <Undo2 size={17} />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={redo} aria-label={t("common.redo")} title={t("common.redo")}>
          <Redo2 size={17} />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => navigate({ to: "/c/$id/build", params: { id: character.id } })} aria-label={t("sheet.build")} title={t("sheet.build")}>
          <Pencil size={16} />
        </Button>
      </div>

      <div className="glass sticky top-0 z-20 mt-2 border-b border-line">
        <div className="mx-auto max-w-6xl space-y-2 px-3 py-2 sm:px-6">
          <Vitals />
          <CombatBar />
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-3 pt-4 pb-28 sm:px-6 lg:grid lg:grid-cols-[1fr_24rem] lg:gap-6">
        <main className="min-w-0 space-y-4">
          <Tabs items={tabs.map((x) => ({ id: x, label: t(`sheet.tabs.${x}`) }))} value={current} onChange={setTab} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={current} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
              {current === "actions" && <ActionsPanel />}
              {current === "inventory" && <InventoryPanel />}
              {current === "resources" && <Side />}
              {current === "skills" && <StatsPanel />}
              {current === "log" && <LogPanel />}
            </motion.div>
          </AnimatePresence>
        </main>
        {desktop && (
          <aside className="min-w-0 space-y-4">
            <Side />
            <section className="rounded-2xl border border-line bg-surface/60 p-2">
              <div className="mb-1 px-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("sheet.tabs.log")}</div>
              <LogPanel limit={40} />
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}

function Side() {
  const { character, sheet, state } = usePlay();
  return (
    <div className="space-y-4">
      <ResourcesPanel />
      <Slot name="sheet.panel" character={character} sheet={sheet} state={state} />
    </div>
  );
}
