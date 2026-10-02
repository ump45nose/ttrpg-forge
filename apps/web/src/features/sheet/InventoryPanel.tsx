import { makeEvent, type Currency, type ItemView, type NewEvent, type ResolvedAction, type Sheet } from "@forge/core";
import { Backpack, Coins as CoinsIcon, Gem, Minus, Plus, Shield, Sparkles, Sword, Trash2, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ulid } from "ulid";
import { openCreator, useCanCreate } from "../../app/creator";
import { useT } from "../../app/i18n";
import { useUserEntity } from "../../app/packs";
import { haptic } from "../../app/settings";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Field";
import { Sheet as Dialog } from "../../ui/Sheet";
import { Tabs } from "../../ui/Tabs";
import { toast } from "../../ui/Toast";
import { EntitySearch } from "../common/EntitySearch";
import { useNames } from "../common/names";
import { RichText } from "../terms/RichText";
import { ActionSheet } from "./ActionSheet";
import { usePlay } from "./play";

const COINS = ["pp", "gp", "ep", "sp", "cp"] as const;
type Coin = (typeof COINS)[number];
const isCoin = (id: string) => COINS.some((c) => id === `item:${c}`);
const MAX_ATTUNED = 3;

const equippable = (it: ItemView) => !!(it.entity?.armor || it.entity?.weapon || it.entity?.grants?.length);
const isBodyArmor = (it: ItemView) => !!it.entity?.armor && it.entity.armor.category !== "shield";
const isShield = (it: ItemView) => it.entity?.armor?.category === "shield";

