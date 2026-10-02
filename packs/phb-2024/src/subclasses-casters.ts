import type { Grant } from "@forge/core";
import { BARDIC_DIE, srdClassKit, srdHelpers } from "@forge/pack-srd52";
import { act, f, tagged, type SubclassOverlay } from "./overlay-kit";

/* PHB subclasses for the spellcasting classes: bard, cleric, druid, sorcerer, wizard, paladin, ranger, warlock (levels 3-8). */

const { mod, prof, resource, LONG_ALL, SHORT_ALL, skillChoice, spellChoice, t, tag } = srdHelpers;
const { alwaysPrepared, FULL_CASTER_MAX, LVL } = srdClassKit;

const BI = [{ resource: "bardic-inspiration" }];
const CD = [{ resource: "channel-divinity" }];
const WS = [{ resource: "wild-shape" }];
const BARDIC_ROLL = `1d[[${BARDIC_DIE}]]`;
const WIS_USES = "max(1, @ability.wis.mod)";
const CHA_USES = "max(1, @ability.cha.mod)";
const WIS = "[[@ability.wis.mod]]";
const NO_ARMOR = "!@equipped.armor && !@equipped.shield";

/** "<Domain> Spells": always prepared, unlocked at class levels 3/5/7. */
const domainSpells = (en: string, by: Record<number, string[]>): Grant =>
  f(en, Object.entries(by).flatMap(([lv, ids]) => alwaysPrepared(Number(lv) > 3 ? Number(lv) : undefined, ...ids)));

/* ───────────── Bard ───────────── */

const valor: SubclassOverlay = () => ({
  "3": [
    f("Combat Inspiration", [act({ id: "combat-inspiration", name: t("Combat Inspiration", "战斗激励"), activation: "special", text: t(`An inspired creature can add ${BARDIC_ROLL} to its AC against a hit (Reaction) or to a weapon hit's damage.`, `受激励者可以反应将 ${BARDIC_ROLL} 加到 AC 上，或在武器命中时加到伤害上。`) })]),
    f("Martial Training", [...prof("weapon", "martial"), ...prof("armor", "medium", "shield")]),
  ],
  "6": [tagged(f("Extra Attack", [tag("extra-attack")]), ["attacks:2"])],
});

const dance: SubclassOverlay = () => ({
  "3": [
    f("Dazzling Footwork", [
      mod("ac", "10 + @ability.dex.mod + @ability.cha.mod", { op: "base", when: NO_ARMOR, label: t("Dazzling Footwork", "炫目舞步") }),
      act({
        id: "bardic-damage",
        name: t("Unarmed Strike (Bardic Damage)", "徒手打击（诗人痛击）"),
        activation: "action",
        category: "attack",
        when: NO_ARMOR,
        attack: { bonus: "@ability.dex.mod + @prof + @attack.melee", kind: "melee" },
        damage: [{ dice: `${BARDIC_ROLL} + [[@ability.dex.mod]]`, type: "bludgeoning" }],
        text: t("Also as part of any action that expends Bardic Inspiration (Agile Strikes).", "消耗诗人激励的动作中也可进行一次（灵巧打击）。"),
      }),
    ]),
  ],
  "6": [
    f("Inspring Movement", [act({ id: "inspiring-movement", name: t("Inspiring Movement", "鼓舞之移"), activation: "reaction", cost: BI, trigger: t("An enemy ends its turn within 5 ft of you", "敌人在你 5 尺内结束回合") })]),
    f("Tandem Footwork", [act({ id: "tandem-footwork", name: t("Tandem Footwork", "协同舞步"), activation: "special", cost: BI, trigger: t("You roll Initiative", "投掷先攻时"), text: t(`You and allies within 30 ft add ${BARDIC_ROLL} to Initiative.`, `你与 30 尺内盟友的先攻加 ${BARDIC_ROLL}。`) })]),
  ],
});

