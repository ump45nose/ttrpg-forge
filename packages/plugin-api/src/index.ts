import type { Character, LocalizedText, PlayEvent, RollResult, RulePack, ResolvedAction, Sheet } from "@forge/core";

/**
 * Plugin contract. The app shell is a host: every feature beyond the core
 * engine (builder steps, combat widgets, dice renderers, themes, content packs,
 * future AI / room sync) registers through these contribution points.
 *
 * UI components are typed as `C` so this package stays framework-agnostic;
 * the web app instantiates it with React's ComponentType.
 */

export type PluginKind = "data" | "presentation" | "logic" | "ui";

export interface PluginManifest {
  id: string;
  version: string;
  name: LocalizedText;
  description?: LocalizedText;
  /** Semver range of the host API this plugin was built for. */
  engine: string;
  kind: PluginKind;
  /** Built-in plugins can't be removed, only disabled. */
  builtin?: boolean;
  /** Plugins that must be enabled first. */
  requires?: string[];
}

export interface ThemeTokens {
  [cssVar: `--${string}`]: string;
}

export interface ThemeDef {
  id: string;
  name: LocalizedText;
  scheme: "dark" | "light";
  tokens: ThemeTokens;
  /** Optional preview swatch colours for the settings picker. */
  swatch?: string[];
}

export interface SlotContribution<C> {
  id: string;
  /** Where it renders, e.g. "sheet.panel", "combat.widget", "builder.step". */
  slot: string;
  order?: number;
  title?: LocalizedText;
  icon?: string;
  component: C;
}

export interface ActionFxContext {
  character: Character;
  sheet: Sheet;
  action?: ResolvedAction;
  /** Root element to draw overlays into. */
  stage: HTMLElement;
  reducedMotion: boolean;
}

/** Presentation for confirmed play events. Must never change game state. */
export interface ActionFx {
  id: string;
  name: LocalizedText;
  match(event: PlayEvent, ctx: ActionFxContext): boolean;
  play(event: PlayEvent, ctx: ActionFxContext): void | Promise<void>;
}

export interface DiceRenderer<C> {
  id: string;
  name: LocalizedText;
  /** Rendered as an overlay while a roll resolves. */
  component: C;
}

export interface Importer {
  id: string;
  name: LocalizedText;
  accept: string;
  /** Returns characters and/or packs found in the file. */
  import(file: File): Promise<{ characters?: Character[]; packs?: RulePack[]; warnings?: string[] }>;
}

export interface Exporter {
  id: string;
  name: LocalizedText;
  export(character: Character, sheet: Sheet): Promise<Blob>;
  filename(character: Character): string;
}

export interface ArtImage {
  /** Path without extension, relative to the app root; `.webp` is large, `.sm.webp` the thumbnail. */
  src: string;
  /** Pixel size of the original, for aspect ratio. */
  w: number;
  h: number;
  /** Content version, appended as `?v=` so caches pick up re-painted images. */
  v?: string;
  /** Focal point (0–1) used when the image is cropped; defaults to the upper middle. */
  focus?: [number, number];
}

/** Illustrations keyed by entity id ("class:wizard") or a named slot ("scene:campfire"). */
export interface ArtPack {
  id: string;
  name: LocalizedText;
  images: Record<string, ArtImage>;
  credit?: LocalizedText;
}

/** Built-in feedback sounds an app may replace: dice rolling / landing, crit, fumble, healing, damage. */
export type SoundCue = "roll" | "land" | "crit" | "fumble" | "heal" | "hurt";

/** Replacements for feedback cues (audio URLs or data URLs). Later packs win; the player's own sounds win over all. */
export interface SoundPack {
  id: string;
  name: LocalizedText;
  cues: Partial<Record<SoundCue, string>>;
  credit?: LocalizedText;
}

export interface Contributions<C> {
  rulePacks?: RulePack[];
  locales?: Record<string, Record<string, unknown>>;
  themes?: ThemeDef[];
  /** Later packs override earlier ones per id; missing ids fall back to generated emblems. */
  art?: ArtPack[];
  sounds?: SoundPack[];
  slots?: SlotContribution<C>[];
  actionFx?: ActionFx[];
  diceRenderers?: DiceRenderer<C>[];
  importers?: Importer[];
  exporters?: Exporter[];
}