/** What you carry right now: coins, equipped gear, the backpack; find, use, swap and drop things. */
export function InventoryPanel() {
  const t = useT();
  const { sheet, push } = usePlay();
  const canCreate = useCanCreate("item");
  const [using, setUsing] = useState<ResolvedAction | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const items = sheet.items.filter((i) => !isCoin(i.item));
  const worn = items.filter((i) => i.equipped);
  const pack = items.filter((i) => !i.equipped);
  const attuned = worn.filter((i) => i.entity?.tags?.includes("attunement")).length;
  const weight = items.reduce((w, i) => w + (i.entity?.weight ?? 0) * i.qty, 0);
  const capacity = sheet.abilities.str.score * 15;

  const add = (item: string, qty = 1) => {
    haptic(8);
    push({ type: "item.add", key: ulid(), item, qty });
  };

  return (
    <div className="space-y-4">
      <Purse />

      <div className="flex flex-wrap gap-1.5 text-xs">
        <Chip tone={weight > capacity ? "bad" : "neutral"}>
          {t("inventory.weight")} <span className="tnum">{Math.round(weight * 10) / 10}</span> / <span className="tnum">{capacity}</span> lb
        </Chip>
        {(attuned > 0 || worn.some((i) => i.entity?.tags?.includes("magic"))) && (
          <Chip tone={attuned > MAX_ATTUNED ? "bad" : "magic"} icon={<Gem size={11} />}>
            {t("inventory.attuned", { n: attuned, max: MAX_ATTUNED })}
          </Chip>
        )}
      </div>

      <Group title={t("inventory.equippedGroup")} empty={t("inventory.nothingEquipped")}>
        {worn.map((it) => (
          <ItemRow key={it.key} it={it} onUse={setUsing} onOpen={() => setDetail(it.key)} />
        ))}
      </Group>
      <Group title={t("inventory.backpack")} empty={t("inventory.empty")}>
        {pack.map((it) => (
          <ItemRow key={it.key} it={it} onUse={setUsing} onOpen={() => setDetail(it.key)} />
        ))}
      </Group>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <EntitySearch type="item" filter={(id) => !isCoin(id)} onPick={(id) => add(id)} placeholder={t("inventory.find")} />
        </div>
        {canCreate && (
          <Button variant="secondary" className="h-11 shrink-0" onClick={() => openCreator({ type: "item", mode: "new", onSaved: (e) => add(e.id) })}>
            <Plus size={15} /> {t("inventory.newItem")}
          </Button>
        )}
      </div>

      <ItemDetail itemKey={detail} onClose={() => setDetail(null)} onUse={setUsing} />
      <ActionSheet action={using} onClose={() => setUsing(null)} />
    </div>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section>
      <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{title}</div>
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
        {!children.length && <div className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-xs text-ink-3">{empty}</div>}
      </div>
    </section>
  );
}

/** Stat summary of an item: AC, weapon damage, what using it does. */
function useItemStat() {
  const t = useT();
  const n = useNames();
  return (it: ItemView): string | undefined => {
    const e = it.entity;
    if (!e) return undefined;
    if (e.armor) return e.armor.category === "shield" ? `AC +${e.armor.ac}` : `AC ${e.armor.ac}${e.armor.category === "light" ? " + Dex" : e.armor.category === "medium" ? " + Dex (2)" : ""}`;
    if (e.weapon) return `${e.weapon.damage} ${n.damage(e.weapon.damageType)}${e.weapon.range ? ` · ${e.weapon.range}` : ""}`;
    const u = e.use;
    if (u?.heal) return `♥ ${u.heal.dice}`;
    if (u?.damage?.length) return u.damage.map((d) => `${d.dice} ${n.damage(d.type)}`).join(" + ");
    if (u) return t("inventory.usable");
    return undefined;
  };
}

/** Equip / unequip with a toast showing what changed (AC 14 → 16). */
function useEquip() {
  const t = useT();
  const { sheet, push, engine, character } = usePlay();
  return (it: ItemView) => {
    const on = !it.equipped;
    // one body armor and one shield at a time: wearing a new one takes the old one off
    const unequip = on ? sheet.items.filter((o) => o.key !== it.key && o.equipped && ((isBodyArmor(it) && isBodyArmor(o)) || (isShield(it) && isShield(o)))).map((o) => o.key) : [];
    const ev: NewEvent = { type: "item.equip", key: it.key, equipped: on, ...(unequip.length ? { unequip } : {}) };
    const after = engine.play({ ...character, play: [...character.play, makeEvent(ev)] }).sheet;
    const e = push(ev);
    haptic(6);
    const changes = statChanges(t, sheet, after);
    if (e && changes) toast({ content: changes, tone: "accent", action: { label: t("common.undo"), run: () => push({ type: "revert", target: e.id }) } }, 4500);
  };
}

function statChanges(t: ReturnType<typeof useT>, a: Sheet, b: Sheet): string {
  const out: string[] = [];
  const cmp = (label: string, x: number, y: number) => x !== y && out.push(`${label} ${x} → ${y}`);
  cmp(t("sheet.ac"), a.ac, b.ac);
  cmp(t("sheet.speed"), a.speed.walk, b.speed.walk);
  cmp(t("sheet.hp"), a.hpMax, b.hpMax);
  cmp(t("sheet.spellDC"), a.spellcasting[0]?.dc ?? 0, b.spellcasting[0]?.dc ?? 0);
  const gained = b.actions.filter((x) => !a.actions.some((y) => y.id === x.id)).length;
  const lost = a.actions.filter((x) => !b.actions.some((y) => y.id === x.id)).length;
  if (gained) out.push(t("inventory.actionsGained", { n: gained }));
  if (lost) out.push(t("inventory.actionsLost", { n: lost }));
  return out.join(" · ");
}

function ItemRow({ it, onUse, onOpen }: { it: ItemView; onUse: (a: ResolvedAction) => void; onOpen: () => void }) {
  const t = useT();
  const n = useNames();
  const { sheet, push } = usePlay();
  const stat = useItemStat()(it);
  const equip = useEquip();
  const e = it.entity;
  const use = sheet.actions.find((a) => a.item?.key === it.key);
  const Icon = e?.armor ? Shield : e?.weapon ? Sword : e?.use ? Wand2 : e?.tags?.includes("magic") ? Sparkles : Backpack;
  const magic = e?.tags?.includes("magic");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-2", it.equipped ? "border-class/45 bg-class/8" : "border-line bg-surface/60")}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <Icon size={16} className={cn("shrink-0", it.equipped ? "text-class" : magic ? "text-magic" : "text-ink-3")} />
        <span className="min-w-0">
          <span className={cn("block truncate text-sm", magic ? "text-magic" : "text-ink")}>{e ? n.l(e.name, { mono: true }) : it.item}</span>
          {stat && <span className="tnum block truncate text-[11px] text-ink-3">{stat}</span>}
        </span>
      </button>
      {use && (
        <Button size="sm" variant="primary" className="h-7 shrink-0 px-2 text-xs" onClick={() => onUse(use)}>
          {t("sheet.use")}
        </Button>
      )}
      {e && equippable(it) && (
        <button
          type="button"
          onClick={() => equip(it)}
          className={cn("h-7 shrink-0 rounded-lg border px-2 text-xs transition-colors", it.equipped ? "border-class bg-class text-white" : "border-line text-ink-2 hover:border-line-strong")}
        >
          {it.equipped ? t("inventory.equipped") : t("inventory.equip")}
        </button>
      )}
      <div className="flex shrink-0 items-center">
        <button type="button" aria-label="−1" className="rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink" onClick={() => push({ type: "item.qty", key: it.key, delta: -1 })}>
          <Minus size={13} />
        </button>
        <span className="tnum w-6 text-center text-sm text-ink">{it.qty}</span>
        <button type="button" aria-label="+1" className="rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink" onClick={() => push({ type: "item.qty", key: it.key, delta: 1 })}>
          <Plus size={13} />
        </button>
      </div>
    </motion.div>
  );
}

