import type { Currency } from "../schema/types";

export type Coin = keyof Currency;
/** Value of each coin in copper. */
export const COIN_CP: Record<Coin, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const DESC: Coin[] = ["pp", "gp", "ep", "sp", "cp"];
/** Change is handed back in the everyday coins. */
const CHANGE: Coin[] = ["gp", "sp", "cp"];

export const toCp = (c: Currency): number => DESC.reduce((n, k) => n + (c[k] ?? 0) * COIN_CP[k], 0);

/** Copper as the fewest everyday coins (gp, sp, cp). */
export function fromCp(cp: number): Currency {
  const out: Currency = {};
  let rest = Math.max(0, Math.round(cp));
  for (const k of CHANGE) {
    const n = Math.floor(rest / COIN_CP[k]);
    if (n) out[k] = n;
    rest -= n * COIN_CP[k];
  }
  return out;
}

/** An item's price text ("10 GP", "5 sp", "1,500 GP") as coins; null when there is no price. */
export function parseCost(text: string | undefined): Currency | null {
  const m = /([\d,.]+)\s*(cp|sp|ep|gp|pp)\b/i.exec(text ?? "");
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  const coin = m[2]!.toLowerCase() as Coin;
  // fractional prices (0.5 GP) are worth whole smaller coins
  return Number.isInteger(n) ? { [coin]: n } : fromCp(n * COIN_CP[coin]);
}

export const scaleCurrency = (c: Currency, by: number): Currency => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, (v ?? 0) * by])) as Currency;

/**
 * What leaves (negative) and comes back (positive, as change) when paying `priceCp`
 * from `purse`: the biggest coins that fit go first, and if that still falls short the
 * smallest coin that covers the rest is broken. Null when the purse can't cover it.
 */
export function pay(purse: Currency, priceCp: number): Currency | null {
  if (priceCp <= 0) return {};
  if (toCp(purse) < priceCp) return null;
  const delta: Currency = {};
  const left: Currency = { ...purse };
  let rest = priceCp;
  for (const k of DESC) {
    const use = Math.min(left[k] ?? 0, Math.floor(rest / COIN_CP[k]));
    if (!use) continue;
    delta[k] = -use;
    left[k] = (left[k] ?? 0) - use;
    rest -= use * COIN_CP[k];
  }
  if (rest > 0) {
    // every coin still in the purse is now worth more than what is owed
    const coin = [...DESC].reverse().find((k) => (left[k] ?? 0) > 0)!;
    delta[coin] = (delta[coin] ?? 0) - 1;
    for (const [k, v] of Object.entries(fromCp(COIN_CP[coin] - rest)) as [Coin, number][]) delta[k] = (delta[k] ?? 0) + v;
  }
  for (const k of DESC) if (delta[k] === 0) delete delta[k];
  return delta;
}

/** "15 gp 5 sp" (zero coins left out; "0 gp" for nothing). */
export function formatCurrency(c: Currency): string {
  const parts = DESC.filter((k) => c[k]).map((k) => `${c[k]} ${k}`);
  return parts.length ? parts.join(" ") : "0 gp";
}
