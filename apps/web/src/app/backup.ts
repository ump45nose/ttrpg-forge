import { parseCharacter, parseRulePack, type Character } from "@forge/core";
import { downloadJson } from "../features/library/transfer";
import { useCharacters } from "./characters";
import { db, type StoredPack } from "./db";
import { usePacks } from "./packs";
import { useSettings, type Settings } from "./settings";

/** Everything that lives only on this device: characters, user packs and settings. */
export interface Backup {
  format: "forge-backup";
  version: 1;
  at: number;
  characters: Character[];
  packs: StoredPack[];
  settings?: Partial<Settings>;
}

const WEEK = 7 * 24 * 3600 * 1000;

export function downloadBackup() {
  const { set: _set, ...settings } = useSettings.getState();
  const b: Backup = {
    format: "forge-backup",
    version: 1,
    at: Date.now(),
    characters: Object.values(useCharacters.getState().byId),
    packs: usePacks.getState().packs,
    settings,
  };
  downloadJson(b, `forge-backup-${new Date().toISOString().slice(0, 10)}.json`);
  useSettings.getState().set({ lastBackup: b.at, backupSnoozed: undefined });
}

/** Should the library nudge for a backup? Only once there is something to lose. */
export function backupDue(now = Date.now()): boolean {
  const { lastBackup, backupSnoozed } = useSettings.getState();
  const chars = Object.values(useCharacters.getState().byId);
  if (!chars.length) return false;
  if (backupSnoozed && now < backupSnoozed) return false;
  const since = lastBackup ?? Math.min(...chars.map((c) => c.createdAt));
  return now - since > WEEK;
}

export const snoozeBackup = () => useSettings.getState().set({ backupSnoozed: Date.now() + WEEK });

export type ReadBackup = { ok: true; backup: Backup; skipped: number } | { ok: false; error: string };

/** Accepts this format and the older `{characters, packs}` export; invalid entries are skipped, not fatal. */
export async function readBackup(file: File): Promise<ReadBackup> {
  try {
    const raw = JSON.parse(await file.text()) as Partial<Backup>;
    if (!raw || !Array.isArray(raw.characters)) return { ok: false, error: "not a Forge backup" };
    let skipped = 0;
    const characters: Character[] = [];
    for (const c of raw.characters) {
      const r = parseCharacter(c);
      if (r.ok) characters.push(r.value);
      else skipped++;
    }
    const packs: StoredPack[] = [];
    for (const p of Array.isArray(raw.packs) ? raw.packs : []) {
      const r = parseRulePack(p?.pack);
      if (r.ok) packs.push({ ...p, pack: r.value });
      else skipped++;
    }
    return { ok: true, skipped, backup: { format: "forge-backup", version: 1, at: raw.at ?? 0, characters, packs, settings: raw.settings } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * merge: keep whichever copy of a character / pack was changed last.
 * replace: this device ends up exactly like the backup (settings included).
 */
export async function restoreBackup(b: Backup, mode: "merge" | "replace") {
  const chars = useCharacters.getState();
  const packs = usePacks.getState();
  if (mode === "replace") {
    await db.transaction("rw", db.characters, db.packs, async () => {
      await db.characters.clear();
      await db.packs.clear();
      await db.characters.bulkPut(b.characters);
      await db.packs.bulkPut(b.packs);
    });
    if (b.settings) useSettings.getState().set(b.settings);
  } else {
    const newer = <T extends { id: string; updatedAt: number }>(mine: T | undefined, theirs: T) => !mine || theirs.updatedAt > mine.updatedAt;
    await db.characters.bulkPut(b.characters.filter((c) => newer(chars.byId[c.id], c)));
    await db.packs.bulkPut(b.packs.filter((p) => newer(packs.packs.find((x) => x.id === p.id), p)));
  }
  await Promise.all([chars.load(), packs.load()]);
}

/** Playtest notes from every character, each with the few events that led up to it, as Markdown. */
export function feedbackNotes(characters: Character[]): { count: number; markdown: string } {
  const out: string[] = ["# Forge playtest notes", ""];
  let count = 0;
  for (const c of characters) {
    c.play.forEach((e, i) => {
      if (e.type !== "note" || !e.feedback) return;
      count++;
      out.push(`## ${new Date(e.at).toLocaleString()} · ${c.name}`, "", e.text, "", "<details><summary>context</summary>", "", "```json");
      for (const prev of c.play.slice(Math.max(0, i - 6), i)) out.push(JSON.stringify({ ...prev, id: undefined }));
      out.push("```", "", "</details>", "");
    });
  }
  return { count, markdown: out.join("\n") };
}

export function downloadText(text: string, filename: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Whether the browser promised not to evict our data, and how much we use. */
export async function storageStatus(): Promise<{ persisted: boolean | null; usage?: number }> {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : undefined;
    return { persisted, usage: est?.usage };
  } catch {
    return { persisted: null };
  }
}