/** Item card: description, properties, use / equip, customise or drop. */
function ItemDetail({ itemKey, onClose, onUse }: { itemKey: string | null; onClose: () => void; onUse: (a: ResolvedAction) => void }) {
  const t = useT();
  const n = useNames();
  const { sheet, push } = usePlay();
  const canCreate = useCanCreate("item");
  const it = sheet.items.find((i) => i.key === itemKey);
  const e = it?.entity;
  const own = useUserEntity(e?.id);
  const stat = useItemStat();
  const equip = useEquip();
  if (!it || !e) return <Dialog open={false} onOpenChange={onClose}>{null}</Dialog>;
  const use = sheet.actions.find((a) => a.item?.key === it.key);
  const rarity = e.tags?.find((x) => x.startsWith("rarity:"))?.slice(7);

  /** Replace this stack with a customised copy (a +1 sword, a named heirloom...). */
  const customise = () =>
    openCreator({
      type: "item",
      mode: "clone",
      base: e,
      onSaved: (copy) => {
        push({ type: "item.add", key: ulid(), item: copy.id, qty: it.qty, equipped: it.equipped });
        push({ type: "item.remove", key: it.key });
        onClose();
      },
    });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={n.l(e.name)}
      width="md"
      footer={
        <div className="flex flex-wrap gap-2">
          {use && (
            <Button variant="class" className="flex-1" onClick={() => (onClose(), onUse(use))}>
              {t("sheet.use")}
            </Button>
          )}
          {equippable(it) && (
            <Button className="flex-1" onClick={() => equip(it)}>
              {it.equipped ? t("inventory.unequip") : t("inventory.equip")}
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => {
              const ev = push({ type: "item.remove", key: it.key });
              onClose();
              if (ev) toast({ content: t("inventory.dropped", { name: n.l(e.name, { mono: true }) }), action: { label: t("common.undo"), run: () => push({ type: "revert", target: ev.id }) } }, 5000);
            }}
          >
            <Trash2 size={15} /> {t("inventory.drop")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip>{t(`inventory.type.${e.itemType}`, { defaultValue: e.itemType })}</Chip>
          {stat(it) && <Chip tone="class">{stat(it)}</Chip>}
          {rarity && <Chip tone="magic">{t(`workshop.rar.${rarity}`, { defaultValue: rarity })}</Chip>}
          {e.tags?.includes("attunement") && <Chip tone="magic">{t("inventory.needsAttunement")}</Chip>}
          {e.consumable && <Chip tone="warn">{t("inventory.consumable")}</Chip>}
          {e.weapon?.properties.map((p) => (
            <Chip key={p}>{t(`workshop.prop.${p}`, { defaultValue: p })}</Chip>
          ))}
          {e.weight !== undefined && <Chip>{e.weight} lb</Chip>}
          {e.cost && <Chip>{e.cost}</Chip>}
          {it.granted && <Chip>{t("inventory.granted")}</Chip>}
        </div>
        {e.text ? <RichText text={e.text} selfId={e.id} className="text-sm leading-relaxed text-ink-2" /> : <p className="text-sm text-ink-3">{t("inventory.noText")}</p>}
        {!!e.grants?.length && <p className="text-xs text-magic">{t(it.equipped ? "inventory.grantsOn" : "inventory.grantsOff", { n: e.grants.length })}</p>}
        {canCreate && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {own ? (
              <Button size="sm" onClick={() => openCreator({ type: "item", mode: "edit", base: e })}>
                {t("homebrew.edit")}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={customise}>
              <Sparkles size={14} /> {t("inventory.customise")}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** Coins as totals (kit gold + changes); gaining or spending writes one log entry. */
function Purse() {
  const t = useT();
  const { sheet, build, push } = usePlay();
  const [open, setOpen] = useState(false);
  const total = (c: Coin) => sheet.items.filter((i) => i.item === `item:${c}`).reduce((s, i) => s + i.qty, 0) + (build.currency?.[c] ?? 0);
  const shown = COINS.filter((c) => c === "gp" || c === "sp" || c === "cp" || total(c));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-warn/30 bg-warn/5 px-3 py-2.5 text-left transition-colors hover:border-warn/60">
        <CoinsIcon size={18} className="shrink-0 text-warn" />
        <span className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
          {shown.map((c) => (
            <span key={c} className="text-sm">
              <b className="tnum text-ink">{total(c)}</b> <span className="text-xs text-ink-3">{t(`coin.${c}`)}</span>
            </span>
          ))}
        </span>
        <span className="text-xs text-ink-3">±</span>
      </button>
      <PurseSheet open={open} onOpenChange={setOpen} total={total} onApply={(delta) => push({ type: "currency", delta })} />
    </>
  );
}

function PurseSheet({ open, onOpenChange, total, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; total: (c: Coin) => number; onApply: (d: Currency) => void }) {
  const t = useT();
  const [mode, setMode] = useState<"gain" | "spend">("spend");
  const [v, setV] = useState<Partial<Record<Coin, string>>>({});
  const amounts = Object.fromEntries(COINS.map((c) => [c, Number(v[c]) || 0])) as Record<Coin, number>;
  const short = mode === "spend" && COINS.some((c) => amounts[c] > total(c));
  const any = COINS.some((c) => amounts[c] > 0);
  const apply = () => {
    const sign = mode === "spend" ? -1 : 1;
    onApply(Object.fromEntries(COINS.filter((c) => amounts[c]).map((c) => [c, sign * amounts[c]])));
    setV({});
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("inventory.purse")}
      width="sm"
      footer={
        <Button variant={mode === "spend" ? "danger" : "primary"} size="lg" className="w-full" disabled={!any || short} onClick={apply}>
          {t(`inventory.${mode}`)}
        </Button>
      }
    >
      <div className="space-y-3">
        <Tabs
          items={[
            { id: "spend", label: t("inventory.spend") },
            { id: "gain", label: t("inventory.gain") },
          ]}
          value={mode}
          onChange={setMode}
        />
        <div className="grid grid-cols-5 gap-1.5">
          {COINS.map((c) => (
            <label key={c} className="block text-center">
              <span className="text-[11px] font-semibold text-ink-3 uppercase">{t(`coin.${c}`)}</span>
              <Input inputMode="numeric" placeholder="0" value={v[c] ?? ""} onChange={(e) => setV({ ...v, [c]: e.target.value.replace(/\D/g, "") })} className={cn("tnum h-10 px-1 text-center", mode === "spend" && amounts[c] > total(c) && "border-bad/60")} />
              <span className="tnum text-[10px] text-ink-3">{total(c)}</span>
            </label>
          ))}
        </div>
        {short && <p className="text-xs text-bad">{t("inventory.notEnough")}</p>}
      </div>
    </Dialog>
  );
}