const glamour: SubclassOverlay = () => ({
  "3": [
    f("Beguiling Magic", [
      ...alwaysPrepared(undefined, "charm-person", "mirror-image"),
      resource("beguiling-magic", t("Beguiling Magic", "惑心魔法"), 1, LONG_ALL),
      act({ id: "beguiling-magic", name: t("Beguiling Magic", "惑心魔法"), activation: "special", cost: [{ resource: "beguiling-magic" }], trigger: t("You cast an Enchantment or Illusion spell with a slot", "以法术位施展惑控或幻术法术后"), save: { ability: "wis", dc: "@spell.bard.dc", onSave: "none" } }),
    ]),
    f("Mantle of Insipration", [
      act({ id: "mantle-of-inspiration", name: t("Mantle of Inspiration", "灵感织衣"), activation: "bonus", cost: BI, range: t("60 ft", "60 尺"), text: t(`Up to [[max(1, @ability.cha.mod)]] creatures gain 2 × ${BARDIC_ROLL} Temporary HP and can move with their Reaction.`, `至多 [[max(1, @ability.cha.mod)]] 名生物获得 2 × ${BARDIC_ROLL} 临时生命值，并可用反应移动。`) }),
    ]),
  ],
  "6": [
    f("Mantle of Majesty", [
      ...alwaysPrepared(undefined, "command"),
      resource("mantle-of-majesty", t("Mantle of Majesty", "威仪作锦"), 1, LONG_ALL),
      act({ id: "mantle-of-majesty", name: t("Mantle of Majesty", "威仪作锦"), activation: "bonus", cost: [{ resource: "mantle-of-majesty" }], duration: t("1 minute", "1 分钟"), text: t("Cast Command without a slot now and as a Bonus Action each turn.", "立即并在之后每回合以附赠动作无需法术位地施展命令术。") }),
    ]),
  ],
});

/* ───────────── Cleric ───────────── */

const light: SubclassOverlay = () => ({
  "3": [
    domainSpells("Light Domain Spells", { 3: ["burning-hands", "faerie-fire", "scorching-ray", "see-invisibility"], 5: ["daylight", "fireball"], 7: ["arcane-eye", "wall-of-fire"] }),
    f("Radiance of the Dawn", [
      act({ id: "radiance-of-the-dawn", name: t("Radiance of the Dawn", "黎明曙光"), activation: "action", cost: CD, range: t("30-ft Emanation", "30 尺光环"), save: { ability: "con", dc: "@spell.cleric.dc", onSave: "half" }, damage: [{ dice: `2d10 + [[${LVL("cleric")}]]`, type: "radiant" }] }),
    ]),
    f("Warding Flare", [
      resource("warding-flare", t("Warding Flare", "守御之光"), WIS_USES, LONG_ALL),
      act({ id: "warding-flare", name: t("Warding Flare", "守御之光"), activation: "reaction", cost: [{ resource: "warding-flare" }], range: t("30 ft", "30 尺"), trigger: t("A creature makes an attack roll", "生物进行攻击检定时"), text: t("Impose Disadvantage on the attack.", "使该次攻击具有劣势。") }),
    ]),
  ],
  "6": [
    f("Improved Warding Flare", [
      resource("warding-flare", t("Warding Flare", "守御之光"), WIS_USES, [...SHORT_ALL, ...LONG_ALL]),
      act({ id: "improved-warding-flare", name: t("Improved Warding Flare", "精通守御之光"), activation: "special", tags: ["rider"], trigger: t("When you use Warding Flare", "使用守御之光时"), text: t(`The attack's target gains 2d6 + ${WIS} Temporary HP.`, `被攻击的目标获得 2d6 + ${WIS} 临时生命值。`) }),
    ]),
  ],
});

