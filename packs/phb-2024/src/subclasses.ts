import type { Activation, Grant } from "@forge/core";
import { FOCUS_DC, MA_DIE, MA_ROLL, RAGE_DAMAGE, srdClassKit, srdHelpers } from "@forge/pack-srd52";
import type { PhbBenefit } from "./data";
import { act, f, type SubclassOverlay } from "./overlay-kit";
import { CASTER_OVERLAYS } from "./subclasses-casters";
import { bi, slug } from "./util";

const { action, mod, prof, resource, LONG_ALL, SHORT_ALL, SHORT_ONE, skillChoice, spellChoice, t, table, tag } = srdHelpers;
const { LVL } = srdClassKit;

/** "<b>名Name。</b>" options of a PHB option list -> choice options with one action each. */
function optionActions(items: PhbBenefit[], cost: string): { id: string; name: ReturnType<typeof bi>; text: ReturnType<typeof bi>; grants: Grant[] }[] {
  const activation = (text: string): Activation => (/以一个?反应|执行一?个?反应/.test(text) ? "reaction" : /以一个附赠动作/.test(text) ? "bonus" : "special");
  return items.map((it) => {
    const id = slug(it.en ?? it.zh);
    return { id, name: bi(it.en ?? undefined, it.zh), text: bi(undefined, it.text), grants: [act({ id, name: bi(it.en ?? undefined, it.zh), activation: activation(it.text), cost: [{ resource: cost }], text: bi(undefined, it.text) })] };
  });
}

/* ───────────── shared dice tables ───────────── */

const psiDice = (cls: string) => ({
  count: table(LVL(cls), [0, 0, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12, 12]),
  die: table(LVL(cls), [6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 12, 12, 12, 12]),
});

/** Eldritch Knight / Arcane Trickster: one-third caster on the wizard list, prepared count by level. */
function thirdCaster(cls: string): Record<string, Grant[]> {
  const prepared = table(LVL(cls), [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13]);
  const spells = (id: string, count: number, max: number) => spellChoice(id, t("Wizard Spells", "法师法术"), count, "wizard", 1, max);
  return {
    "3": [
      f("Spellcasting", [
        { type: "spellcasting", classId: `class:${cls}`, ability: "int", progression: "third", list: "wizard", mode: "known", cantrips: 2, prepared },
        spellChoice("cantrips", t("Wizard Cantrips", "法师戏法"), 2, "wizard", 0, 0),
        spells("spells", 3, 1),
      ]),
    ],
    "4": [spells("spells-4", 1, 1)],
    "7": [spells("spells-7", 1, 2)],
    "8": [spells("spells-8", 1, 2)],
  };
}

/* ───────────── Barbarian ───────────── */

const RAGING = "@tag.raging";
const worldTree: SubclassOverlay = () => ({
  "3": [
    f("Vitality of the Tree", [
      act({ id: "vitality-surge", name: t("Vitality Surge", "活力之涌"), activation: "special", trigger: t("You enter Rage", "进入狂暴时"), text: t(`Gain [[${LVL("barbarian")}]] Temporary HP.`, `获得 [[${LVL("barbarian")}]] 点临时生命值。`) }),
      act({ id: "life-giving-force", name: t("Life-Giving Force", "赐命之源"), activation: "special", trigger: t("Start of your turn while raging", "狂暴期间你的回合开始时"), heal: { dice: `[[${RAGE_DAMAGE}]]d6` }, text: t("Temporary HP to another creature within 10 ft.", "为 10 尺内另一名生物提供临时生命值。") }),
    ]),
  ],
  "6": [
    f("Branches of the Tree", [
      act({ id: "branches-of-the-tree", name: t("Branches of the Tree", "灵树枝杈"), activation: "reaction", when: RAGING, trigger: t("A creature within 30 ft starts its turn", "30 尺内生物回合开始时"), save: { ability: "str", dc: "8 + @ability.str.mod + @prof", onSave: "none" } }),
    ]),
  ],
});

