import type { Entity, EntityOf, EntityType, Grant, RulePack } from "../schema/types";
import { allVariants, type Locale, localize } from "../text";
import { DND5E_2024, type GameSystem, SYSTEMS } from "../system/dnd5e";

/**
 * Merged, indexed view over one system's enabled packs. Later packs override
 * earlier ones by entity id, which is how homebrew edits official content.
 */
export class PackRegistry {
  readonly system: GameSystem;
  readonly packs: RulePack[];
  readonly globalGrants: Grant[];
  private readonly byId = new Map<string, Entity>();
  private readonly byType = new Map<EntityType, Entity[]>();
  private readonly origin = new Map<string, string>();
  private searchIndex?: Map<string, string>;

  constructor(packs: RulePack[]) {
    const systemId = packs[0]?.system ?? DND5E_2024.id;
    this.system = SYSTEMS[systemId] ?? DND5E_2024;
    this.packs = packs.filter((p) => p.system === systemId);
    this.globalGrants = this.packs.flatMap((p) => p.globalGrants ?? []);
    for (const pack of this.packs) {
      for (const e of pack.entities) {
        this.byId.set(e.id, e);
        this.origin.set(e.id, pack.id);
      }
    }
    for (const e of this.byId.values()) {
      const list = this.byType.get(e.type) ?? [];
      list.push(e);
      this.byType.set(e.type, list);
    }
  }

  get(id: string): Entity | undefined {
    return this.byId.get(id);
  }

  getOf<T extends EntityType>(type: T, id: string | undefined): EntityOf<T> | undefined {
    if (!id) return undefined;
    const e = this.byId.get(id);
    return e && e.type === type ? (e as EntityOf<T>) : undefined;
  }

  all<T extends EntityType>(type: T): EntityOf<T>[] {
    return (this.byType.get(type) ?? []) as EntityOf<T>[];
  }

  /** Which pack the winning definition of an entity came from. */
  packOf(id: string): string | undefined {
    return this.origin.get(id);
  }

  /** Bilingual substring search over names and aliases. */
  search(query: string, type?: EntityType): Entity[] {
    const q = query.trim().toLowerCase();
    if (!q) return type ? this.all(type) : [...this.byId.values()];
    if (!this.searchIndex) {
      this.searchIndex = new Map();
      for (const e of this.byId.values()) {
        this.searchIndex.set(e.id, [...allVariants(e.name), ...(e.aliases ?? []), e.id].join("\u0000").toLowerCase());
      }
    }
    const out: Entity[] = [];
    for (const e of type ? this.all(type) : this.byId.values()) {
      if (this.searchIndex.get(e.id)!.includes(q)) out.push(e);
    }
    return out;
  }

  name(id: string, locale: Locale): string {
    const e = this.byId.get(id);
    return e ? localize(e.name, locale) : id;
  }
}