const war: SubclassOverlay = () => ({
  "3": [
    f("Guided Strike", [act({ id: "guided-strike", name: t("Guided Strike", "导引打击"), activation: "special", cost: CD, trigger: t("You or a creature within 30 ft misses an attack", "你或 30 尺内生物攻击失手时"), text: t("+10 to the attack roll (Reaction for others).", "攻击检定 +10（为他人使用时需反应）。") })]),
    domainSpells("War Domain Spells", { 3: ["guiding-bolt", "magic-weapon", "shield-of-faith", "spiritual-weapon"], 5: ["crusaders-mantle", "spirit-guardians"], 7: ["fire-shield", "freedom-of-movement"] }),
    f("War Priest", [
      resource("war-priest", t("War Priest", "战争祭司"), WIS_USES, [...SHORT_ALL, ...LONG_ALL]),
      act({ id: "war-priest", name: t("War Priest", "战争祭司"), activation: "bonus", cost: [{ resource: "war-priest" }], text: t("Make one weapon attack or Unarmed Strike.", "发动一次武器攻击或徒手打击。") }),
    ]),
  ],
  "6": [f("War God's Blessing", [act({ id: "war-gods-blessing", name: t("War God's Blessing", "战神祝福"), activation: "action", cost: CD, text: t("Cast Shield of Faith or Spiritual Weapon without a slot or Concentration (1 minute).", "无需法术位与专注地施展虔诚护盾或灵体武器（1 分钟）。") })])],
});

const trickery: SubclassOverlay = () => ({
  "3": [
    f("Blessing of the Trickster", [act({ id: "blessing-of-the-trickster", name: t("Blessing of the Trickster", "诡术祝福"), activation: "action", range: t("30 ft", "30 尺"), text: t("A creature has Advantage on Dex (Stealth) checks until your next Long Rest.", "一名生物的敏捷（隐匿）检定具有优势，直到你下次长休。") })]),
    f("Invoke Duplicity", [act({ id: "invoke-duplicity", name: t("Invoke Duplicity", "召现分身"), activation: "bonus", cost: CD, duration: t("1 minute", "1 分钟"), text: t("Create an illusory double within 30 ft: cast spells from its space; Advantage on attacks against creatures within 5 ft of both of you.", "在 30 尺内创造幻象分身：可从其位置施法；对同时位于你和幻象 5 尺内的生物攻击具有优势。") })]),
    domainSpells("Trickery Domain Spells", { 3: ["charm-person", "disguise-self", "invisibility", "pass-without-trace"], 5: ["hypnotic-pattern", "nondetection"], 7: ["confusion", "dimension-door"] }),
  ],
  "6": [f("Trickster's Transposition")],
});

/* ───────────── Druid ───────────── */

const stars: SubclassOverlay = () => ({
  "3": [
    f("Star Map", [
      ...alwaysPrepared(undefined, "guidance"),
      { type: "spell", spell: "spell:guiding-bolt", alwaysPrepared: true, free: { max: WIS_USES, recovery: LONG_ALL } },
    ]),
    f("Starry Form", [
      act({ id: "starry-form", name: t("Starry Form", "星耀形态"), activation: "bonus", cost: WS, duration: t("10 minutes", "10 分钟"), text: t("Choose Archer, Chalice or Dragon.", "选择射手座、圣杯座或巨龙座。") }),
      act({ id: "archer", name: t("Archer", "射手座"), activation: "bonus", category: "attack", range: t("60 ft", "60 尺"), attack: { bonus: "@spell.druid.attack", kind: "spell" }, damage: [{ dice: `1d8 + ${WIS}`, type: "radiant" }] }),
      act({ id: "chalice", name: t("Chalice", "圣杯座"), activation: "special", tags: ["rider"], trigger: t("You cast a healing spell with a slot", "以法术位施展治疗法术时"), range: t("30 ft", "30 尺"), heal: { dice: `1d8 + ${WIS}` } }),
      act({ id: "dragon", name: t("Dragon", "巨龙座"), activation: "special", text: t("Treat a d20 roll of 9 or lower as 10 on Int/Wis checks and Concentration saves.", "智力、感知检定及维持专注的体质豁免中，d20 骰出 9 或以下视为 10。") }),
    ]),
  ],
  "6": [
    f("Cosmic Omen", [
      resource("cosmic-omen", t("Cosmic Omen", "宇宙预兆"), WIS_USES, LONG_ALL),
      act({ id: "cosmic-omen", name: t("Cosmic Omen", "宇宙预兆"), activation: "reaction", cost: [{ resource: "cosmic-omen" }], range: t("30 ft", "30 尺"), trigger: t("A creature is about to make a D20 Test", "生物即将进行 D20 检定"), text: t("Weal: add 1d6. Woe: subtract 1d6.", "吉兆：加 1d6；凶兆：减 1d6。") }),
    ]),
  ],
});

