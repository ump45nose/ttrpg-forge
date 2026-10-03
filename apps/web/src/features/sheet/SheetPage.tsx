import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Redo2, Undo2, ChevronsUp, Lightbulb } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { haptic, reducedMotion } from "../../app/settings";
import { useCharacter, useLeaveIfMissing } from "../../app/characters";
import { useT } from "../../app/i18n";
import { Slot } from "../../app/slot";
import { Button } from "../../ui/Button";
import { ArtImg } from "../../ui/Art";
import { cn } from "../../ui/cn";
import { Portrait } from "../../ui/Portrait";
import { LooksSheet } from "../media/PortraitEditor";
import { useIsDesktop } from "../../ui/hooks";
import { Tabs } from "../../ui/Tabs";
import { useNames } from "../common/names";
import { ActionsPanel } from "./ActionsPanel";
import { CombatBar } from "./CombatBar";
import { InventoryPanel } from "./InventoryPanel";
import { Hint } from "../../ui/Hint";
import { LevelUpSheet } from "./LevelUpSheet";
import { LogPanel } from "./LogPanel";
import { PlayProvider, usePlay } from "./play";
import { ResourcesPanel } from "./ResourcesPanel";
import { StatsPanel } from "./StatsPanel";
import { Vitals } from "./Vitals";

export function SheetPage() {
  const { id } = useParams({ from: "/c/$id" });
  const character = useCharacter(id);
  useLeaveIfMissing(character);
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
  const { character, sheet, engine, undo, redo, canUndo, canRedo } = usePlay();
  const [tab, setTabState] = useState<Tab>("actions");
  const [dir, setDir] = useState(0);
  const [levelUp, setLevelUp] = useState(false);
  const [looks, setLooks] = useState(false);
  const canLevel = sheet.level > 0 && sheet.level < engine.levelCap(character.build);
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
  const setTab = (next: Tab) => {
    setDir(Math.sign(tabs.indexOf(next as never) - tabs.indexOf(current as never)));
    setTabState(next);
  };
  const swipe = useTabSwipe((step) => {
    const next = tabs[tabs.indexOf(current as never) + step];
    if (!next) return;
    haptic(5);
    setTab(next);
  });
  const slide = reducedMotion() ? 0 : 28;

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(900px_500px_at_80%_-10%,color-mix(in_oklab,var(--class)_18%,transparent),transparent_70%)]" />
      {/* the character's own picture, else the subclass (or class) painting, faded in behind the header */}
      <ArtImg
        id={[sheet.classes[0]?.subclass, sheet.classes[0]?.id]}
        src={character.meta.picture}
        focus={[0.5, 0.2]}
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 -z-0 h-56 bg-transparent [mask-image:linear-gradient(to_bottom,black_10%,transparent)] sm:h-72",
          character.meta.picture ? "opacity-40" : "opacity-30",
        )}
      />

      <div className="safe-t relative mx-auto flex max-w-6xl items-center gap-2 px-3 pt-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label={t("common.back")}>
          <ArrowLeft size={20} />
        </Button>
        <button type="button" onClick={() => setLooks(true)} className="shrink-0 rounded-full" aria-label={t("media.looks")} title={t("media.looks")}>
          <Portrait character={character} speciesId={sheet.speciesId} accent={accent} size={40} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg leading-tight">{character.name}</div>
          <div className="truncate text-xs text-ink-3">{subtitle}</div>
        </div>
        {canLevel && (
          <Button variant="class" size="sm" onClick={() => setLevelUp(true)} className="gap-1 px-2.5" aria-label={t("levelUp.button")} title={t("levelUp.button")}>
            <ChevronsUp size={15} /> <span className="hidden sm:inline">{t("levelUp.button")}</span>
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={undo} aria-label={t("common.undo")} title={t("common.undo")}>
          <Undo2 size={17} />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={redo} aria-label={t("common.redo")} title={t("common.redo")}>
          <Redo2 size={17} />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => navigate({ to: "/c/$id/build", params: { id: character.id }, search: { from: "sheet" } })} aria-label={t("sheet.build")} title={t("sheet.build")}>
          <Pencil size={16} />
        </Button>
      </div>

      <LevelUpSheet open={levelUp} onClose={() => setLevelUp(false)} />
      <LooksSheet open={looks} onClose={() => setLooks(false)} character={character} speciesId={sheet.speciesId} classId={sheet.classes[0]?.id} />
      <div className="safe-t glass sticky top-0 z-20 mt-2 border-b border-line">
        <div className="mx-auto max-w-6xl space-y-2 px-3 py-2 sm:px-6">
          <Vitals />
          <CombatBar />
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-3 pt-4 pb-28 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-6">
        <main className="min-w-0 space-y-4">
          <Hint id="sheet-basics" icon={<Lightbulb size={16} />}>
            <div className="font-medium text-ink">{t("onboard.sheetTitle")}</div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>{t("onboard.sheetHp")}</li>
              <li>{t("onboard.sheetEconomy")}</li>
              <li>{t("onboard.sheetDice")}</li>
            </ul>
          </Hint>
          <Tabs items={tabs.map((x) => ({ id: x, label: t(`sheet.tabs.${x}`) }))} value={current} onChange={setTab} />
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={current}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * slide, y: d ? 0 : 6 }),
                show: { opacity: 1, x: 0, y: 0 },
                leave: (d: number) => ({ opacity: 0, x: -d * slide, y: d ? 0 : -4 }),
              }}
              initial="enter"
              animate="show"
              exit="leave"
              transition={{ duration: 0.16 }}
              {...(desktop ? {} : swipe)}
              className="min-h-[50dvh] touch-pan-y"
            >
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

/**
 * Horizontal swipe on the tab content switches tabs (phones). Swipes that start
 * near the screen edges are left to the OS back gesture, and anything inside a
 * horizontally scrolling strip or a text field is ignored.
 */
function useTabSwipe(go: (step: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart(e: TouchEvent) {
      const p = e.touches[0];
      const el = e.target as HTMLElement;
      const edge = 28;
      if (!p || e.touches.length > 1 || p.clientX < edge || p.clientX > window.innerWidth - edge || el.closest("input,textarea,[data-no-swipe],.overflow-x-auto")) {
        start.current = null;
        return;
      }
      start.current = { x: p.clientX, y: p.clientY, t: Date.now() };
    },
    onTouchEnd(e: TouchEvent) {
      const s = start.current;
      const p = e.changedTouches[0];
      start.current = null;
      if (!s || !p) return;
      const dx = p.clientX - s.x;
      const dy = p.clientY - s.y;
      if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - s.t < 700) go(dx < 0 ? 1 : -1);
    },
  };
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
