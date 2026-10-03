import { makeEvent, type Character, type NewEvent, type PlayEvent } from "@forge/core";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { create } from "zustand";
import { toast } from "../ui/Toast";
import { db, requestPersistence } from "./db";
import i18n from "i18next";

/** A write that failed (storage full, private mode...) must not look saved. */
const persist = (p: Promise<unknown>) => void p.catch((e: Error) => toast({ content: `${i18n.t("app.saveFailed")} ${e?.name === "QuotaExceededError" ? i18n.t("app.storageFull") : ""}`.trim(), tone: "bad" }, 8000));

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
    persist(db.characters.put(c));
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
    persist(db.characters.delete(id));
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

/** A page for a character that doesn't exist (deleted, stale link): back to the library, saying why. */
export function useLeaveIfMissing(c: Character | undefined) {
  const navigate = useNavigate();
  useEffect(() => {
    if (c) return;
    toast({ content: i18n.t("app.noCharacter"), tone: "bad" });
    void navigate({ to: "/" });
  }, [c, navigate]);
}