const moon: SubclassOverlay = () => ({
  "3": [
    f("Circle Forms", [act({ id: "circle-forms", name: t("Circle Forms", "结社形态"), activation: "special", trigger: t("You use Wild Shape", "使用荒野变形时"), text: t(`Max CR [[floor(${LVL("druid")} / 3)]]; AC at least 13 + ${WIS}; gain [[3 * ${LVL("druid")}]] Temporary HP.`, `最大挑战等级 [[floor(${LVL("druid")} / 3)]]；AC 至少为 13 + ${WIS}；获得 [[3 * ${LVL("druid")}]] 临时生命值。`) })]),
    domainSpells("Circle of the Moon Spells", { 3: ["starry-wisp", "cure-wounds", "moonbeam"], 5: ["conjure-animals"], 7: ["fount-of-moonlight"] }),
  ],
  "6": [f("Improved Circle Forms")],
});

const sea: SubclassOverlay = () => ({
  "3": [
    domainSpells("Circle of the Sea Spells", { 3: ["ray-of-frost", "fog-cloud", "thunderwave", "gust-of-wind", "shatter"], 5: ["lightning-bolt", "water-breathing"], 7: ["control-water", "ice-storm"] }),
    f("Wrath of the Sea", [
      act({ id: "wrath-of-the-sea", name: t("Wrath of the Sea", "瀚海之怒"), activation: "bonus", cost: WS, duration: t("10 minutes", "10 分钟"), range: t("5-ft Emanation", "5 尺光环"), save: { ability: "con", dc: "@spell.druid.dc", onSave: "none" }, damage: [{ dice: "[[max(1, @ability.wis.mod)]]d6", type: "cold" }], text: t("Push a Large or smaller target up to 15 ft on a failed save; repeat as a Bonus Action.", "豁免失败的大型或更小目标被推离至多 15 尺；之后可用附赠动作再次发动。") }),
    ]),
  ],
  "6": [f("Aquatic Affinity", [mod("speed.swim", "@speed.walk", { op: "atLeast", label: t("Aquatic Affinity", "水生亲和") })])],
});

/* ───────────── Sorcerer ───────────── */

const clockwork: SubclassOverlay = () => ({
  "3": [
    domainSpells("Clockwork Spells", { 3: ["protection-from-evil-and-good", "alarm", "lesser-restoration", "aid"], 5: ["dispel-magic", "protection-from-energy"], 7: ["freedom-of-movement", "summon-construct"] }),
    f("Restore Balance", [
      resource("restore-balance", t("Restore Balance", "归复平衡"), CHA_USES, LONG_ALL),
      act({ id: "restore-balance", name: t("Restore Balance", "归复平衡"), activation: "reaction", cost: [{ resource: "restore-balance" }], range: t("60 ft", "60 尺"), trigger: t("A creature is about to roll with Advantage or Disadvantage", "生物即将带优势或劣势掷骰"), text: t("Cancel the Advantage or Disadvantage.", "取消该优势或劣势。") }),
    ]),
  ],
  "6": [f("Bastion of Law", [act({ id: "bastion-of-law", name: t("Bastion of Law", "律令之壁"), activation: "action", cost: [{ resource: "sorcery-points" }], range: t("30 ft", "30 尺"), text: t("Spend 1-5 Sorcery Points: a ward of that many d8s that reduces damage.", "消耗 1~5 术法点：屏障具有等量 d8，可用于减少伤害。") })])],
});

