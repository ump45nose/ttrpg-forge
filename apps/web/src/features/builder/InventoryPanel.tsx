import { gearIssues, type Currency, type ItemView } from "@forge/core";
import { AlertTriangle, Backpack, Plus, Shield, Sword, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ulid } from "ulid";
import { useT } from "../../app/i18n";
import { haptic } from "../../app/settings";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { useNames } from "../common/names";
import { openCreator, useCanCreate } from "../../app/creator";
import { useUserEntity } from "../../app/packs";
import { Stepper } from "../../ui/Stepper";
import { EntitySearch } from "../common/EntitySearch";
import { Term } from "../terms/Term";
import { useBuilder } from "./state";

const COINS = ["pp", "gp", "ep", "sp", "cp"] as const;
type Coin = (typeof COINS)[number];
const isCoin = (id: string) => COINS.some((c) => id === `item:${c}`);

/** Starting gear beyond the presets: add from the catalog or homebrew, equip, adjust coins. */
export function InventoryPanel() {
  const t = useT();
  const { sheet, build, apply } = useBuilder();
  const canCreate = useCanCreate("item");
  const items = sheet.items.filter((i) => !isCoin(i.item));

  const add = (item: string) => {
    haptic(8);
    apply([{ op: "addItem", entry: { key: ulid(), item, qty: 1 } }]);
  };

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
        <Backpack size={15} className="text-class" />
        {t("inventory.title")}
        <span className="h-px flex-1 bg-line" />
      </h2>
      <p className="mb-3 text-xs text-ink-3">{t("inventory.hint")}</p>

      <Coins granted={sheet.items.filter((i) => isCoin(i.item))} currency={build.currency ?? {}} onChange={(currency) => apply([{ op: "setCurrency", currency }])} />

      <div className="mt-3 space-y-1.5">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <ItemRow key={it.key} it={it} />
          ))}
        </AnimatePresence>
        {!items.length && <p className="py-3 text-center text-sm text-ink-3">{t("inventory.empty")}</p>}
      </div>

      <div className="mt-3 flex gap-2">
        <div className="min-w-0 flex-1">
          <EntitySearch type="item" filter={(id) => !isCoin(id)} onPick={add} placeholder={t("inventory.search")} />
        </div>
        {canCreate && (
          <Button variant="secondary" className="h-11 shrink-0" onClick={() => openCreator({ type: "item", mode: "new", onSaved: (e) => add(e.id) })}>
            <Plus size={15} /> {t("inventory.newItem")}
          </Button>
        )}
      </div>
    </section>
  );
}

function ItemRow({ it }: { it: ItemView }) {
  const t = useT();
  const n = useNames();
  const { apply, sheet } = useBuilder();
  const canEdit = useCanCreate("item");
  const userPack = useUserEntity(it.item);
  const e = it.entity;
  // magic items with mechanics only work while equipped
  const equippable = !!(e?.armor || e?.weapon || e?.grants?.length);
  const Icon = e?.armor ? Shield : e?.weapon ? Sword : Backpack;
  const stat = e?.armor ? (e.armor.category === "shield" ? `AC +${e.armor.ac}` : `AC ${e.armor.ac}`) : e?.weapon ? `${e.weapon.damage} ${n.damage(e.weapon.damageType)}` : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2", it.equipped ? "border-class/50 bg-class/8" : "border-line bg-surface/50")}
    >
      <Icon size={16} className={it.equipped ? "text-class" : "text-ink-3"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm">
          {e ? <Term id={it.item}>{n.l(e.name)}</Term> : <span className="truncate">{it.item}</span>}
          {it.granted && <span className="shrink-0 rounded bg-surface-3 px-1 text-[10px] text-ink-3">{t("inventory.granted")}</span>}
          {userPack && canEdit && (
            <button className="shrink-0 rounded bg-accent/15 px-1 text-[10px] text-accent" onClick={() => e && openCreator({ type: "item", mode: "edit", base: e })}>
              {t("homebrew.local")} ✎
            </button>
          )}
        </span>
        {stat && <span className="block text-xs text-ink-3">{stat}</span>}
        {it.equipped &&
          gearIssues(sheet, it.key).map((p) => (
            <span key={p.code} className="flex items-start gap-1 text-[11px] leading-snug text-warn">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              {n.l(p.message)}
            </span>
          ))}
      </span>
      {equippable && (
        <button
          onClick={() => {
            haptic(6);
            apply([{ op: "setEquipped", key: it.key, equipped: !it.equipped }]);
          }}
          className={cn("h-8 shrink-0 rounded-lg border px-2.5 text-xs transition-colors", it.equipped ? "border-class bg-class text-class-ink" : "border-line text-ink-2 hover:border-line-strong")}
        >
          {e?.armor ? t(it.equipped ? "inventory.equipped" : "inventory.equip") : t(it.equipped ? "inventory.wielded" : "inventory.wield")}
        </button>
      )}
      {it.granted ? (
        <span className="tnum w-7 shrink-0 text-center text-sm text-ink-2">×{it.qty}</span>
      ) : (
        <>
          <Stepper value={it.qty} min={1} onChange={(qty) => apply([{ op: "setItemQty", key: it.key, qty }])} />
          <Button variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => apply([{ op: "removeItem", key: it.key }])}>
            <Trash2 size={14} />
          </Button>
        </>
      )}
    </motion.div>
  );
}

/** Coins: the player edits the total; we store the difference from granted coins. */
function Coins({ granted, currency, onChange }: { granted: ItemView[]; currency: Currency; onChange: (c: Currency) => void }) {
  const t = useT();
  const fromGrants = (c: Coin) => granted.filter((i) => i.item === `item:${c}`).reduce((s, i) => s + i.qty, 0);
  const shown = COINS.filter((c) => c === "gp" || c === "sp" || c === "cp" || fromGrants(c) || currency[c]);
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {shown.map((c) => {
        const g = fromGrants(c);
        const total = g + (currency[c] ?? 0);
        return (
          <label key={c} className={cn("rounded-xl border px-3 py-2", c === "gp" ? "border-warn/40 bg-warn/5" : "border-line bg-surface/50")}>
            <span className="flex items-baseline justify-between text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
              {c}
              {g > 0 && <span className="font-normal normal-case">{t("inventory.grantedGold", { n: g })}</span>}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={total}
              onChange={(ev) => onChange({ [c]: Math.max(0, Number(ev.target.value) || 0) - g })}
              className="tnum w-full bg-transparent text-lg font-semibold text-ink outline-none"
            />
          </label>
        );
      })}
    </div>
  );
}
