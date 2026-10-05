import type { Coin, Currency } from "@forge/core";
import type { useT } from "../../app/i18n";

export const COIN_ORDER: Coin[] = ["pp", "gp", "ep", "sp", "cp"];
export const isCoinItem = (id: string) => COIN_ORDER.some((c) => id === `item:${c}`);

/** "−1 金币 +8 银币", or unsigned "15 金币 5 银币". */
export function coinText(t: ReturnType<typeof useT>, c: Currency, signed = false): string {
  const parts = COIN_ORDER.filter((k) => c[k]).map((k) => `${signed && c[k]! > 0 ? "+" : ""}${c[k]} ${t(`coin.${k}`)}`);
  return parts.length ? parts.join(" ") : `0 ${t("coin.gp")}`;
}