const wildMagic: SubclassOverlay = () => ({
  "3": [
    f("Wild Magic Surge", [tag("wild-magic-surge")]),
    f("Tide of Chaos", [
      resource("tide-of-chaos", t("Tide of Chaos", "混乱之潮"), 1, LONG_ALL),
      act({ id: "tide-of-chaos", name: t("Tide of Chaos", "混乱之潮"), activation: "special", cost: [{ resource: "tide-of-chaos" }], text: t("Advantage on one D20 Test.", "一次 D20 检定具有优势。") }),
    ]),
  ],
  "6": [f("Bend Luck", [act({ id: "bend-luck", name: t("Bend Luck", "扭曲幸运"), activation: "reaction", cost: [{ resource: "sorcery-points" }], trigger: t("A creature you can see rolls a d20 for a D20 Test", "你可见的生物进行 D20 检定掷骰后"), text: t("Add or subtract 1d4.", "加上或减去 1d4。") })])],
});

const aberrant: SubclassOverlay = () => ({
  "3": [
    domainSpells("Psionic Spells", { 3: ["mind-sliver", "arms-of-hadar", "dissonant-whispers", "calm-emotions", "detect-thoughts"], 5: ["hunger-of-hadar", "sending"], 7: ["evards-black-tentacles", "summon-aberration"] }),
    f("Telepathic Speech", [act({ id: "telepathic-speech", name: t("Telepathic Speech", "传心谈话"), activation: "bonus", range: t("30 ft", "30 尺"), duration: t(`[[${LVL("sorcerer")}]] minutes`, `[[${LVL("sorcerer")}]] 分钟`) })]),
  ],
  "6": [f("Psionic Sorcery"), f("Psychic Defenses", [tag("resist:psychic"), tag("adv:save.charmed"), tag("adv:save.frightened")])],
});

/* ───────────── Wizard ───────────── */

/** "<School> Savant": two school spells at 3, one more per new slot level (5, 7). */
const savant = (en: string, school: string): Record<string, Grant[]> => {
  const pick = (id: string, count: number, level: number) => spellChoice(id, t("Savant Spells", "学派学者法术"), count, "wizard", 1, FULL_CASTER_MAX[level - 1]!, [school]);
  return { "3": [f(en, [pick("savant", 2, 3)])], "5": [pick("savant-5", 1, 5)], "7": [pick("savant-7", 1, 7)] };
};
const merge = (...parts: Record<string, Grant[]>[]): Record<string, Grant[]> => {
  const out: Record<string, Grant[]> = {};
  for (const p of parts) for (const [lv, gs] of Object.entries(p)) out[lv] = [...(out[lv] ?? []), ...gs];
  return out;
};

const illusionist: SubclassOverlay = () =>
  merge(savant("Illusion Savant", "illusion"), {
    "3": [f("Improved Illusions", [{ type: "spell", spell: "spell:minor-illusion" }])],
    "6": [
      f("Phantasmal Creatures", [
        { type: "spell", spell: "spell:summon-beast", alwaysPrepared: true, free: { max: 1, recovery: LONG_ALL } },
        { type: "spell", spell: "spell:summon-fey", alwaysPrepared: true, free: { max: 1, recovery: LONG_ALL } },
      ]),
    ],
  });

const abjurer: SubclassOverlay = () =>
  merge(savant("Abjuration Savant", "abjuration"), {
    "3": [
      f("Arcane Ward", [
        resource("arcane-ward", t("Arcane Ward HP", "奥术守御生命值"), `2 * ${LVL("wizard")} + @ability.int.mod`, LONG_ALL),
        act({ id: "arcane-ward", name: t("Recharge Arcane Ward", "恢复奥术守御"), activation: "bonus", text: t("Expend a slot: the ward regains twice its level in HP.", "消耗一个法术位：结界恢复两倍于其环阶的生命值。") }),
      ]),
    ],
    "6": [f("Projected Ward", [act({ id: "projected-ward", name: t("Projected Ward", "投射守御"), activation: "reaction", range: t("30 ft", "30 尺"), trigger: t("A creature you can see takes damage", "你可见的生物受到伤害时"), text: t("Your Arcane Ward absorbs the damage.", "以奥术守御吸收该伤害。") })])],
  });

