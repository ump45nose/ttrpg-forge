import { parseCost, pay, toCp, type Currency, type ItemEntity, type ItemView } from "@forge/core";
import { Coins as CoinsIcon, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ulid } from "ulid";
import { useT } from "../../app/i18n";
import { useEngine } from "../../app/packs";
import { haptic } from "../../app/settings";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Field";
import { Sheet as Dialog } from "../../ui/Sheet";
import { Stepper } from "../../ui/Stepper";
import { Tabs } from "../../ui/Tabs";
import { toast } from "../../ui/Toast";
import { EntitySearch } from "../common/EntitySearch";
import { useNames } from "../common/names";
import { coinText, COIN_ORDER, isCoinItem } from "./coins";
import { usePlay } from "./play";
import { restock, SHOPS, shopCommon } from "./shops";

const ALL = COIN_ORDER;
/** Prices are agreed in the everyday coins. */
const PRICE_COINS = ["gp", "sp", "cp"] as const;
type PriceCoin = (typeof PRICE_COINS)[number];

/** Coins on hand: the kit's gold items plus everything gained or spent since. */
export function usePurse(): Currency {
  const { sheet, build } = usePlay();
  return Object.fromEntries(ALL.map((c) => [c, sheet.items.filter((i) => i.item === `item:${c}`).reduce((s, i) => s + i.qty, 0) + (build.currency?.[c] ?? 0)])) as Currency;
}

const add = (a: Currency, b: Currency): Currency => Object.fromEntries(ALL.map((k) => [k, (a[k] ?? 0) + (b[k] ?? 0)])) as Currency;

export type Deal = { side: "buy" } | { side: "sell"; it: ItemView };

/** Which shop was open last and what each one has in stock (this device only). */
const useShops = create<{ shop: string; stock: Record<string, string[]>; set: (p: Partial<{ shop: string; stock: Record<string, string[]> }>) => void }>()(
  persist((set) => ({ shop: SHOPS[0]!.id, stock: {}, set: (p) => set(p) }), { name: "forge.shops" }),
);

/**
 * Buying and selling at the counter: the list price is the starting offer and can be
 * changed (haggling, a generous DM). One trade is one log entry, so one undo.
 */
export function ShopSheet({ deal, onClose }: { deal: Deal | null; onClose: () => void }) {
  const t = useT();
  const n = useNames();
  const engine = useEngine();
  const { push } = usePlay();
  const purse = usePurse();
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  // the price as typed; null = follow the list price
  const [typed, setTyped] = useState<{ amount: string; coin: PriceCoin } | null>(null);

  const sell = deal?.side === "sell" ? deal.it : null;
  const id = sell ? sell.item : itemId;
  const entity = id ? engine.reg.getOf("item", id) : undefined;
  const list = parseCost(entity?.cost);

  useEffect(() => {
    setItemId(null);
    setQty(1);
    setTyped(null);
  }, [deal]);

  // the list price for this many, in the coin it is quoted in
  const listCoin = (list && (PRICE_COINS.find((c) => list[c]) ?? "gp")) || "gp";
  const listAmount = list ? Math.round((toCp(list) * qty) / ({ gp: 100, sp: 10, cp: 1 } as const)[listCoin]) : undefined;
  const coin = typed?.coin ?? listCoin;
  const amount = typed ? Number(typed.amount) || 0 : (listAmount ?? 0);
  const price: Currency = amount ? { [coin]: amount } : {};
  const delta = sell ? price : pay(purse, toCp(price));
  const after = delta ? add(purse, delta) : null;
  const ready = !!entity && amount > 0 && !!delta;
  const name = entity ? n.l(entity.name, { mono: true }) : "";

  const commit = () => {
    if (!ready || !entity) return;
    const key = sell ? sell.key : ulid();
    const ev = push({ type: "trade", side: sell ? "sell" : "buy", key, item: entity.id, qty, delta: delta! });
    haptic(10);
    onClose();
    if (ev)
      toast(
        { content: t(sell ? "shop.sold" : "shop.bought", { name, n: qty, price: coinText(t, price) }), tone: "good", action: { label: t("common.undo"), run: () => push({ type: "revert", target: ev.id }) } },
        6000,
      );
  };

  return (
    <Dialog
      open={!!deal}
      onOpenChange={(o) => !o && onClose()}
      title={sell ? t("shop.sellTitle", { name }) : t("shop.title")}
      width="sm"
      footer={
        <Button variant={sell ? "primary" : "class"} size="lg" className="w-full" disabled={!ready} onClick={commit}>
          <CoinsIcon size={16} /> {t(sell ? "shop.confirmSell" : "shop.confirmBuy", { price: amount ? coinText(t, price) : "—" })}
        </Button>
      }
    >
      <div className="space-y-4">
        {!sell && !entity && (
          <>
            <EntitySearch type="item" filter={(x) => !isCoinItem(x)} onPick={setItemId} placeholder={t("shop.find")} meta={(e) => (e.type === "item" ? e.cost : undefined)} />
            <Shelves onPick={setItemId} />
          </>
        )}
        {entity && (
          <div className="flex items-start gap-3 rounded-xl border border-line bg-surface/60 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{name}</div>
              <div className="text-xs text-ink-3">{list ? t("shop.listPrice", { price: coinText(t, list) }) : t("shop.noPrice")}</div>
            </div>
            {!sell && (
              <Button variant="ghost" size="sm" onClick={() => (setItemId(null), setTyped(null), setQty(1))}>
                {t("shop.another")}
              </Button>
            )}
          </div>
        )}
        {entity && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-2">{t("shop.qty")}</span>
              <Stepper value={qty} min={1} onChange={(q) => setQty(sell ? Math.min(sell.qty, q) : q)} />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm text-ink-2">{t("shop.price")}</span>
                <span className="text-xs text-ink-3">{t("shop.haggle")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 shrink-0">
                  <Input
                    inputMode="numeric"
                    aria-label={t("shop.price")}
                    value={typed ? typed.amount : listAmount !== undefined ? String(listAmount) : ""}
                    placeholder="0"
                    onChange={(e) => setTyped({ amount: e.target.value.replace(/\D/g, ""), coin })}
                    className="tnum text-center"
                  />
                </div>
                <Tabs size="sm" className="min-w-0 flex-1" items={PRICE_COINS.map((c) => ({ id: c, label: t(`coin.${c}`) }))} value={coin} onChange={(c) => setTyped({ amount: typed?.amount ?? String(amount || ""), coin: c })} />
              </div>
              {typed && listAmount !== undefined && (
                <button type="button" onClick={() => setTyped(null)} className="mt-1.5 text-xs text-accent hover:underline">
                  {t("shop.backToList")}
                </button>
              )}
            </div>
            <div className={cn("rounded-xl px-3 py-2 text-sm", after ? "bg-surface-2 text-ink-2" : "bg-bad/10 text-bad")}>
              {after ? t("shop.after", { purse: coinText(t, after) }) : t("inventory.notEnough")}
            </div>
          </>
        )}
        {!entity && <p className="text-xs text-ink-3">{t("shop.purse", { purse: coinText(t, purse) })}</p>}
      </div>
    </Dialog>
  );
}

