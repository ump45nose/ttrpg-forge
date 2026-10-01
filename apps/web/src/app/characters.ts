import { makeEvent, type Character, type NewEvent, type PlayEvent } from "@forge/core";
import { create } from "zustand";
import { db, requestPersistence } from "./db";

interface CharacterStore {
  loaded: boolean;
  byId: Record<string, Character>;
  load(): Promise<void>;
  put(c: Character): void;
  update(id: string, fn: (c: Character) => Character): void;
  remove(id: string): void;
  /** Append a play event; returns it (for effects / undo toasts). */
  push(id: string, e: NewEvent): PlayEvent | undefined;
}

export const useCharacters = create<CharacterStore>()((set, get) => ({
  loaded: false,
  byId: {},
  async load() {
    const all = await db.characters.toArray();
    set({ loaded: true, byId: Object.fromEntries(all.map((c) => [c.id, c])) });
  },
  put(c) {
    set((s) => ({ byId: { ...s.byId, [c.id]: c } }));
    void db.characters.put(c);
    void requestPersistence();
  },
  update(id, fn) {
    const cur = get().byId[id];
    if (!cur) return;
    get().put({ ...fn(cur), updatedAt: Date.now() });
  },
  remove(id) {
    set((s) => {
      const byId = { ...s.byId };
      delete byId[id];
      return { byId };
    });
    void db.characters.delete(id);
  },
  push(id, e) {
    const cur = get().byId[id];
    if (!cur) return undefined;
    const ev = makeEvent(e);
    get().put({ ...cur, play: [...cur.play, ev], updatedAt: Date.now() });
    return ev;
  },
}));

export const useCharacter = (id: string) => useCharacters((s) => s.byId[id]);
