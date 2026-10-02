import type { Entity } from "@forge/core";
import { barbarian, berserker } from "./barbarian";
import { bard, loreCollege } from "./bard";
import { cleric, lifeDomain } from "./cleric";
import { druid, landCircle } from "./druid";
import { champion, fighter } from "./fighter";
import { monk, openHand } from "./monk";
import { blessedWarrior, devotionOath, paladin } from "./paladin";
import { druidicWarrior, hunter, ranger } from "./ranger";
import { rogue, thief } from "./rogue";
import { draconicSorcery, sorcerer } from "./sorcerer";
import { fiendPatron, warlock } from "./warlock";
import { evoker, wizard } from "./wizard";

export const classes: Entity[] = [
  barbarian, berserker, bard, loreCollege, cleric, lifeDomain, druid, landCircle, fighter, champion,
  monk, openHand, paladin, devotionOath, ranger, hunter, rogue, thief, sorcerer, draconicSorcery,
  warlock, fiendPatron, wizard, evoker,
  // class-only Fighting Style alternatives
  blessedWarrior, druidicWarrior,
];
