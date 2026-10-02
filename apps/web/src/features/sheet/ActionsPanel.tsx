import { canUse, resourceRemaining, type Activation, type ResolvedAction } from "@forge/core";
import { Backpack, Brain, Crosshair, Sparkles, Star, Swords } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useT } from "../../app/i18n";
import { signed } from "../../ui/AnimatedNumber";
import { cn } from "../../ui/cn";
import { Tabs } from "../../ui/Tabs";
import { useNames } from "../common/names";
import { ActionSheet } from "./ActionSheet";
import { usePlay } from "./play";

type Group = "action" | "bonus" | "reaction" | "other";
const GROUP_OF = (a: Activation): Group => (a === "action" || a === "bonus" || a === "reaction" ? a : "other");

const ICON = { attack: Swords, spell: Sparkles, feature: Star, basic: Crosshair, item: Backpack } as const;

/** Ability cards tabbed by activation; "usable now" hides what can't be paid for. */
export function ActionsPanel() {
  const t = useT();
  const { sheet, state } = usePlay();
  const [group, setGroup] = useState<Group>("action");
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<ResolvedAction | null>(null);

  // unequipped weapons stay in the inventory
  const pool = sheet.actions.filter((a) => !a.weapon || a.weapon.equipped);
  const usable = (a: ResolvedAction) => canUse(a, state, sheet).ok;
  const inGroup = (g: Group) => pool.filter((a) => GROUP_OF(a.activation) === g);
  const list = inGroup(group).filter((a) => all || usable(a));
  const leveled = (a: ResolvedAction) => !!a.spell && a.spell.level > 0;
  const main = list.filter((a) => a.category !== "basic" && !leveled(a));
  const spells = list.filter(leveled).sort((a, b) => a.spell!.level - b.spell!.level);
  const basic = list.filter((a) => a.category === "basic");
  const spent = (g: Group) => g !== "other" && state.inCombat && state.economy[g];

  return (
    <div className="space-y-3">
      <Tabs
        size="sm"
        items={(["action", "bonus", "reaction", "other"] as const).map((g) => ({
          id: g,
          label: <span className={cn(spent(g) && "line-through opacity-60")}>{t(`sheet.groups.${g === "other" ? "special" : g}`)}</span>,
          badge: <span className="tnum text-[10px] text-ink-3">{inGroup(g).filter((a) => a.category !== "basic" && (all || usable(a))).length || ""}</span>,
        }))}
        value={group}
        onChange={setGroup}
      />
      <div className="flex justify-end">
        <button type="button" onClick={() => setAll(!all)} className="text-xs text-ink-3 transition-colors hover:text-ink">
          {all ? t("sheet.filter.all") : t("sheet.filter.available")} ⇄
        </button>
      </div>
      {spent(group) && <div className="rounded-xl border border-warn/30 bg-warn/8 px-3 py-2 text-xs text-warn">{t("sheet.alreadyUsed")}</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {main.map((a) => (
          <ActionCard key={a.id} action={a} onOpen={() => setOpen(a)} />
        ))}
      </div>
      {!!spells.length && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-magic uppercase">{t("sheet.tabs.spells")}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {spells.map((a) => (
              <ActionCard key={a.id} action={a} onOpen={() => setOpen(a)} />
            ))}
          </div>
        </div>
      )}
      {!main.length && !basic.length && !spells.length && <div className="py-6 text-center text-sm text-ink-3">{t("sheet.noActions")}</div>}
      {!!basic.length && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("sheet.basicActions")}</div>
          <div className="flex flex-wrap gap-1.5">
            {basic.map((a) => (
              <BasicChip key={a.id} action={a} onOpen={() => setOpen(a)} />
            ))}
          </div>
        </div>
      )}
      <ActionSheet action={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function BasicChip({ action, onOpen }: { action: ResolvedAction; onOpen: () => void }) {
  const n = useNames();
  return (
    <button type="button" onClick={onOpen} className="rounded-lg border border-line bg-surface/60 px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
      {n.l(action.name, { mono: true })}
    </button>
  );
}

/** One ability: name, the numbers you need at the table, and its costs. */
export function ActionCard({ action, onOpen }: { action: ResolvedAction; onOpen: () => void }) {
  const t = useT();
  const n = useNames();
  const { sheet, state } = usePlay();
  const check = canUse(action, state, sheet);
  const Icon = ICON[action.category] ?? Star;
  const stats: string[] = [];
  if (action.spell?.level) stats.push(t("spell.level", { n: action.spell.level }));
  if (action.attack) stats.push(`${signed(action.attack.bonus)} ${t("sheet.toHit")}`);
  if (action.save) stats.push(`DC ${action.save.dc} ${n.abbr(action.save.ability)}`);
  if (action.damage?.length) stats.push(action.damage.map((d) => `${d.dice} ${n.damage(d.type)}`).join(" + "));
  if (action.heal) stats.push(`♥ ${action.heal.dice}`);

  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      className={cn(
        "flex min-w-0 items-start gap-2.5 rounded-2xl border bg-surface/70 p-3 text-left transition-colors",
        check.ok ? "border-line hover:border-class/50" : "border-line opacity-50",
      )}
    >
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border", action.category === "spell" ? "border-magic/40 bg-magic/10 text-magic" : "border-class/40 bg-class/10 text-class")}>
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-medium text-ink">{n.l(action.name, { mono: true })}</span>
          {action.concentration && <Brain size={12} className="shrink-0 text-magic" />}
        </span>
        {!!stats.length && <span className="tnum block truncate text-xs text-ink-2">{stats.join(" · ")}</span>}
        {action.trigger && <span className="block truncate text-[11px] text-info">{n.l(action.trigger, { mono: true })}</span>}
        <Costs action={action} />
      </span>
    </motion.button>
  );
}

/** Resource costs with uses left, e.g. "Rage 2/3". */
export function Costs({ action }: { action: ResolvedAction }) {
  const n = useNames();
  const { sheet, state } = usePlay();
  const res = action.costs.filter((c): c is { resource: string; amount?: number } => "resource" in c);
  if (action.item?.consumable) {
    return <span className="tnum mt-1 inline-block rounded-md border border-warn/30 bg-warn/10 px-1.5 text-[10px] leading-4 text-warn">×{action.item.qty}</span>;
  }
  if (!res.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {res.map((c) => {
        const r = sheet.resources.find((x) => x.id === c.resource);
        if (!r) return null;
        const left = resourceRemaining(state, sheet, r.id);
        const amt = typeof c.amount === "number" ? c.amount : 1;
        return (
          <span key={r.id} className={cn("tnum rounded-md border px-1.5 text-[10px] leading-4", left >= amt ? "border-accent/30 bg-accent/10 text-accent" : "border-bad/30 bg-bad/10 text-bad")}>
            {amt > 1 ? `${amt}× ` : ""}
            {n.l(r.name, { mono: true })} {left}/{r.max}
          </span>
        );
      })}
    </span>
  );
}