const wildHeart: SubclassOverlay = () => ({
  "3": [
    f("Animal Speaker", [
      { type: "spell", spell: "spell:beast-sense", ability: "wis", alwaysPrepared: true },
      { type: "spell", spell: "spell:speak-with-animals", ability: "wis", alwaysPrepared: true },
    ]),
    f("Rage of the Wilds"),
  ],
  "6": [
    f("Aspect of the Wilds", [
      {
        type: "choice",
        id: "aspect",
        name: t("Aspect of the Wilds", "兽之形貌"),
        count: 1,
        from: {
          kind: "options",
          options: [
            { id: "owl", name: t("Owl", "枭"), grants: [mod("sense.darkvision", 60, { label: t("Owl", "枭") })] },
            { id: "panther", name: t("Panther", "豹"), grants: [mod("speed.climb", "@speed.walk", { op: "atLeast", label: t("Panther", "豹") })] },
            { id: "salmon", name: t("Salmon", "鲑"), grants: [mod("speed.swim", "@speed.walk", { op: "atLeast", label: t("Salmon", "鲑") })] },
          ],
        },
      },
    ]),
  ],
});

const zealot: SubclassOverlay = () => ({
  "3": [
    f("Divine Fury", [
      act({ id: "divine-fury", name: t("Divine Fury", "神性之怒"), activation: "special", tags: ["rider", "once-per-turn"], when: RAGING, trigger: t("First hit on your turn while raging", "狂暴期间每回合首次命中"), damage: [{ dice: `1d6 + [[floor(${LVL("barbarian")} / 2)]]`, type: "radiant" }] }),
    ]),
    f("Warrior of the Gods", [
      resource("warrior-of-the-gods", t("Healing Pool (d12)", "治疗池（d12）"), table(LVL("barbarian"), [0, 0, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7]), LONG_ALL),
      act({ id: "warrior-of-the-gods", name: t("Warrior of the Gods", "神之勇者"), activation: "bonus", cost: [{ resource: "warrior-of-the-gods" }], heal: { dice: "1d12" }, text: t("Spend any number of dice; 1d12 each.", "可消耗任意枚骰子，每枚 1d12。") }),
    ]),
  ],
  "6": [f("Fanatical Focus")],
});

/* ───────────── Fighter ───────────── */

const battleMaster: SubclassOverlay = ({ sc, artisan, classSkills }) => {
  const maneuvers = optionActions(sc.options[0]?.items ?? [], "superiority");
  const pick = (id: string, count: number): Grant => ({ type: "choice", id, name: t("Maneuvers", "战技"), count, from: { kind: "options", options: maneuvers } });
  return {
    "3": [
      f("Combat Superiority", [
        resource("superiority", t("Superiority Dice", "卓越骰"), table(LVL("fighter"), [0, 0, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6]), SHORT_ALL),
        tag("superiority-die:d8"),
        pick("maneuvers", 3),
      ]),
      f("Student of War", [
        { type: "choice", id: "tool", name: t("Artisan's Tools", "工匠工具"), count: 1, from: { kind: "proficiency", profKind: "tool", keys: artisan } },
        skillChoice(1, classSkills, "skill"),
      ]),
    ],
    "7": [
      f("Know Your Enemy", [
        resource("know-your-enemy", t("Know Your Enemy", "料敌机先"), 1, LONG_ALL),
        act({ id: "know-your-enemy", name: t("Know Your Enemy", "料敌机先"), activation: "bonus", cost: [{ resource: "know-your-enemy" }] }),
      ]),
      pick("maneuvers-7", 2),
    ],
  };
};

const eldritchKnight: SubclassOverlay = () => {
  const base = thirdCaster("fighter");
  return {
    ...base,
    "3": [
      ...base["3"]!,
      f("War Bond", [act({ id: "war-bond", name: t("Summon Bonded Weapon", "召回联结武器"), activation: "bonus" })]),
    ],
    "7": [...base["7"]!, f("War Magic")],
  };
};

