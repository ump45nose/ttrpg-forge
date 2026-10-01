import { parseCharacter, parseRulePack, type ParseResult, type Character, type RulePack } from "@forge/core";
import { ulid } from "ulid";

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readJson(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}

/** Imported characters get a fresh id so they never overwrite an existing one. */
export async function importCharacterFile(file: File): Promise<ParseResult<Character>> {
  try {
    const r = parseCharacter(await readJson(file));
    if (!r.ok) return r;
    return { ok: true, value: { ...r.value, id: ulid(), updatedAt: Date.now() } };
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }
}

export async function importPackFile(file: File): Promise<ParseResult<RulePack>> {
  try {
    return parseRulePack(await readJson(file));
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }
}
