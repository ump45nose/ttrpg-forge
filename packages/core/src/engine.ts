import { ulid } from "ulid";
import { choiceCandidates, validate, type ChoiceCandidate } from "./build/choices";
import type { Issue } from "./build/collect";
import { autofill } from "./build/autofill";
import { applyOps, emptyBuild, type BuildOp } from "./build/mutations";
import { derive, type Sheet } from "./derive/sheet";
import { preview, type Preview } from "./diff";
import { PackRegistry } from "./pack/registry";
import { activeEffectIds, replay, type PlayState } from "./play";
import { foldInventory } from "./play/inventory";
import { localize, type Locale } from "./text";
import type { Build, Character, RulePack, SampleCharacter } from "./schema/types";

/**
 * Facade used by the UI, plugins and (later) AI tools. Everything that reads or
 * changes a character goes through here, so all callers see the same rules.
 */
export class Engine {
  readonly reg: PackRegistry;

  constructor(packs: RulePack[] | PackRegistry) {
    this.reg = packs instanceof PackRegistry ? packs : new PackRegistry(packs);
  }

  /** Builder view: sheet + validation, without play state. */
  evaluate(build: Build): { sheet: Sheet; issues: Issue[] } {
    const sheet = derive(this.reg, build);
    return { sheet, issues: validate(this.reg, build, sheet) };
  }

  /** Table view: active effects from play feed back into the sheet. */
  play(character: Character): { sheet: Sheet; state: PlayState; issues: Issue[]; build: Build } {
    const build = foldInventory(character.build, character.play);
    const sheet = derive(this.reg, build, { activeEffects: activeEffectIds(character.play) });
    const state = replay(character.play, sheet);
    return { sheet, state, issues: validate(this.reg, build, sheet), build };
  }

  preview(build: Build, current: Sheet, ops: BuildOp[], currentIssues?: Issue[]): Preview {
    return preview(this.reg, build, current, ops, currentIssues);
  }

  options(sheet: Sheet, choicePath: string): ChoiceCandidate[] {
    const ch = sheet.choices.find((c) => c.path === choicePath);
    return ch ? choiceCandidates(this.reg, sheet, ch) : [];
  }

  /** Highest level the character can reach: the system cap, or how far its class content goes. */
  levelCap(build: Build): number {
    const cls = this.reg.getOf("class", build.levels[0]?.classId ?? "");
    const content = cls ? Math.max(1, ...Object.keys(cls.levels).map(Number)) : 1;
    return Math.min(this.reg.system.maxLevel, content);
  }

  /**
   * The level-up step at the table: one more level in the current class.
   * `roll` is the Hit Die result when rolling for HP (house rules may force max/average).
   */
  levelUpOps(build: Build, roll?: number): BuildOp[] {
    const classId = build.levels.at(-1)?.classId;
    if (!classId || build.levels.length >= this.levelCap(build)) return [];
    const rule = this.reg.system.hp.levelUp;
    const hp = rule === "max" ? undefined : roll;
    return [...(hp !== undefined && build.hpMethod !== "rolled" ? [{ op: "setHpMethod", method: "rolled" } as const] : []), { op: "addLevel", classId, hp }];
  }

  apply(build: Build, ops: BuildOp[]): Build {
    return applyOps(build, ops);
  }

  /** Pregens from all loaded packs. */
  samples(): SampleCharacter[] {
    return this.reg.packs.flatMap((p) => p.samples ?? []);
  }

  /** A playable character from a pregen: its decisions, then everything else auto-filled. */
  fromSample(s: SampleCharacter, locale: Locale): Character {
    const c = this.newCharacter(localize(s.name, locale), { level: s.level });
    let b = applyOps(c.build, [
      { op: "setAbilities", method: "standard", scores: s.abilities },
      { op: "setSpecies", id: s.speciesId },
      { op: "setBackground", id: s.backgroundId },
      { op: "setClass", id: s.classId },
      { op: "setLevel", level: s.level },
    ]);
    b = autofill(this, b, s.choices ?? {});
    for (const [classId, spells] of Object.entries(s.prepared ?? {})) b = applyOps(b, [{ op: "setPrepared", classId, spells }]);
    return { ...c, build: b, meta: { ...c.meta, notes: localize(s.text, locale) } };
  }

  newCharacter(name: string, opts: { level?: number } = {}): Character {
    const now = Date.now();
    return {
      schema: 1,
      id: ulid(now),
      name,
      system: this.reg.system.id,
      packs: this.reg.packs.map((p) => ({ id: p.id, version: p.version })),
      meta: {},
      build: emptyBuild(Math.max(1, Math.min(this.reg.system.maxLevel, opts.level ?? 1))),
      play: [],
      createdAt: now,
      updatedAt: now,
    };
  }
}
