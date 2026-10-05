import {
  actionUseEvent,
  adjustDamage,
  applyOps,
  canUse,
  concentrationDC,
  Engine,
  hpCurrent,
  localize,
  makeEvent,
  movementLeft,
  resourceRemaining,
  restPreview,
  slotsRemaining,
  undoTarget,
  type Character,
  type NewEvent,
  type Sheet,
} from "@forge/core";
import { describe, expect, it } from "vitest";
import { srd52 } from "../src";
import { quickBuild } from "./autofill";

/** A whole simulated encounter, driven only through the events the combat panel emits. */
const engine = new Engine([srd52]);
const named = (s: Sheet, name: string) => s.actions.find((a) => localize(a.name, "en") === name)!;

let t = 1_800_000_000_000;
function table(c: Character) {
  const push = (e: NewEvent) => {
    const ev = makeEvent(e, t++);
    c.play.push(ev);
    return ev;
  };
  return { push, now: () => engine.play(c) };
}

function hero(cls: string, sub: string | undefined, level: number, prefer: Record<string, string[]> = {}): Character {
  const c = engine.newCharacter("Test");
  c.build = quickBuild(engine, cls, sub, level, prefer);
  return c;
}

describe("simulated combat: barbarian", () => {
  it("rage, attacks, movement, damage with resistance, rests", () => {
    const c = hero("class:barbarian", "subclass:path-of-the-berserker", 5);
    const { push, now } = table(c);
    let { sheet, state } = now();
    const hpMax = sheet.hpMax;
    const rages = resourceRemaining(state, sheet, "rage");
    expect(rages).toBe(3);

    push({ type: "combat.start" });
    const rage = named(sheet, "Rage");
    push(actionUseEvent(rage));
    ({ sheet, state } = now());
    expect(state.effects.map((e) => e.effect)).toEqual(["effect:rage"]);
    expect(state.economy.bonus).toBe(true);
    expect(resourceRemaining(state, sheet, "rage")).toBe(rages - 1);
    expect(sheet.tags).toContain("resist:slashing");

    // move, then Dash doubles the budget (Fast Movement: 40 ft)
    push({ type: "move", feet: 30 });
    ({ sheet, state } = now());
    expect(movementLeft(state, sheet)).toEqual({ left: 10, budget: 40 });
    push(actionUseEvent(named(sheet, "Dash")));
    ({ sheet, state } = now());
    expect(movementLeft(state, sheet).left).toBe(50);
    expect(state.economy.action).toBe(true);

    // a second action this turn warns but is allowed
    const weapon = sheet.actions.find((a) => a.weapon)!;
    expect(canUse(weapon, state, sheet).warnings).toHaveLength(1);

    // an orc axe hits: resistance halves slashing damage
    const hit = adjustDamage(sheet, 13, "slashing");
    expect(hit).toEqual({ amount: 6, rule: "resist" });
    expect(adjustDamage(sheet, 13, "fire").amount).toBe(13);
    push({ type: "hp.damage", amount: hit.amount, damageType: "slashing" });
    ({ sheet, state } = now());
    expect(hpCurrent(state, sheet)).toBe(hpMax - 6);

    // next turn: economy and movement reset, Rage (10 minutes) keeps going
    push({ type: "turn.start" });
    ({ sheet, state } = now());
    expect(state.round).toBe(2);
    expect(state.economy).toMatchObject({ action: false, bonus: false, moved: 0, dash: 0 });
    expect(state.effects).toHaveLength(1);

    // the fight ends; a short rest gives back one Rage and lets them spend Hit Dice
    push({ type: "combat.end" });
    ({ sheet, state } = now());
    const short = restPreview(state, sheet, "short");
    expect(short.resources.find((r) => r.id === "rage")).toMatchObject({ from: rages - 1, to: rages });
    expect(short.hp).toBe(0);
    push({ type: "rest", kind: "short" });
    push({ type: "hitdie.spend", die: 12, roll: 7 });
    ({ sheet, state } = now());
    expect(hpCurrent(state, sheet)).toBe(Math.min(hpMax, hpMax - 6 + 7 + sheet.abilities.con.mod));
    expect(resourceRemaining(state, sheet, "hitdie:d12")).toBe(4);

    // a long rest restores everything and ends Rage
    const long = restPreview(state, sheet, "long");
    expect(long.resources.some((r) => r.id === "hitdie:d12")).toBe(true);
    expect(long.effectsEnding.map((e) => e.effect)).toEqual(["effect:rage"]);
    push({ type: "rest", kind: "long" });
    ({ sheet, state } = now());
    expect(hpCurrent(state, sheet)).toBe(hpMax);
    expect(state.effects).toEqual([]);
  });
});

