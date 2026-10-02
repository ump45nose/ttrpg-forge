import type { Build, Currency, PlayEvent } from "../schema/types";
import { effectiveEvents } from "./index";

/**
 * The build as it stands after play: items found, dropped, consumed or swapped,
 * and coins spent. The saved build keeps the starting kit; the play log holds the
 * changes, so they show in the log and can be undone like everything else.
 */
export function foldInventory(build: Build, events: PlayEvent[]): Build {
  let out: Build | undefined;
  const edit = () => (out ??= { ...build, inventory: [...build.inventory], equipped: { ...build.equipped }, itemDelta: { ...build.itemDelta }, currency: { ...build.currency } });
  // stack sizes change through a per-key delta, whether the stack came from the kit or from play
  const bump = (key: string, delta: number) => {
    const d = edit().itemDelta!;
    d[key] = (d[key] ?? 0) + delta;
  };
  for (const e of effectiveEvents(events)) {
    switch (e.type) {
      case "item.add": {
        const b = edit();
        const cur = b.inventory.find((i) => i.key === e.key);
        if (cur) bump(e.key, e.qty);
        else b.inventory.push({ key: e.key, item: e.item, qty: e.qty, ...(e.equipped ? { equipped: true } : {}) });
        break;
      }
      case "item.qty":
        bump(e.key, e.delta);
        break;
      case "item.remove": {
        const b = edit();
        b.inventory = b.inventory.filter((i) => i.key !== e.key);
        b.itemDelta![e.key] = -1e9;
        break;
      }
      case "item.equip": {
        const b = edit();
        for (const k of e.unequip ?? []) b.equipped[k] = false;
        b.equipped[e.key] = e.equipped;
        break;
      }
      case "currency": {
        const b = edit();
        for (const [k, v] of Object.entries(e.delta) as [keyof Currency, number][]) b.currency![k] = (b.currency![k] ?? 0) + v;
        break;
      }
      case "action.use":
        for (const c of e.costs) if ("item" in c) bump(c.item, -(c.amount ?? 1));
        break;
      default:
        break;
    }
  }
  return out ?? build;
}