const psiWarrior: SubclassOverlay = () => {
  const d = psiDice("fighter");
  const die = `1d[[${d.die}]]`;
  return {
    "3": [
      f("Psionic Power", [
        resource("psionic-energy", t("Psionic Energy Dice", "灵能骰"), d.count, SHORT_ONE),
        act({ id: "protective-field", name: t("Protective Field", "庇护力场"), activation: "reaction", cost: [{ resource: "psionic-energy" }], trigger: t("You or a creature within 30 ft takes damage", "你或 30 尺内的生物受到伤害"), text: t(`Reduce the damage by ${die} + Int.`, `伤害减少 ${die} + 智力调整值。`) }),
        act({ id: "psionic-strike", name: t("Psionic Strike", "灵能打击"), activation: "special", tags: ["rider", "once-per-turn"], cost: [{ resource: "psionic-energy" }], trigger: t("You hit a target within 30 ft with a weapon", "以武器命中 30 尺内的目标"), damage: [{ dice: `${die} + @ability.int.mod`, type: "force" }] }),
        resource("telekinetic-movement", t("Telekinetic Movement", "念力控物"), 1, SHORT_ALL),
        act({ id: "telekinetic-movement", name: t("Telekinetic Movement", "念力控物"), activation: "action", cost: [{ resource: "telekinetic-movement" }], range: t("30 ft", "30 尺") }),
      ]),
    ],
    "7": [
      f("Telekinetic Adept", [
        resource("psi-powered-leap", t("Psi-Powered Leap", "灵力跃动"), 1, SHORT_ALL),
        act({ id: "psi-powered-leap", name: t("Psi-Powered Leap", "灵力跃动"), activation: "bonus", cost: [{ resource: "psi-powered-leap" }], text: t("Fly Speed equal to twice your Speed this turn.", "本回合获得两倍于速度的飞行速度。") }),
        act({ id: "telekinetic-thrust", name: t("Telekinetic Thrust", "念力突刺"), activation: "special", tags: ["rider"], trigger: t("Psionic Strike deals damage", "灵能打击造成伤害时"), save: { ability: "str", dc: "8 + @ability.int.mod + @prof", onSave: "none" } }),
      ]),
    ],
  };
};

/* ───────────── Monk ───────────── */

const WIS = "[[@ability.wis.mod]]";
const mercy: SubclassOverlay = () => ({
  "3": [
    f("Hand of Harm", [
      act({ id: "hand-of-harm", name: t("Hand of Harm", "夺命之手"), activation: "special", tags: ["rider", "once-per-turn"], cost: [{ resource: "focus" }], trigger: t("You hit with an Unarmed Strike", "以徒手打击命中"), damage: [{ dice: `${MA_ROLL} + ${WIS}`, type: "necrotic" }] }),
    ]),
    f("Hand of Healing", [act({ id: "hand-of-healing", name: t("Hand of Healing", "予命之手"), activation: "action", cost: [{ resource: "focus" }], range: t("Touch", "触及"), heal: { dice: `${MA_ROLL} + ${WIS}` } })]),
    f("Implements of Mercy", [...prof("skill", "insight", "medicine"), ...prof("tool", "item:herbalism-kit")]),
  ],
  "6": [f("Physician's Touch")],
});

const elements: SubclassOverlay = () => ({
  "3": [
    f("Elemental Attunement", [act({ id: "elemental-attunement", name: t("Elemental Attunement", "元素同调"), activation: "special", cost: [{ resource: "focus" }], trigger: t("Start of your turn", "你的回合开始时"), duration: t("10 minutes", "10 分钟") })]),
    f("Manipulate Elements", [{ type: "spell", spell: "spell:elementalism", ability: "wis" }]),
  ],
  "6": [
    f("Elemental Burst", [
      act({ id: "elemental-burst", name: t("Elemental Burst", "元素爆破拳"), activation: "action", cost: [{ resource: "focus", amount: 2 }], range: t("120 ft (20-ft sphere)", "120 尺（半径 20 尺球状）"), save: { ability: "dex", dc: FOCUS_DC, onSave: "half" }, damage: [{ dice: `3d[[${MA_DIE}]]`, type: "chosen" }] }),
    ]),
  ],
});

