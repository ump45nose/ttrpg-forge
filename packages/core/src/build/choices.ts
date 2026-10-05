import type { ChoiceView, Sheet } from "../derive/sheet";
import type { PackRegistry } from "../pack/registry";
import { ABILITIES, type Ability, type Build, type Entity, type Prereq } from "../schema/types";
import { LANGUAGES_5E, pointBuyCost } from "../system/dnd5e";
import type { LocalizedText } from "../text";
import type { Issue } from "./collect";

export interface ChoiceCandidate {
  id: string;
  name: LocalizedText;
  summary?: LocalizedText;
  text?: LocalizedText;
  entity?: Entity;
  selected: boolean;
  valid: boolean;
  reason?: LocalizedText;
}

const L = (en: string, zh: string): LocalizedText => ({ en, zh });

export function checkPrereq(sheet: Sheet, prereq: Prereq | undefined): LocalizedText | undefined {
  if (!prereq) return undefined;
  if (prereq.level && sheet.level < prereq.level) return prereq.text ?? L(`Requires level ${prereq.level}`, `需要 ${prereq.level} 级`);
  if (prereq.formula) {
    let ok = false;
    try {
      ok = !!sheet.stats.eval(prereq.formula);
    } catch {
      ok = false;
    }
    if (!ok) return prereq.text ?? L("Prerequisite not met", "未满足先决条件");
  }
  return undefined;
}

/** Everything a player could pick for a choice, with why-not reasons. */
export function choiceCandidates(reg: PackRegistry, sheet: Sheet, ch: ChoiceView): ChoiceCandidate[] {
  const from = ch.choice.from;
  const sel = new Set(ch.selected);
  switch (from.kind) {
    case "entity": {
      let pool: Entity[] = from.ids ? from.ids.map((id) => reg.get(id)).filter((e): e is Entity => !!e) : reg.all(from.entityType);
      if (from.tags?.length) pool = pool.filter((e) => from.tags!.every((t) => e.tags?.includes(t)));
      if (from.anyTags?.length) pool = pool.filter((e) => from.anyTags!.some((t) => e.tags?.includes(t)));
      const minL = from.minLevel !== undefined ? sheet.stats.eval(from.minLevel) : undefined;
      const maxL = from.maxLevel !== undefined ? sheet.stats.eval(from.maxLevel) : undefined;
      if (from.entityType === "spell") {
        pool = pool.filter((e) => {
          const lvl = (e as Extract<Entity, { type: "spell" }>).level;
          return (minL === undefined || lvl >= minL) && (maxL === undefined || lvl <= maxL);
        });
      }
      return pool.map((e) => {
        let reason = checkPrereq(sheet, e.prereq);
        if (!reason && !e.repeatable && !sel.has(e.id)) {
          const elsewhere = sheet.collected.entities.some((x) => x.entity.id === e.id && !x.path.startsWith(ch.path))
            || sheet.spells.some((s) => s.spellId === e.id && s.classId === ch.source.classId && !s.path.startsWith(ch.path));
          if (elsewhere) reason = L("Already gained from another source", "已从其他来源获得");
        }
        return { id: e.id, name: e.name, summary: e.summary, text: e.text, entity: e, selected: sel.has(e.id), valid: !reason, reason };
      });
    }
    case "options":
      return from.options.map((o) => {
        const reason = checkPrereq(sheet, o.prereq);
        return { id: o.id, name: o.name, text: o.text, selected: sel.has(o.id), valid: !reason, reason };
      });
    case "proficiency": {
      const keys = from.keys === "any" ? allKeys(reg, sheet, from.profKind) : from.keys;
      return keys.map((key) => {
        const name = keyName(reg, sheet, from.profKind, key);
        const others = sheet.proficiencies.find((p) => p.kind === from.profKind && p.key === key);
        const otherSources = others?.sources.filter((s) => !s.path.startsWith(ch.path)) ?? [];
        let reason: LocalizedText | undefined;
        if (from.requireProficient) {
          if (!otherSources.length) reason = L("Requires proficiency first", "需要先具备熟练");
          else if (others?.level === "expertise" && !sel.has(key) && otherSources.length) {
            // expertise already granted elsewhere
            const exp = sheet.collected.grants.some(
              (g) => g.grant.type === "proficiency" && g.grant.kind === from.profKind && g.grant.key === key && g.grant.level === "expertise" && !g.source.path.startsWith(ch.path),
            );
            if (exp) reason = L("Already have expertise", "已有专精");
          }
        } else if (otherSources.length && !sel.has(key)) {
          reason = L("Already proficient", "已熟练");
        }
        return { id: key, name, selected: sel.has(key), valid: !reason, reason };
      });
    }
    case "ability":
      return from.abilities.map((a) => ({ id: a, name: a.toUpperCase(), selected: ch.selected.some((s) => s.startsWith(`${a}:`)), valid: true }));
  }
}

function allKeys(reg: PackRegistry, sheet: Sheet, kind: string): string[] {
  switch (kind) {
    case "skill":
      return Object.keys(sheet.skills);
    case "save":
      return [...ABILITIES];
    case "language":
      return Object.keys(LANGUAGES_5E);
    case "tool":
      return reg.all("item").filter((i) => i.itemType === "tool").map((i) => i.id);
    case "mastery":
      return reg.all("item").filter((i) => i.weapon?.mastery).map((i) => i.id);
    case "weapon":
      return ["simple", "martial"];
    case "armor":
      return ["light", "medium", "heavy", "shield"];
    default:
      return [];
  }
}

