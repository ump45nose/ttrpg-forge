import type { Entity, EntityType } from "@forge/core";
import { create } from "zustand";

/**
 * Quick-create contract between the app and whichever plugin provides content editors
 * (the built-in Workshop). The builder only calls `openCreator`; if no plugin registered
 * an editor for a type, the entry points simply don't render.
 */

export type CreateMode = "new" | "edit" | "clone" | "override";

export interface CreateRequest {
  type: EntityType;
  mode: CreateMode;
  /** Entity to edit / clone / override. */
  base?: Entity;
  /** Fields merged into a brand-new entity (spell level and list, a subclass's parent class...). */
  preset?: Partial<Entity>;
  /** Called after a successful save with the stored entity. */
  onSaved?: (e: Entity) => void;
}

interface CreatorStore {
  /** Entity types some plugin can edit. */
  types: EntityType[];
  req: CreateRequest | null;
  register(types: EntityType[]): () => void;
  open(req: CreateRequest): void;
  close(): void;
}

export const useCreator = create<CreatorStore>()((set, get) => ({
  types: [],
  req: null,
  register(types) {
    set({ types: [...new Set([...get().types, ...types])] });
    return () => set({ types: get().types.filter((t) => !types.includes(t)), req: null });
  },
  open(req) {
    set({ req });
  },
  close() {
    set({ req: null });
  },
}));

export const useCanCreate = (type: EntityType | undefined) => useCreator((s) => !!type && s.types.includes(type));
export const openCreator = (req: CreateRequest) => useCreator.getState().open(req);
