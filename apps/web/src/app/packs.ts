import { srd52 } from "@forge/pack-srd52";
import { Engine, type RulePack } from "@forge/core";
import { useMemo } from "react";
import { create } from "zustand";
import { db, type StoredPack } from "./db";
import { host, useHostRevision } from "./host";

interface PackStore {
  loaded: boolean;
  packs: StoredPack[];
  load(): Promise<void>;
  save(p: StoredPack): Promise<void>;
  remove(id: string): Promise<void>;
}

export const usePacks = create<PackStore>()((set, get) => ({
  loaded: false,
  packs: [],
  async load() {
    set({ loaded: true, packs: await db.packs.toArray() });
  },
  async save(p) {
    await db.packs.put(p);
    set({ packs: [...get().packs.filter((x) => x.id !== p.id), p] });
  },
  async remove(id) {
    await db.packs.delete(id);
    set({ packs: get().packs.filter((x) => x.id !== id) });
  },
}));

export const BASE_PACKS: RulePack[] = [srd52];

/** One engine over: base SRD → plugin packs → user packs (later ones override). */
export function useEngine(): Engine {
  const rev = useHostRevision();
  const user = usePacks((s) => s.packs);
  return useMemo(() => {
    const enabledUser = user.filter((p) => p.enabled).map((p) => p.pack);
    return new Engine([...BASE_PACKS, ...host.get("rulePacks"), ...enabledUser]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, user]);
}