describe("simulated combat: wizard", () => {
  const BOOK = ["spell:magic-missile", "spell:shield", "spell:detect-magic", "spell:sleep", "spell:burning-hands", "spell:mage-armor"];
  function wizard() {
    const c = hero("class:wizard", "subclass:evoker", 5, { "class:wizard@1/spellbook": BOOK });
    c.build = applyOps(c.build, [{ op: "setPrepared", classId: "class:wizard", spells: BOOK }]);
    return c;
  }

  it("upcasting, rituals, Shield, concentration and its checks", () => {
    const c = wizard();
    const { push, now } = table(c);
    let { sheet, state } = now();
    const castable = sheet.actions.filter((a) => a.spell && a.spell.level > 0);
    expect(castable.length).toBeGreaterThan(0);
    push({ type: "combat.start" });

    const mm = castable.find((a) => a.spell!.id === "spell:magic-missile")!;
    push(actionUseEvent(mm, { slotLevel: 2 }));
    ({ sheet, state } = now());
    expect(slotsRemaining(state, sheet)).toEqual([4, 2, 2]);

    // Shield is a reaction that lasts until the start of the next turn
    const shield = castable.find((a) => a.spell!.id === "spell:shield")!;
    const ac = sheet.ac;
    push(actionUseEvent(shield));
    ({ sheet, state } = now());
    expect(sheet.ac).toBe(ac + 5);
    expect(state.economy.reaction).toBe(true);
    push({ type: "turn.start" });
    ({ sheet, state } = now());
    expect(sheet.ac).toBe(ac);

    // a ritual costs no slot and no action
    const detect = castable.find((a) => a.spell!.id === "spell:detect-magic")!;
    {
      const before = slotsRemaining(state, sheet);
      const ev = actionUseEvent(detect, { ritual: true });
      expect(ev).toMatchObject({ costs: [], concentration: true });
      push(ev);
      ({ sheet, state } = now());
      expect(slotsRemaining(state, sheet)).toEqual(before);
      expect(state.concentration?.source).toBe(detect.id);

      // 22 damage: DC 11 Con save; failing it ends concentration
      push({ type: "hp.damage", amount: 22 });
      expect(concentrationDC(22)).toBe(11);
      expect(now().state.concentration).toBeTruthy();
      push({ type: "concentration.end" });
      expect(now().state.concentration).toBeUndefined();

      // concentrate again, then get Stunned: concentration breaks on its own
      push(actionUseEvent(detect, { ritual: true }));
      expect(now().state.concentration).toBeTruthy();
      push({ type: "effect.add", effect: "condition:stunned", rounds: 1 });
      expect(now().state.concentration).toBeUndefined();
    }
  });

  it("dropping to 0 HP ends concentration; damage at 0 is a failed death save; undo skips rolls", () => {
    const c = wizard();
    const { push, now } = table(c);
    const { sheet } = now();
    const sleep = sheet.actions.find((a) => a.spell?.id === "spell:sleep")!;
    push(actionUseEvent(sleep));
    expect(now().state.concentration?.source).toBe(sleep.id);
    push({ type: "hp.damage", amount: 999 });
    let { state } = now();
    expect(hpCurrent(state, sheet)).toBe(0);
    expect(state.concentration).toBeUndefined();
    const hit = push({ type: "hp.damage", amount: 3 });
    push({ type: "roll", expr: "1d20", total: 12, label: "death save" });
    ({ state } = now());
    expect(state.deathSaves.failure).toBe(1);
    expect(undoTarget(c.play)).toBe(hit.id);
  });

  it("long rests remove one level of Exhaustion", () => {
    const c = wizard();
    const { push, now } = table(c);
    const speed = now().sheet.speed.walk;
    push({ type: "effect.add", effect: "condition:exhaustion" });
    push({ type: "effect.add", effect: "condition:exhaustion" });
    expect(now().sheet.speed.walk).toBe(speed - 10);
    push({ type: "rest", kind: "long" });
    expect(now().state.effects.map((e) => e.effect)).toEqual(["condition:exhaustion"]);
    expect(now().sheet.speed.walk).toBe(speed - 5);
  });
});

