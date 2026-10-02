import { ulid } from "ulid";
import { choiceCandidates, validate, type ChoiceCandidate } from "./build/choices";
import type { Issue } from "./build/collect";
import { applyOps, emptyBuild, type BuildOp } from "./build/mutations";
import { derive, type Sheet } from "./derive/sheet";
import { preview, type Preview } from "./diff";
import { PackRegistry } from "./pack/registry";
import { activeEffectIds, replay, type PlayState } from "./play";
import type { Build, Character, RulePack } from "./schema/types";

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
  play(character: Character): { sheet: Sheet; state: PlayState; issues: Issue[] } {
    const sheet = derive(this.reg, character.build, { activeEffects: activeEffectIds(character.play) });
    const state = replay(character.play, sheet);
    return { sheet, state, issues: validate(this.reg, character.build, sheet) };
  }

  preview(build: Build, current: Sheet, ops: BuildOp[], currentIssues?: Issue[]): Preview {
    return preview(this.reg, build, current, ops, currentIssues);
  }

  options(sheet: Sheet, choicePath: string): ChoiceCandidate[] {
    const ch = sheet.choices.find((c) => c.path === choicePath);
    return ch ? choiceCandidates(this.reg, sheet, ch) : [];
  }

  apply(build: Build, ops: BuildOp[]): Build {
    return applyOps(build, ops);
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
