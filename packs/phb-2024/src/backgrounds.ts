import type { BackgroundEntity, Entity, Grant } from "@forge/core";
import { srdHelpers } from "@forge/pack-srd52";
import type { PhbBackground } from "./data";
import type { FeatIndex } from "./feats";
import type { ItemIndex } from "./items";
import { ABILITY_ZH, bi, enOf, SKILL_ZH, slug } from "./util";

const { equipmentChoice, gold, t } = srdHelpers;

/** Kit entries that don't match an item name directly. */
const KIT_ALIAS: Record<string, string> = { 箭: "item:arrows", 支箭: "item:arrows", 弩矢: "item:bolts", 表演服装: "item:costume", 书籍: "item:book" };

export interface Unresolved {
  where: string;
  what: string;
}

/** "2匕首" / "20支箭" / "羊皮纸（10张）" / "燃油（3扁瓶）" / "书籍（祈祷文）" -> [name, qty] */
export function kitEntry(raw: string): [name: string, qty: number, note?: string] {
  let s = raw.trim();
  let qty = 1;
  const lead = /^(\d+)\s*(?:支|件|个|把|张|套|瓶)?(.*)$/.exec(s);
  if (lead) {
    qty = Number(lead[1]);
    s = lead[2]!.trim();
  }
  const paren = /^(.*?)（(.*?)）$/.exec(s);
  let note: string | undefined;
  if (paren) {
    s = paren[1]!.trim();
    const n = /^(\d+)/.exec(paren[2]!);
    if (n) qty = Number(n[1]);
    else note = paren[2];
  }
  return [s, qty, note];
}

export function buildBackgrounds(list: PhbBackground[], base: Map<string, Entity>, items: ItemIndex, feats: FeatIndex, unresolved: Unresolved[]): Entity[] {
  return list.map((b): Entity => {
    const id = `background:${slug(b.en)}`;
    const prev = base.get(id) as BackgroundEntity | undefined;
    const grants: Grant[] = [];
    const abilities = b.abilities.map((z) => ABILITY_ZH[z.trim()]).filter((a) => !!a);
    grants.push({
      type: "choice",
      id: "ability",
      name: t("Ability Scores", "属性值"),
      text: t("Increase one score by 2 and another by 1, or three scores by 1 (max 20).", "一项属性 +2、另一项 +1，或三项各 +1（上限 20）。"),
      count: 1,
      from: { kind: "ability", abilities, patterns: [[2, 1], [1, 1, 1]], cap: 20 },
    });
    const feat = feats.resolve(b.feat, b.featNote);
    if (feat) grants.push({ type: "grant", entity: feat });
    else unresolved.push({ where: id, what: `feat ${b.feat}` });
    for (const s of b.skills) {
      const key = SKILL_ZH[s.trim()];
      if (key) grants.push({ type: "proficiency", kind: "skill", key });
      else unresolved.push({ where: id, what: `skill ${s}` });
    }
    // tools: a named tool, or "choose one gaming set / instrument / artisan's tool"
    const group = /赌具/.test(b.tool) ? "gaming" : /乐器/.test(b.tool) ? "instrument" : /工匠工具/.test(b.tool) ? "artisan" : undefined;
    if (group) grants.push({ type: "choice", id: "tool", name: t("Tool Proficiency", "工具熟练"), text: bi(undefined, b.tool), count: 1, from: { kind: "proficiency", profKind: "tool", keys: items.toolGroups[group] } });
    else if (items.byZh.get(b.tool)) grants.push({ type: "proficiency", kind: "tool", key: items.byZh.get(b.tool)! });
    else if (b.tool) unresolved.push({ where: id, what: `tool ${b.tool}` });

    const kit: Grant[] = [];
    for (const raw of b.kit) {
      const gp = /^(\d+)\s*GP$/i.exec(raw.trim());
      if (gp) {
        kit.push(gold(Number(gp[1])));
        continue;
      }
      const [name, qty] = kitEntry(raw);
      if (/同上所选|任意/.test(raw)) continue; // the chosen tool itself; added by the player
      const item = items.byZh.get(name) ?? KIT_ALIAS[name];
      if (item) kit.push({ type: "item", item, qty });
      else unresolved.push({ where: id, what: `kit ${raw}` });
    }
    grants.push(
      equipmentChoice("equipment", [
        { id: "a", name: t("Kit", "装备包"), items: kit },
        { id: "b", name: t(`${b.altGold} GP`, `${b.altGold} 金币`), items: [gold(b.altGold)] },
      ]),
    );
    return {
      ...prev,
      id,
      type: "background",
      name: bi(enOf(prev?.name) ?? b.en, b.zh),
      summary: prev?.summary ?? bi(undefined, `${b.abilities.join("、")} · ${b.feat}${b.featNote && !/见第/.test(b.featNote) ? `（${b.featNote}）` : ""}`),
      text: bi(enOf(prev?.text), `${b.text}\n装备：${b.equipment}`),
      grants,
    } as BackgroundEntity;
  });
}