const diviner: SubclassOverlay = () =>
  merge(savant("Divination Savant", "divination"), {
    "3": [
      f("Portent", [
        resource("portent", t("Portent Dice", "预兆骰"), 2, LONG_ALL),
        act({ id: "portent", name: t("Portent", "预兆"), activation: "special", cost: [{ resource: "portent" }], text: t("Replace a D20 Test's roll with a foretold d20 (once per turn).", "以预见骰替换一次 D20 检定的掷骰（每回合一次）。") }),
      ]),
    ],
    "6": [f("Expert Divination")],
  });

/* ───────────── Paladin ───────────── */

const CHA = "[[max(1, @ability.cha.mod)]]";

const ancients: SubclassOverlay = () => ({
  "3": [
    f("Nature's Wrath", [act({ id: "natures-wrath", name: t("Nature's Wrath", "自然之怒"), activation: "action", cost: CD, range: t("15 ft", "15 尺"), save: { ability: "str", dc: "@spell.paladin.dc", onSave: "none" }, duration: t("1 minute", "1 分钟"), text: t("Failed save: Restrained.", "豁免失败则束缚。") })]),
    domainSpells("Oath of the Ancients Spells", { 3: ["ensnaring-strike", "speak-with-animals"], 5: ["misty-step", "moonbeam"] }),
  ],
  "7": [f("Aura of Warding", [tag("resist:necrotic"), tag("resist:psychic"), tag("resist:radiant")])],
});

const vengeance: SubclassOverlay = () => ({
  "3": [
    domainSpells("Oath of Vengeance Spells", { 3: ["bane", "hunters-mark"], 5: ["hold-person", "misty-step"] }),
    f("Vow of Enmity", [act({ id: "vow-of-enmity", name: t("Vow of Enmity", "仇敌誓言"), activation: "special", cost: CD, range: t("30 ft", "30 尺"), duration: t("1 minute", "1 分钟"), trigger: t("You take the Attack action", "执行攻击动作时"), text: t("Advantage on attack rolls against the creature.", "对该生物的攻击检定具有优势。") })]),
  ],
  "7": [f("Relentless Avenger")],
});

const glory: SubclassOverlay = () => ({
  "3": [
    f("Inspiring Smite", [act({ id: "inspiring-smite", name: t("Inspiring Smite", "鼓舞斩"), activation: "special", cost: CD, range: t("30 ft", "30 尺"), trigger: t("You cast Divine Smite", "施展至圣斩后"), text: t(`Distribute 2d8 + [[${LVL("paladin")}]] Temporary HP.`, `分配 2d8 + [[${LVL("paladin")}]] 点临时生命值。`) })]),
    domainSpells("Oath of Glory Spells", { 3: ["guiding-bolt", "heroism"], 5: ["enhance-ability", "magic-weapon"] }),
    f("Peerless Athlete", [act({ id: "peerless-athlete", name: t("Peerless Athlete", "绝伦健将"), activation: "bonus", cost: CD, duration: t("1 hour", "1 小时"), text: t("Advantage on Athletics and Acrobatics checks; jumps +10 ft.", "运动与特技检定具有优势；跳跃距离 +10 尺。") })]),
  ],
  "7": [f("Aura of Alacrity", [mod("speed.walk", 10, { label: t("Aura of Alacrity", "迅捷灵光") })])],
});

/* ───────────── Ranger ───────────── */

