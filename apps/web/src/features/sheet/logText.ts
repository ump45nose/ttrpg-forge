import type { Build, PlayEvent, Sheet } from "@forge/core";
import { useCallback } from "react";
import { useNames } from "../common/names";
import { coinText } from "./coins";
import { effectName } from "./util";

/** One-line description of a play event, for the log and undo toasts. */
export function useEventText(sheet: Sheet, events: PlayEvent[] = [], build?: Build) {
  const n = useNames();
  const { t, l, engine } = n;
  const entityName = useCallback((id: string) => l(engine.reg.get(id)?.name ?? id, { mono: true }), [engine, l]);
  /** Items can be gone from the sheet by the time the log shows them: look the key up in the add events too. */
  const itemName = useCallback(
    (key: string) => {
      const it = sheet.items.find((i) => i.key === key);
      if (it) return entityName(it.item);
      const added = events.find((x): x is Extract<PlayEvent, { type: "item.add" }> => x.type === "item.add" && x.key === key);
      // granted kit keys look like "background:sage/item:dagger#1"
      return entityName(added?.item ?? build?.inventory.find((i) => i.key === key)?.item ?? key.split("/").pop()!.replace(/#\d+$/, ""));
    },
    [sheet, events, build, entityName],
  );
  return useCallback(
    (e: PlayEvent): string => {
      switch (e.type) {
        case "hp.damage":
          return t("log.damage", { n: e.amount, type: e.damageType ? n.damage(e.damageType) : "" }).trim();
        case "hp.heal":
          return t("log.heal", { n: e.amount });
        case "hp.temp":
          return t("log.temp", { n: e.amount });
        case "hp.set":
          return t("log.hpSet", { n: e.current });
        case "resource.spend":
        case "resource.restore": {
          const r = sheet.resources.find((x) => x.id === e.resource);
          const name = r ? l(r.name, { mono: true }) : e.resource;
          return e.type === "resource.spend" ? t("log.spend", { name, n: e.amount }) : t("log.restore", { name, n: e.amount === "all" ? t("common.all") : e.amount });
        }
        case "slot.spend":
          return t("log.slotSpend", { n: e.level });
        case "slot.restore":
          return t("log.slotRestore", { n: e.level });
        case "hitdie.spend":
          return t("log.hitDie", { die: e.die, n: e.roll ?? "—" });
        case "economy.use":
          return t("log.economy", { slot: t(`sheet.economy.${e.slot}`) });
        case "move":
          return e.feet >= 0 ? t("log.move", { n: e.feet }) : t("log.moveBack", { n: -e.feet });
        case "item.add":
          return t("log.itemAdd", { name: entityName(e.item), n: e.qty });
        case "item.qty":
          return t(e.delta >= 0 ? "log.itemMore" : "log.itemLess", { name: itemName(e.key), n: Math.abs(e.delta) });
        case "item.remove":
          return t("log.itemRemove", { name: itemName(e.key) });
        case "item.equip":
          return t(e.equipped ? "log.equip" : "log.unequip", { name: itemName(e.key) });
        case "trade":
          return t(e.side === "buy" ? "log.buy" : "log.sell", { name: entityName(e.item), n: e.qty, coins: coinText(t, e.delta, true) });
        case "currency":
          return Object.entries(e.delta)
            .filter(([, v]) => v)
            .map(([k, v]) => `${v! > 0 ? "+" : ""}${v} ${t(`coin.${k}`)}`)
            .join(" ");
        case "action.use": {
          const a = sheet.actions.find((x) => x.id === e.action);
          const name = a ? l(a.name, { mono: true }) : e.action.startsWith("item:") ? itemName(e.action.slice(5)) : e.action.split("#").pop()!;
          return e.slotLevel ? t("log.castAt", { name, n: e.slotLevel }) : t("log.use", { name });
        }
        case "effect.add":
          return t("log.effectAdd", { name: l(effectName(engine, sheet, e), { mono: true }) });
        case "effect.remove":
          return t("log.effectRemove", { name: l(effectName(engine, sheet, e), { mono: true }) });
        case "concentration.end":
          return t("log.concEnd");
        case "turn.start":
          return t("log.turn");
        case "combat.start":
          return t("log.combatStart");
        case "combat.end":
          return t("log.combatEnd");
        case "rest":
          return t(`sheet.rest.${e.kind}`);
        case "deathsave":
          return t(`log.death.${e.result}`);
        case "roll":
          return `${e.label ?? e.expr}: ${e.total}`;
        case "note":
          return e.text;
        case "revert":
          return t("common.undone");
      }
    },
    [sheet, t, l, n, engine, entityName, itemName],
  );
}