/** Browsing a shop: its everyday goods, plus a random stock that changes when restocked. */
function Shelves({ onPick }: { onPick: (id: string) => void }) {
  const t = useT();
  const n = useNames();
  const engine = useEngine();
  const { shop: shopId, stock, set } = useShops();
  const shop = SHOPS.find((s) => s.id === shopId) ?? SHOPS[0]!;
  const common = useMemo(() => shopCommon(engine.reg, shop), [engine, shop]);
  const random = (stock[shop.id] ?? []).map((id) => engine.reg.getOf("item", id)).filter((e): e is ItemEntity => !!e);
  const reroll = () => set({ stock: { ...useShops.getState().stock, [shop.id]: restock(engine.reg, shop) } });
  // a shop opened for the first time has something in the back already
  useEffect(() => {
    if (!useShops.getState().stock[shop.id]) reroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id]);

  return (
    <div className="space-y-4">
      <Tabs size="sm" items={SHOPS.map((s) => ({ id: s.id, label: n.l(s.name, { mono: true }) }))} value={shop.id} onChange={(v) => set({ shop: v })} />
      <ShelfList
        title={t("shop.randomStock")}
        items={random}
        onPick={onPick}
        empty={t("shop.soldOut")}
        action={
          <Button variant="ghost" size="sm" onClick={() => (haptic(8), reroll())}>
            <RefreshCw size={14} /> {t("shop.restock")}
          </Button>
        }
      />
      <ShelfList title={t("shop.everyday")} items={common} onPick={onPick} />
    </div>
  );
}

function ShelfList({ title, items, onPick, action, empty }: { title: string; items: ItemEntity[]; onPick: (id: string) => void; action?: React.ReactNode; empty?: string }) {
  const t = useT();
  const n = useNames();
  return (
    <section>
      <div className="mb-1.5 flex min-h-8 items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{title}</h3>
        {action}
      </div>
      {items.length ? (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {items.map((e) => {
            const price = parseCost(e.cost);
            return (
              <button key={e.id} type="button" onClick={() => onPick(e.id)} className="flex min-h-11 w-full items-center gap-3 bg-surface/50 px-3 py-2 text-left hover:bg-surface-3">
                <span className={cn("min-w-0 flex-1 truncate text-sm", e.tags?.includes("magic") ? "text-magic" : "text-ink")}>{n.l(e.name, { mono: true })}</span>
                <span className="tnum shrink-0 text-xs text-ink-2">{price ? coinText(t, price) : "—"}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-xs text-ink-3">{empty}</p>
      )}
    </section>
  );
}