export interface Plugin<C = unknown> {
  manifest: PluginManifest;
  contributes?: Contributions<C>;
  /** Imperative setup: subscribe to host events, register late contributions. */
  setup?(host: PluginHostApi<C>): void | (() => void);
}

/* ───────────────────────── host events ───────────────────────── */

export interface HostEvents {
  /** A play event was committed to a character's log (after validation). */
  "play:committed": { character: Character; event: PlayEvent; sheet: Sheet; action?: ResolvedAction };
  "dice:rolled": { result: RollResult; label?: string };
  "theme:changed": { id: string };
  "plugins:changed": undefined;
}

type Handler<T> = (payload: T) => void;

export interface PluginHostApi<C> {
  on<K extends keyof HostEvents>(event: K, fn: Handler<HostEvents[K]>): () => void;
  emit<K extends keyof HostEvents>(event: K, payload: HostEvents[K]): void;
  contribute(pluginId: string, c: Contributions<C>): void;
}

export const HOST_API_VERSION = "0.1.0";

export class PluginHost<C = unknown> implements PluginHostApi<C> {
  private plugins = new Map<string, Plugin<C>>();
  private enabled = new Set<string>();
  private late = new Map<string, Contributions<C>[]>();
  private teardown = new Map<string, () => void>();
  private handlers = new Map<keyof HostEvents, Set<Handler<never>>>();
  private version = 0;

  register(plugin: Plugin<C>, enabled = true) {
    this.plugins.set(plugin.manifest.id, plugin);
    if (enabled) this.enable(plugin.manifest.id);
  }

  list(): { plugin: Plugin<C>; enabled: boolean }[] {
    return [...this.plugins.values()].map((plugin) => ({ plugin, enabled: this.enabled.has(plugin.manifest.id) }));
  }

  isEnabled(id: string) {
    return this.enabled.has(id);
  }

  enable(id: string) {
    const p = this.plugins.get(id);
    if (!p || this.enabled.has(id)) return;
    for (const dep of p.manifest.requires ?? []) this.enable(dep);
    this.enabled.add(id);
    const off = p.setup?.(this);
    if (off) this.teardown.set(id, off);
    this.changed();
  }

  disable(id: string) {
    if (!this.enabled.delete(id)) return;
    this.teardown.get(id)?.();
    this.teardown.delete(id);
    this.late.delete(id);
    this.changed();
  }

  contribute(pluginId: string, c: Contributions<C>) {
    const list = this.late.get(pluginId) ?? [];
    list.push(c);
    this.late.set(pluginId, list);
    this.changed();
  }

  /** Monotonic counter, bumps whenever the set of contributions changes. */
  get revision() {
    return this.version;
  }

  private all(): Contributions<C>[] {
    const out: Contributions<C>[] = [];
    for (const id of this.enabled) {
      const p = this.plugins.get(id);
      if (p?.contributes) out.push(p.contributes);
      out.push(...(this.late.get(id) ?? []));
    }
    return out;
  }

  get<K extends keyof Contributions<C>>(key: K): NonNullable<Contributions<C>[K]> extends (infer T)[] ? T[] : never {
    return this.all().flatMap((c) => (c[key] as unknown[] | undefined) ?? []) as never;
  }

  slots(slot: string): SlotContribution<C>[] {
    return this.get("slots")
      .filter((s) => s.slot === slot)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  on<K extends keyof HostEvents>(event: K, fn: Handler<HostEvents[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(fn as Handler<never>);
    this.handlers.set(event, set);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof HostEvents>(event: K, payload: HostEvents[K]) {
    for (const fn of this.handlers.get(event) ?? []) {
      try {
        (fn as Handler<HostEvents[K]>)(payload);
      } catch (e) {
        // a broken plugin must never break the host
        console.error(`[plugin] handler for ${String(event)} failed`, e);
      }
    }
  }

  private changed() {
    this.version++;
    this.emit("plugins:changed", undefined);
  }
}
