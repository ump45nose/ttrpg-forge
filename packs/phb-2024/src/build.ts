import type { Entity, RulePack } from "@forge/core";
import { srd52 } from "@forge/pack-srd52";
import { buildBackgrounds, type Unresolved } from "./backgrounds";
import { buildClasses } from "./classes";
import type { PhbData } from "./data";
import { buildFeats } from "./feats";
import { buildItems } from "./items";
import { buildSpecies } from "./species";
import { buildSpells } from "./spells";

export interface PhbBuild {
  pack: RulePack;
  /** Names the converter couldn't map to an entity (shown in tests / dev console). */
  unresolved: Unresolved[];
}

/**
 * Turn parsed PHB pages into a pack that loads after the SRD. Entities reuse SRD ids, so
 * the PHB version (full Chinese text, PHB names) replaces the SRD one while keeping its
 * hand-written mechanics; PHB-only content gets mechanics from overlays and heuristics.
 */
export function buildPhbPack(data: PhbData, base: RulePack = srd52): PhbBuild {
  const byId = new Map<string, Entity>(base.entities.map((e) => [e.id, e]));
  const unresolved: Unresolved[] = [];
  const items = buildItems(data.items, data.masteries, byId);
  const feats = buildFeats(data.feats, byId, items.toolGroups);
  const commit = data.source.commit.slice(0, 7);
  const entities: Entity[] = [
    ...items.entities,
    ...buildSpells(data.spells, byId),
    ...feats.entities,
    ...buildBackgrounds(data.backgrounds, byId, items, feats, unresolved),
    ...buildSpecies(data.species, byId),
    ...buildClasses(data.classes ?? [], byId, items.toolGroups.artisan),
  ];
  return {
    unresolved,
    pack: {
      id: "phb-2024",
      version: `0.1.0+${commit}`,
      system: base.system,
      name: { en: "Player's Handbook 2024 (DND5eChm)", zh: "玩家手册 2024（不全书译本）" },
      license: "GPL-3.0 translation of copyrighted material — personal use",
      attribution: {
        en: `Chinese text from DND5e_chm “玩家手册2024” by the DND5eChm community (https://github.com/${data.source.repo}, GPL-3.0, commit ${commit}). Dungeons & Dragons and the Player's Handbook are © Wizards of the Coast. Generated on this device for personal use; do not redistribute.`,
        zh: `中文文本来自 DND5eChm「5E 不全书」玩家手册2024（https://github.com/${data.source.repo}，GPL-3.0，commit ${commit}）。《龙与地下城》及《玩家手册》版权归威世智所有。本内容在本机生成，仅供个人使用，请勿再分发。`,
      },
      entities,
    },
  };
}