export function keyName(reg: PackRegistry, _sheet: Sheet | undefined, kind: string, key: string): LocalizedText {
  if (kind === "skill") return reg.system.skills[key]?.name ?? key;
  if (kind === "language") return LANGUAGES_5E[key]?.name ?? key;
  if (kind === "tool" || kind === "mastery") return reg.get(key)?.name ?? key;
  if (kind === "save") return key.toUpperCase();
  const fixed: Record<string, LocalizedText> = {
    simple: L("Simple weapons", "简易武器"),
    martial: L("Martial weapons", "军用武器"),
    light: L("Light armor", "轻甲"),
    medium: L("Medium armor", "中甲"),
    heavy: L("Heavy armor", "重甲"),
    shield: L("Shields", "盾牌"),
  };
  return fixed[key] ?? reg.get(key)?.name ?? key;
}

/** Ability-increase selections are tokens "dex:2". Returns an error message or undefined. */
export function checkAbilitySelection(ch: ChoiceView, sheet: Sheet): LocalizedText | undefined {
  if (ch.choice.from.kind !== "ability") return undefined;
  const from = ch.choice.from;
  if (!ch.selected.length) return undefined;
  const amounts: number[] = [];
  for (const tok of ch.selected) {
    const [a, n] = tok.split(":");
    if (!from.abilities.includes(a as Ability)) return L(`${a} is not allowed here`, `此处不能选择 ${a}`);
    amounts.push(Number(n));
  }
  const sorted = [...amounts].sort((x, y) => y - x).join(",");
  if (!from.patterns.some((p) => [...p].sort((x, y) => y - x).join(",") === sorted)) return L("Invalid distribution", "分配方式不合法");
  const cap = from.cap ?? 20;
  for (const tok of ch.selected) {
    const a = tok.split(":")[0] as Ability;
    if (sheet.abilities[a].score > cap) return L(`${a.toUpperCase()} cannot exceed ${cap}`, `${a.toUpperCase()} 不能超过 ${cap}`);
  }
  return undefined;
}

/** Full rules validation of a build against its derived sheet. */
export function validate(reg: PackRegistry, build: Build, sheet: Sheet): Issue[] {
  const issues: Issue[] = [...sheet.issues];
  const sys = reg.system;

  // base ability scores
  const scores = ABILITIES.map((a) => build.baseAbilities[a]);
  if (build.abilityMethod === "pointbuy") {
    const { min, max } = sys.pointBuy;
    const cost = scores.some((v) => v < min || v > max) ? null : pointBuyCost(build.baseAbilities, sys);
    if (cost === null) issues.push({ severity: "error", code: "pointbuy-range", message: L(`Point buy scores must be ${min}–${max}`, `购点属性必须在 ${min}–${max} 之间`) });
    else if (cost > sys.pointBuy.budget) issues.push({ severity: "error", code: "pointbuy-budget", message: L(`Point buy over budget (${cost}/${sys.pointBuy.budget})`, `购点超出预算（${cost}/${sys.pointBuy.budget}）`) });
  } else if (build.abilityMethod === "standard") {
    if ([...scores].sort((a, b) => b - a).join() !== [...sys.standardArray].sort((a, b) => b - a).join())
      issues.push({ severity: "error", code: "standard-array", message: L("Use each standard array value once", "标准数组的每个数值需各用一次") });
  }

  for (const ch of sheet.choices) {
    if (ch.selected.length > ch.count && ch.choice.from.kind !== "ability")
      issues.push({ severity: "error", code: "too-many", path: ch.path, message: L(`Too many selections (${ch.selected.length}/${ch.count})`, `选择过多（${ch.selected.length}/${ch.count}）`) });
    if (ch.choice.from.kind === "ability") {
      const err = checkAbilitySelection(ch, sheet);
      if (err) issues.push({ severity: "error", code: "ability-choice", path: ch.path, message: err });
      continue;
    }
    const cands = choiceCandidates(reg, sheet, ch);
    for (const id of ch.selected) {
      const c = cands.find((x) => x.id === id);
      if (!c) issues.push({ severity: "error", code: "invalid-selection", path: ch.path, message: L(`"${id}" is not a valid option`, `“${id}”不是有效选项`) });
      else if (!c.valid) issues.push({ severity: "error", code: "invalid-selection", path: ch.path, message: c.reason ?? L("Invalid", "无效") });
    }
  }

  for (const sc of sheet.spellcasting) {
    const prepared = sheet.spells.filter((s) => s.classId === sc.classId && s.level > 0 && s.prepared && !s.alwaysPrepared).length;
    if (sc.mode !== "known" && sc.preparedMax && prepared > sc.preparedMax)
      issues.push({ severity: "error", code: "too-many-prepared", path: sc.classId, message: L(`Too many prepared spells (${prepared}/${sc.preparedMax})`, `准备法术过多（${prepared}/${sc.preparedMax}）`) });
    const cantrips = sheet.spells.filter((s) => s.classId === sc.classId && s.level === 0).length;
    if (cantrips > sc.cantripsMax && sc.cantripsMax)
      issues.push({ severity: "warning", code: "too-many-cantrips", path: sc.classId, message: L(`Cantrips ${cantrips}/${sc.cantripsMax}`, `戏法 ${cantrips}/${sc.cantripsMax}`) });
  }
  return dedupeIssues(issues);
}

function dedupeIssues(list: Issue[]): Issue[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = `${i.code}|${i.path}|${JSON.stringify(i.message)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
