import { loadPhb2024 } from "@forge/pack-phb2024";
import { srd52 } from "@forge/pack-srd52";
import { Engine, type Entity, type RulePack } from "@forge/core";
import { useMemo } from "react";
import { create } from "zustand";
import { db, type StoredPack } from "./db";
import { host, useHostRevision } from "./host";

/** The always-present pack that holds custom backgrounds, species, items... made in the app. */
export const LOCAL_PACK_ID = "local:homebrew";

function localPack(entities: Entity[] = []): StoredPack {
  return {
    id: LOCAL_PACK_ID,
    origin: "local",
    enabled: true,
    updatedAt: Date.now(),
    pack: { id: LOCAL_PACK_ID, version: "1", system: srd52.system, name: { en: "My Homebrew", zh: "我的自定义" }, entities },
  };
}

/** User packs in load order; the local homebrew pack always loads last (highest priority). */
export function orderedPacks(packs: StoredPack[]): StoredPack[] {
  const rest = packs.filter((p) => p.id !== LOCAL_PACK_ID).sort((a, b) => (a.order ?? a.updatedAt) - (b.order ?? b.updatedAt));
  const local = packs.find((p) => p.id === LOCAL_PACK_ID);
  return local ? [...rest, local] : rest;
}

interface PackStore {
  loaded: boolean;
  packs: StoredPack[];
  load(): Promise<void>;
  save(p: StoredPack): Promise<void>;
  remove(id: string): Promise<void>;
  /** Swap a pack with its neighbour in load order. */
  move(id: string, dir: -1 | 1): Promise<void>;
  /** Add or replace an entity in the local homebrew pack. */
  upsertLocal(e: Entity): Promise<void>;
  removeLocal(id: string): Promise<void>;
  /** Add or replace an entity in any user pack (keeps its position when replacing). */
  upsertIn(packId: string, e: Entity): Promise<void>;
  removeIn(packId: string, id: string): Promise<void>;
}

export const usePacks = create<PackStore>()((set, get) => ({
  loaded: false,
  packs: [],
  async load() {
    set({ loaded: true, packs: await db.packs.toArray() });
  },
  async save(p) {
    const order = p.order ?? Math.max(0, ...get().packs.map((x) => x.order ?? 0)) + 1;
    const next = { ...p, order, updatedAt: Date.now() };
    await db.packs.put(next);
    set({ packs: [...get().packs.filter((x) => x.id !== p.id), next] });
  },
  async remove(id) {
    await db.packs.delete(id);
    set({ packs: get().packs.filter((x) => x.id !== id) });
  },
  async move(id, dir) {
    const list = orderedPacks(get().packs).filter((p) => p.id !== LOCAL_PACK_ID);
    const i = list.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    const renumbered = list.map((p, k) => ({ ...p, order: k + 1 }));
    await db.packs.bulkPut(renumbered);
    set({ packs: [...renumbered, ...get().packs.filter((p) => p.id === LOCAL_PACK_ID)] });
  },
  upsertLocal(e) {
    return get().upsertIn(LOCAL_PACK_ID, e);
  },
  removeLocal(id) {
    return get().removeIn(LOCAL_PACK_ID, id);
  },
  async upsertIn(packId, e) {
    const cur = get().packs.find((p) => p.id === packId) ?? (packId === LOCAL_PACK_ID ? localPack() : undefined);
    if (!cur) throw new Error(`unknown pack ${packId}`);
    const i = cur.pack.entities.findIndex((x) => x.id === e.id);
    const entities = i < 0 ? [...cur.pack.entities, e] : cur.pack.entities.map((x, j) => (j === i ? e : x));
    await get().save({ ...cur, pack: { ...cur.pack, entities } });
  },
  async removeIn(packId, id) {
    const cur = get().packs.find((p) => p.id === packId);
    if (!cur) return;
    await get().save({ ...cur, pack: { ...cur.pack, entities: cur.pack.entities.filter((x) => x.id !== id) } });
  },
}));

/** SRD always; the 2024 PHB only when its data was generated locally (see packs/phb-2024). */
export const BASE_PACKS: RulePack[] = [srd52];

/** Adds the PHB (a separate chunk) before the first render, so no character ever sees it missing. */
export async function loadBasePacks() {
  const phb = await loadPhb2024();
  if (phb && !BASE_PACKS.some((p) => p.id === phb.id)) BASE_PACKS.push(phb);
}

/** One engine over: base SRD → plugin packs → user packs in order → local homebrew. */
export function useEngine(): Engine {
  const rev = useHostRevision();
  const user = usePacks((s) => s.packs);
  return useMemo(() => {
    const enabledUser = orderedPacks(user)
      .filter((p) => p.enabled)
      .map((p) => p.pack);
    return new Engine([...BASE_PACKS, ...host.get("rulePacks"), ...enabledUser]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, user]);
}

/** Id of the user pack (local homebrew, house rules, imports) that currently provides an entity, if any. */
export function useUserEntity(id: string | undefined): string | undefined {
  const engine = useEngine();
  const user = usePacks((s) => s.packs);
  if (!id) return undefined;
  const owner = engine.reg.packOf(id);
  return owner && user.some((p) => p.id === owner) ? owner : undefined;
}

/** Entities from the local pack that a character's build depends on (bundled into exports). */
export function localEntitiesFor(engine: Engine, ids: Iterable<string>): Entity[] {
  const out = new Map<string, Entity>();
  for (const id of ids) {
    if (engine.reg.packOf(id) === LOCAL_PACK_ID) {
      const e = engine.reg.get(id);
      if (e) out.set(id, e);
    }
  }
  return [...out.values()];
}
