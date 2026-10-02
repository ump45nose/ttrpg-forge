import type { Entity, EntityPatch, Grant, GrantEdits, GrantMatcher } from "../schema/types";

/** The identifying fields of a grant, used by patch matchers. */
function grantKeys(g: Grant): { id?: string; key?: string; target?: string } {
  switch (g.type) {
    case "feature":
    case "choice":
    case "resource":
      return { id: g.id };
    case "action":
      return { id: g.action.id };
    case "spell":
      return { id: g.spell };
    case "item":
      return { id: g.item };
    case "grant":
      return { id: g.entity };
    case "tag":
      return { id: g.tag };
    case "spellcasting":
      return { id: g.classId };
    case "proficiency":
      return { key: g.key };
    case "modifier":
      return { target: g.target };
  }
}

export function grantMatches(g: Grant, m: GrantMatcher): boolean {
  if (m.type && g.type !== m.type) return false;
  const k = grantKeys(g);
  if (m.id !== undefined && k.id !== m.id) return false;
  if (m.key !== undefined && k.key !== m.key) return false;
  if (m.target !== undefined && k.target !== m.target) return false;
  return m.type !== undefined || m.id !== undefined || m.key !== undefined || m.target !== undefined;
}

function editGrants(list: Grant[] | undefined, edits: GrantEdits | undefined): Grant[] | undefined {
  if (!edits) return list;
  const kept = (list ?? []).filter((g) => !(edits.remove ?? []).some((m) => grantMatches(g, m)));
  return [...kept, ...(edits.add ?? [])];
}

/** Returns a patched copy; never mutates the pack's entity. */
export function applyPatch(e: Entity, p: EntityPatch): Entity {
  // id and type are structural and can't be changed by a patch
  const { id: _id, type: _type, ...set } = p.set ?? {};
  let out = { ...e, ...set } as Entity;
  if (p.grants) out = { ...out, grants: editGrants(out.grants, p.grants) };
  if (p.starting && out.type === "class") out = { ...out, starting: editGrants(out.starting, p.starting) ?? [] };
  if (p.levels && (out.type === "class" || out.type === "subclass")) {
    const levels = { ...out.levels };
    for (const [lv, edits] of Object.entries(p.levels)) levels[lv] = editGrants(levels[lv], edits) ?? [];
    out = { ...out, levels };
  }
  return out;
}