describe("adventuring inventory", () => {
  it("found, used up, swapped and spent — all through the play log, all undoable", () => {
    const c = hero("class:fighter", "subclass:champion", 3);
    const { push, now } = table(c);
    let { sheet, state } = now();
    const ac = sheet.ac;
    const gp = (s: Sheet) => s.items.filter((i) => i.item === "item:gp").reduce((n, i) => n + i.qty, 0);

    // loot: two potions and a shield
    push({ type: "item.add", key: "loot-potions", item: "item:potion-of-healing", qty: 2 });
    push({ type: "item.add", key: "loot-shield", item: "item:shield", qty: 1 });
    ({ sheet } = now());
    expect(sheet.items.find((i) => i.key === "loot-potions")?.qty).toBe(2);
    const shieldOn = push({ type: "item.equip", key: "loot-shield", equipped: true });
    ({ sheet } = now());
    const hasShield = c.build && engine.evaluate(c.build).sheet.items.some((i) => i.equipped && i.entity?.armor?.category === "shield");
    expect(sheet.ac).toBe(hasShield ? ac : ac + 2);
    push({ type: "revert", target: shieldOn.id });
    expect(now().sheet.ac).toBe(ac);

    // drinking a potion is a bonus action and uses one up
    push({ type: "hp.damage", amount: 10 });
    push({ type: "combat.start" });
    ({ sheet, state } = now());
    const potion = sheet.actions.find((a) => a.item?.key === "loot-potions")!;
    expect(potion.activation).toBe("bonus");
    expect(potion.heal?.dice).toBe("2d4+2");
    const drink = push(actionUseEvent(potion));
    push({ type: "hp.heal", amount: 7 });
    ({ sheet, state } = now());
    expect(sheet.items.find((i) => i.key === "loot-potions")?.qty).toBe(1);
    expect(state.economy.bonus).toBe(true);
    expect(hpCurrent(state, sheet)).toBe(sheet.hpMax - 3);
    push(actionUseEvent(sheet.actions.find((a) => a.item?.key === "loot-potions")!));
    ({ sheet } = now());
    expect(sheet.items.some((i) => i.key === "loot-potions")).toBe(false);
    expect(sheet.actions.some((a) => a.item?.key === "loot-potions")).toBe(false);
    // undoing the first drink brings that potion back
    push({ type: "revert", target: drink.id });
    expect(now().sheet.items.find((i) => i.key === "loot-potions")?.qty).toBe(1);

    // starting-kit stacks can be used up and dropped too
    const kit = now().sheet.items.find((i) => i.granted && i.item !== "item:gp" && i.qty >= 1)!;
    push({ type: "item.qty", key: kit.key, delta: -kit.qty });
    expect(now().sheet.items.some((i) => i.key === kit.key)).toBe(false);

    // coins: spending reduces the purse
    const before = gp(now().sheet) + (now().build.currency?.gp ?? 0);
    push({ type: "currency", delta: { gp: -5 } });
    expect(gp(now().sheet) + (now().build.currency?.gp ?? 0)).toBe(before - 5);
    // the saved build still holds only the starting kit
    expect(c.build.inventory).toEqual([]);
  });

  it("trading: buying and selling move the stack and the coins together, and one undo takes both back", () => {
    const c = hero("class:fighter", "subclass:champion", 3);
    const { push, now } = table(c);
    const coins = () => {
      const s = now();
      const granted = s.sheet.items.filter((i) => i.item === "item:gp").reduce((n, i) => n + i.qty, 0);
      return { gp: granted + (s.build.currency?.gp ?? 0), sp: s.build.currency?.sp ?? 0 };
    };
    const start = coins();
    const buy = push({ type: "trade", side: "buy", key: "shop-rope", item: "item:rope", qty: 2, delta: { gp: -1, sp: 8 } });
    expect(now().sheet.items.find((i) => i.key === "shop-rope")?.qty).toBe(2);
    expect(coins()).toEqual({ gp: start.gp - 1, sp: start.sp + 8 });
    // selling one of them back
    push({ type: "trade", side: "sell", key: "shop-rope", item: "item:rope", qty: 1, delta: { sp: 1 } });
    expect(now().sheet.items.find((i) => i.key === "shop-rope")?.qty).toBe(1);
    // selling the whole stack empties it
    push({ type: "trade", side: "sell", key: "shop-rope", item: "item:rope", qty: 1, delta: { sp: 1 } });
    expect(now().sheet.items.some((i) => i.key === "shop-rope")).toBe(false);
    expect(coins().sp).toBe(start.sp + 10);
    // undoing the purchase takes back the rope and the coins at once (the sales then net out)
    push({ type: "revert", target: buy.id });
    expect(coins().gp).toBe(start.gp);
  });
});