const shadow: SubclassOverlay = () => ({
  "3": [
    f("Shadow Arts", [
      act({ id: "shadow-arts-darkness", name: t("Shadow Arts: Darkness", "暗影技艺：黑暗术"), activation: "action", cost: [{ resource: "focus" }] }),
      { type: "spell", spell: "spell:darkness", ability: "wis", alwaysPrepared: true },
      mod("sense.darkvision", 60, { label: t("Shadow Arts", "暗影技艺") }),
      { type: "spell", spell: "spell:minor-illusion", ability: "wis" },
    ]),
  ],
  "6": [f("Shadow Step", [act({ id: "shadow-step", name: t("Shadow Step", "暗影步"), activation: "bonus", range: t("60 ft", "60 尺"), text: t("Teleport between areas of Dim Light or Darkness; Advantage on your next melee attack this turn.", "在微光或黑暗间传送；本回合下一次近战攻击具有优势。") })])],
});

/* ───────────── Rogue ───────────── */

const arcaneTrickster: SubclassOverlay = () => {
  const base = thirdCaster("rogue");
  return {
    ...base,
    "3": [...base["3"]!, f("Mage Hand Legerdemain", [{ type: "spell", spell: "spell:mage-hand", alwaysPrepared: true }])],
  };
};

const assassin: SubclassOverlay = () => ({
  "3": [
    f("Assassinate", [
      tag("adv:initiative", t("Assassinate", "暗杀")),
      act({ id: "assassinate", name: t("Assassinate", "暗杀"), activation: "special", tags: ["rider"], trigger: t("Sneak Attack hit in the first round", "第一轮以偷袭命中"), damage: [{ dice: `[[${LVL("rogue")}]]`, type: "weapon" }] }),
    ]),
    f("Assassin's Tools", [...prof("tool", "item:disguise-kit", "item:poisoners-kit")]),
  ],
});

const soulknife: SubclassOverlay = () => {
  const d = psiDice("rogue");
  const MOD = "[[max(@ability.str.mod, @ability.dex.mod)]]";
  const blade = (id: string, en: string, zh: string, dice: string, activation: Activation): Grant =>
    action({ id, name: t(en, zh), activation, category: "attack", tags: ["weapon", "finesse", "thrown"], range: t("Melee or 60/120 ft", "近战或 60/120 尺"), attack: { bonus: "max(@ability.str.mod, @ability.dex.mod) + @prof + @attack.melee", kind: "melee" }, damage: [{ dice: `${dice} + ${MOD}`, type: "psychic" }] });
  return {
    "3": [
      f("Psionic Power", [
        resource("psionic-energy", t("Psionic Energy Dice", "灵能骰"), d.count, SHORT_ONE),
        act({ id: "psi-bolstered-knack", name: t("Psi-Bolstered Knack", "灵振诀窍"), activation: "special", trigger: t("You fail a proficient check", "熟练检定失败时"), text: t(`Add 1d[[${d.die}]]; the die is spent only if you succeed.`, `加上 1d[[${d.die}]]；仅在成功时消耗。`) }),
        act({ id: "psychic-whispers", name: t("Psychic Whispers", "心灵低语"), activation: "action", text: t("Telepathy with up to Proficiency Bonus creatures.", "与至多熟练加值数量的生物心灵感应。") }),
      ]),
      f("Psychic Blades", [blade("psychic-blade", "Psychic Blade", "念刃", "1d6", "action"), blade("psychic-blade-bonus", "Psychic Blade (Bonus)", "念刃（附赠）", "1d4", "bonus")]),
    ],
  };
};

export const SUBCLASS_OVERLAYS: Record<string, SubclassOverlay> = {
  "subclass:path-of-the-world-tree": worldTree,
  "subclass:path-of-wild-heart": wildHeart,
  "subclass:path-of-the-zealot": zealot,
  "subclass:battle-master": battleMaster,
  "subclass:eldritch-knight": eldritchKnight,
  "subclass:psi-warrior": psiWarrior,
  "subclass:warrior-of-mercy": mercy,
  "subclass:warrior-of-the-elements": elements,
  "subclass:warrior-of-shadow": shadow,
  "subclass:arcane-trickster": arcaneTrickster,
  "subclass:assassin": assassin,
  "subclass:soulknife": soulknife,
  ...CASTER_OVERLAYS,
};
