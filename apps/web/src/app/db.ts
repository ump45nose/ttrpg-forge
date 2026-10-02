import type { Character, RulePack } from "@forge/core";
import Dexie, { type Table } from "dexie";

export interface StoredPack {
  id: string;
  pack: RulePack;
  enabled: boolean;
  /** "import" for files, "homebrew" for packs made in the editor, "local" for the built-in homebrew pack. */
  origin: "import" | "homebrew" | "local";
  /** Load order among user packs; later packs override earlier ones. */
  order?: number;
  updatedAt: number;
}

class ForgeDB extends Dexie {
  characters!: Table<Character, string>;
  packs!: Table<StoredPack, string>;
  constructor() {
    super("forge");
    this.version(1).stores({ characters: "id, updatedAt", packs: "id" });
  }
}

export const db = new ForgeDB();

let persistAsked = false;
/** Ask the browser not to evict our data (important on iOS). */
export async function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