const feyWanderer: SubclassOverlay = () => ({
  "3": [
    f("Dreadful Strikes", [act({ id: "dreadful-strikes", name: t("Dreadful Strikes", "哀惧灵袭"), activation: "special", tags: ["rider"], trigger: t("You hit with a weapon (once per target per turn)", "以武器命中时（每目标每回合一次）"), damage: [{ dice: "1d4", type: "psychic" }] })]),
    domainSpells("Fey Wanderer Magic", { 3: ["charm-person"], 5: ["misty-step"] }),
    f("Otherworldly Glamour", [
      ...["deception", "intimidation", "performance", "persuasion"].map((s) => mod(`skill.${s}`, "max(1, @ability.wis.mod)", { label: t("Otherworldly Glamour", "妖冶娴都") })),
      skillChoice(1, ["deception", "performance", "persuasion"], "glamour-skill"),
    ]),
  ],
  "7": [
    f("Beguiling Twist", [
      tag("adv:save.charmed"),
      tag("adv:save.frightened"),
      act({ id: "beguiling-twist", name: t("Beguiling Twist", "妖思魅缕"), activation: "reaction", range: t("120 ft", "120 尺"), trigger: t("A creature succeeds on a save against Charmed or Frightened", "生物成功豁免魅惑或恐慌时"), save: { ability: "wis", dc: "@spell.ranger.dc", onSave: "none" } }),
    ]),
  ],
});

const gloomStalker: SubclassOverlay = () => ({
  "3": [
    f("Dread Ambusher", [
      mod("initiative", "@ability.wis.mod", { label: t("Dread Ambusher", "恐惧伏击") }),
      resource("dreadful-strike", t("Dreadful Strike", "恐惧打击"), WIS_USES, LONG_ALL),
      act({ id: "dreadful-strike", name: t("Dreadful Strike", "恐惧打击"), activation: "special", tags: ["rider", "once-per-turn"], cost: [{ resource: "dreadful-strike" }], trigger: t("You hit with a weapon", "以武器命中时"), damage: [{ dice: "2d6", type: "psychic" }] }),
      act({ id: "ambushers-leap", name: t("Ambusher's Leap", "伏击者之跃"), activation: "special", trigger: t("Start of your first turn in combat", "战斗中你的第一个回合开始时"), text: t("+10 ft Speed this turn.", "本回合速度 +10 尺。") }),
    ]),
    domainSpells("Gloom Stalker Magic", { 3: ["disguise-self"], 5: ["rope-trick"] }),
    f("Umbral Sight", [mod("sense.darkvision", 60, { label: t("Umbral Sight", "阴影视野") })]),
  ],
  "7": [f("Iron Mind", [...prof("save", "wis")])],
});

const beastMaster: SubclassOverlay = () => ({
  "3": [
    f("Primal Companion", [
      {
        type: "choice",
        id: "primal-beast",
        name: t("Primal Beast", "原初野兽"),
        count: 1,
        from: {
          kind: "options",
          options: [
            { id: "beast-of-the-land", name: t("Beast of the Land", "大地野兽"), grants: [tag("primal-beast:land")] },
            { id: "beast-of-the-sea", name: t("Beast of the Sea", "海洋野兽"), grants: [tag("primal-beast:sea")] },
            { id: "beast-of-the-sky", name: t("Beast of the Sky", "天空野兽"), grants: [tag("primal-beast:sky")] },
          ],
        },
      },
      act({ id: "command-beast", name: t("Command Primal Beast", "命令原初野兽"), activation: "bonus", text: t("The beast takes an action of your choice; or replace one of your attacks with its Beast's Strike.", "野兽执行你指定的动作；也可在攻击动作中牺牲一次攻击命令其进行野兽打击。") }),
    ]),
  ],
  "7": [f("Exceptional Training")],
});

/* ───────────── Warlock ───────────── */

