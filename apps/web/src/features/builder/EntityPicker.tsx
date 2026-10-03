import type { BuildOp, Entity, EntityType } from "@forge/core";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useT } from "../../app/i18n";
import { haptic } from "../../app/settings";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { ArtImg, useArt } from "../../ui/Art";
import { Crest } from "../../ui/Crest";
import { entityGlyph } from "../../ui/glyphs";
import { useIsDesktop } from "../../ui/hooks";
import { DiffView } from "../common/DiffView";
import { useNames } from "../common/names";
import { useBuilder } from "./state";
import { RichText } from "../terms/RichText";
import { usePacks } from "../../app/packs";
import { openCreator, useCanCreate } from "../../app/creator";

interface Props {
  type: Extract<EntityType, "class" | "species" | "background">;
  current: string | undefined;
  opsFor: (id: string) => BuildOp[];
  /** Extra showcase content (class timeline, origin choices...). */
  showcase?: (e: Entity, isCurrent: boolean) => ReactNode;
}

/**
 * BG3-style big-choice picker: list on the left, showcase in the middle.
 * Hover (desktop) or tap (touch) focuses a candidate and previews it in the live sheet.
 */
export function EntityPicker({ type, current, opsFor, showcase }: Props) {
  const t = useT();
  const n = useNames();
  const desktop = useIsDesktop();
  const { apply, setFocus, preview } = useBuilder();
  const entities = useMemo(() => n.engine.reg.all(type) as Entity[], [n.engine, type]);
  const [focusId, setFocusId] = useState<string | undefined>(current ?? entities[0]?.id);
  const [hoverId, setHoverId] = useState<string>();
  const shownId = hoverId ?? focusId;
  const shown = entities.find((e) => e.id === shownId);
  const shownArt = useArt(shown?.id);
  const userPacks = usePacks((s) => s.packs);
  const removeIn = usePacks((s) => s.removeIn);
  // entry points exist only while a content-editor plugin (the Workshop) is enabled
  const editable = useCanCreate(type);
  const ownerOf = (e: Entity) => {
    const p = n.engine.reg.packOf(e.id);
    return p && userPacks.some((u) => u.id === p) ? p : undefined;
  };
  const isLocal = (e: Entity) => !!ownerOf(e);
  const focusSaved = (e: Entity) => {
    setHoverId(undefined);
    setFocusId(e.id);
  };
  const startCustom = editable ? () => openCreator({ type, mode: "new", onSaved: focusSaved }) : undefined;

  useEffect(() => {
    if (current) setFocusId(current);
  }, [current]);

  useEffect(() => {
    setFocus(shownId && shownId !== current ? opsFor(shownId) : null);
    // opsFor is stable per step; ignore identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownId, current, setFocus]);
  useEffect(() => () => setFocus(null), [setFocus]);

  const choose = (id: string) => {
    haptic(10);
    setHoverId(undefined);
    setFocusId(id);
    if (id !== current) apply(opsFor(id));
  };

  const accentStyle = (e: Entity | undefined) => (e?.accent ? ({ "--class": e.accent } as CSSProperties) : undefined);

  return (
    <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:gap-5">
      {/* candidates */}
      {desktop ? (
        <div className="space-y-1.5" onMouseLeave={() => setHoverId(undefined)}>
          {entities.map((e) => (
            <ListItem key={e.id} e={e} local={isLocal(e)} selected={e.id === current} focused={e.id === shownId} onHover={() => setHoverId(e.id)} onClick={() => choose(e.id)} style={accentStyle(e)} />
          ))}
          {startCustom && <CustomItem onClick={startCustom} />}
        </div>
      ) : (
        <Carousel entities={entities} current={current} focused={focusId} onFocus={(id) => setFocusId(id)} accentStyle={accentStyle} onCustom={startCustom} />
      )}

      {/* showcase */}
      <div className="mt-4 lg:mt-0">
        <AnimatePresence mode="wait" initial={false}>
          {shown && (
            <motion.article
              key={shown.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="card class-transition relative overflow-hidden p-5 sm:p-6"
              style={accentStyle(shown)}
            >
              <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-class/20 blur-3xl" />
              {shownArt && (
                <ArtImg
                  img={shownArt}
                  focus={type === "class" ? [0.5, 0.3] : [0.5, 0.45]}
                  className="-mx-5 -mt-5 mb-1 h-52 bg-transparent [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:-mx-6 sm:-mt-6 sm:h-72"
                />
              )}
              <header className={cn("relative flex items-start gap-4", shownArt && "-mt-14")}>
                {shownArt ? null : type === "class" ? <Crest id={shown.id} accent={shown.accent} size={72} /> : <Emblem e={shown} />}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold tracking-[0.14em] text-class uppercase">{t(`entity.${type}`)}</div>
                  <h2 className="font-display text-2xl leading-tight sm:text-3xl">{n.l(shown.name, { mono: true })}</h2>
                  {n.l(shown.name) !== n.l(shown.name, { mono: true }) && <div className="text-xs text-ink-3">{n.l(shown.name).split(" · ")[1]}</div>}
                  {shown.summary && <p className="mt-1.5 text-sm text-ink-2">{n.l(shown.summary)}</p>}
                </div>
              </header>
              {shown.text && <RichText text={shown.text} selfId={shown.id} className="relative mt-4 text-sm leading-relaxed text-ink-2" />}
              {editable && (
                <div className="relative mt-4 flex flex-wrap gap-2">
                  {isLocal(shown) ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => openCreator({ type, mode: "edit", base: shown })}>
                        <Pencil size={14} /> {t("homebrew.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-bad"
                        onClick={() => {
                          if (!confirm(t("homebrew.deleteConfirm", { name: n.l(shown.name, { mono: true }) }))) return;
                          const owner = ownerOf(shown);
                          if (shown.id === current && type !== "class") apply([type === "background" ? { op: "setBackground", id: undefined } : { op: "setSpecies", id: undefined }]);
                          setFocusId(entities.find((e) => e.id !== shown.id)?.id);
                          if (owner) void removeIn(owner, shown.id);
                        }}
                      >
                        <Trash2 size={14} /> {t("homebrew.delete")}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => openCreator({ type, mode: "clone", base: shown, onSaved: focusSaved })}>
                      <Copy size={14} /> {t("homebrew.clone")}
                    </Button>
                  )}
                </div>
              )}
              <div className="relative mt-5">{showcase?.(shown, shown.id === current)}</div>

              {!desktop && (
                <>
                  {shown.id !== current && preview && (
                    <div className="relative mt-5 rounded-2xl border border-class/30 bg-class/5 p-3">
                      <div className="mb-2 text-[11px] font-semibold tracking-wider text-class uppercase">{t("builder.changes")}</div>
                      <DiffView diff={preview.diff} compact />
                    </div>
                  )}
                  <div className="sticky bottom-20 z-10 mt-5">
                    <Button variant={shown.id === current ? "secondary" : "class"} size="lg" className="w-full" disabled={shown.id === current} onClick={() => choose(shown.id)}>
                      {shown.id === current ? (
                        <>
                          <Check size={18} /> {n.l(shown.name, { mono: true })}
                        </>
                      ) : (
                        `${t("common.choose")} ${n.l(shown.name, { mono: true })}`
                      )}
                    </Button>
                  </div>
                </>
              )}
            </motion.article>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CustomItem({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-left text-ink-2 transition-colors hover:border-accent hover:text-ink"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong">
        <Plus size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t("homebrew.custom")}</span>
        <span className="block text-xs text-ink-3">{t("homebrew.customHint")}</span>
      </span>
    </motion.button>
  );
}

function Emblem({ e }: { e: Entity }) {
  const Icon = entityGlyph(e.id);
  return (
    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-class/40 bg-[radial-gradient(circle_at_30%_25%,color-mix(in_oklab,var(--class)_45%,transparent),transparent_70%)] text-class shadow-[0_10px_30px_-12px_var(--class)]">
      <Icon size={34} strokeWidth={1.5} />
    </div>
  );
}

function ListItem({ e, local, selected, focused, onHover, onClick, style }: { e: Entity; local?: boolean; selected: boolean; focused: boolean; onHover: () => void; onClick: () => void; style?: CSSProperties }) {
  const n = useNames();
  const t = useT();
  const Icon = entityGlyph(e.id);
  return (
    <motion.button
      layout
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      style={style}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        selected ? "border-class/60 bg-class/12" : focused ? "border-line-strong bg-surface-3/60" : "border-transparent hover:bg-surface-3/40",
      )}
    >
      {selected && <motion.span layoutId="picker-selected" className="absolute inset-y-2 left-0 w-1 rounded-full bg-class" />}
      <ArtImg
        id={e.id}
        size="sm"
        className={cn("h-10 w-10 shrink-0 rounded-lg border transition-colors", selected || focused ? "border-class/60" : "border-line")}
        fallback={
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors", selected || focused ? "border-class/50 text-class" : "border-line text-ink-3")}>
            <Icon size={18} />
          </span>
        }
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink">{n.l(e.name, { mono: true })}</span>
          {local && <span className="shrink-0 rounded bg-accent/15 px-1 text-[10px] text-accent">{t("homebrew.local")}</span>}
        </span>
        {e.summary && <span className="block truncate text-xs text-ink-3">{n.l(e.summary)}</span>}
      </span>
      {selected && <Check size={16} className="text-class" />}
    </motion.button>
  );
}

function Carousel({
  entities,
  current,
  focused,
  onFocus,
  accentStyle,
  onCustom,
}: {
  entities: Entity[];
  current: string | undefined;
  focused: string | undefined;
  onFocus: (id: string) => void;
  accentStyle: (e: Entity) => CSSProperties | undefined;
  onCustom?: () => void;
}) {
  const n = useNames();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(focused ?? "")}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focused]);
  return (
    <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
      {entities.map((e) => {
        const Icon = entityGlyph(e.id);
        const isFocused = e.id === focused;
        const selected = e.id === current;
        return (
          <motion.button
            key={e.id}
            data-id={e.id}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              haptic(5);
              onFocus(e.id);
            }}
            style={accentStyle(e)}
            className={cn(
              "relative flex w-[38%] min-w-[8.5rem] shrink-0 snap-center flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-colors",
              isFocused ? "border-class/70 bg-class/12 shadow-[0_10px_30px_-14px_var(--class)]" : "border-line bg-surface/60",
            )}
          >
            <ArtImg
              id={e.id}
              size="sm"
              className={cn("h-20 w-full rounded-xl transition-opacity", isFocused ? "opacity-100" : "opacity-70")}
              fallback={
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl transition-colors", isFocused ? "text-class" : "text-ink-3")}>
                  <Icon size={24} strokeWidth={1.6} />
                </span>
              }
            />
            <span className="w-full truncate text-sm font-medium">{n.l(e.name, { mono: true })}</span>
            {selected && (
              <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-class text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </motion.button>
        );
      })}
      {onCustom && (
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onCustom}
          className="relative flex w-[38%] min-w-[8.5rem] shrink-0 snap-center flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-2 py-3 text-center text-ink-2"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl">
            <Plus size={24} strokeWidth={1.6} />
          </span>
          <span className="w-full truncate text-sm font-medium">{t("homebrew.custom")}</span>
        </motion.button>
      )}
    </div>
  );
}
