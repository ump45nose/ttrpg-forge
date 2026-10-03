import { EntitySchema, parseCharacter, parseRulePack, type Character, type Engine, type Entity, type ParseResult, type RulePack } from "@forge/core";
import { ulid } from "ulid";
import { userEntitiesFor } from "../../app/packs";

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

/** Character file = the character plus any custom content it uses, so a friend can open it. */
export interface CharacterBundle extends Character {
  homebrew?: Entity[];
}

export function exportCharacter(c: Character, engine: Engine) {
  const { sheet } = engine.evaluate(c.build);
  const ids = [
    ...sheet.collected.entities.map((e) => e.entity.id),
    ...sheet.items.map((i) => i.item),
    ...sheet.spells.map((s) => s.spellId),
    ...c.build.inventory.map((i) => i.item),
    // items picked up during play
    ...c.play.flatMap((e) => (e.type === "item.add" ? [e.item] : [])),
  ];
  const homebrew = userEntitiesFor(engine, ids);
  const bundle: CharacterBundle = homebrew.length ? { ...c, homebrew } : c;
  downloadJson(bundle, `${c.name || "character"}.forge.json`);
}

/** Imported characters get a fresh id so they never overwrite an existing one. */
export async function importCharacterFile(file: File): Promise<ParseResult<{ character: Character; homebrew: Entity[] }>> {
  try {
    const raw = (await readJson(file)) as { homebrew?: unknown };
    const r = parseCharacter(raw);
    if (!r.ok) return r;
    const homebrew: Entity[] = [];
    for (const e of Array.isArray(raw.homebrew) ? raw.homebrew : []) {
      const p = EntitySchema.safeParse(e);
      if (p.success) homebrew.push(p.data as Entity);
    }
    return { ok: true, value: { character: { ...r.value, id: ulid(), updatedAt: Date.now() }, homebrew } };
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