const celestial: SubclassOverlay = () => ({
  "3": [
    domainSpells("Celestial Spells", { 3: ["light", "sacred-flame", "cure-wounds", "guiding-bolt", "aid", "lesser-restoration"], 5: ["daylight", "revivify"], 7: ["guardian-of-faith", "wall-of-fire"] }),
    f("Healing Light", [
      resource("healing-light", t("Healing Light (d6)", "治愈之光（d6）"), `1 + ${LVL("warlock")}`, LONG_ALL),
      act({ id: "healing-light", name: t("Healing Light", "治愈之光"), activation: "bonus", cost: [{ resource: "healing-light" }], range: t("60 ft", "60 尺"), heal: { dice: "1d6" }, text: t(`Spend up to ${CHA} dice at once; 1d6 each.`, `每次至多消耗 ${CHA} 枚骰子，每枚 1d6。`) }),
    ]),
  ],
  "6": [f("Radiant Soul", [tag("resist:radiant")])],
});

const greatOldOne: SubclassOverlay = () => ({
  "3": [
    domainSpells("Great Old One Spells", { 3: ["dissonant-whispers", "tashas-hideous-laughter", "phantasmal-force", "detect-thoughts"], 5: ["clairvoyance", "hunger-of-hadar"], 7: ["confusion", "summon-aberration"] }),
    f("Awakened Mind", [act({ id: "awakened-mind", name: t("Awakened Mind", "唤醒心灵"), activation: "bonus", range: t("30 ft", "30 尺"), duration: t(`[[${LVL("warlock")}]] minutes`, `[[${LVL("warlock")}]] 分钟`) })]),
    f("Psychic Spells", [tag("psychic-spells")]),
  ],
  "6": [
    f("Clairvoyant Combatant", [
      resource("clairvoyant-combatant", t("Clairvoyant Combatant", "锐眼斗士"), 1, [...SHORT_ALL, ...LONG_ALL]),
      act({ id: "clairvoyant-combatant", name: t("Clairvoyant Combatant", "锐眼斗士"), activation: "special", cost: [{ resource: "clairvoyant-combatant" }], trigger: t("You form a bond with Awakened Mind", "以唤醒心灵建立连结时"), save: { ability: "wis", dc: "@spell.warlock.dc", onSave: "none" } }),
    ]),
  ],
});

const archfey: SubclassOverlay = () => ({
  "3": [
    domainSpells("Archfey Spells", { 3: ["faerie-fire", "sleep", "calm-emotions", "misty-step", "phantasmal-force"], 5: ["blink", "plant-growth"], 7: ["dominate-beast", "greater-invisibility"] }),
    f("Steps of the Fey", [{ type: "spell", spell: "spell:misty-step", alwaysPrepared: true, free: { max: CHA_USES, recovery: LONG_ALL } }]),
  ],
  "6": [f("Misty Escape", [act({ id: "misty-escape", name: t("Misty Escape", "雾遁"), activation: "reaction", trigger: t("You take damage", "你受到伤害时"), text: t("Cast Misty Step.", "施展迷踪步。") })])],
});

export const CASTER_OVERLAYS: Record<string, SubclassOverlay> = {
  "subclass:college-of-valor": valor,
  "subclass:college-of-dance": dance,
  "subclass:college-of-glamour": glamour,
  "subclass:light-domain": light,
  "subclass:war-domain": war,
  "subclass:trickery-domain": trickery,
  "subclass:circle-of-the-stars": stars,
  "subclass:circle-of-the-moon": moon,
  "subclass:circle-of-the-sea": sea,
  "subclass:clockwork-sorcery": clockwork,
  "subclass:wild-magic-sorcery": wildMagic,
  "subclass:aberrant-sorcery": aberrant,
  "subclass:illusionist": illusionist,
  "subclass:abjurer": abjurer,
  "subclass:diviner": diviner,
  "subclass:oath-of-the-ancients": ancients,
  "subclass:oath-of-vengeance": vengeance,
  "subclass:oath-of-glory": glory,
  "subclass:fey-wanderer": feyWanderer,
  "subclass:gloom-stalker": gloomStalker,
  "subclass:beast-master": beastMaster,
  "subclass:celestial-patron": celestial,
  "subclass:great-old-one-patron": greatOldOne,
  "subclass:archfey-patron": archfey,
};
