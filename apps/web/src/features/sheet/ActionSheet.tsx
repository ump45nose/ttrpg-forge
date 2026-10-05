import { actionUseEvent, canUse, masteryFacts, type Entity, lowestAvailableSlot, pactRemaining, slotsRemaining, type ResolvedAction, type Sheet as SheetData } from "@forge/core";
import { Brain, Crosshair, Dices, HeartPulse, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import { useT } from "../../app/i18n";
import { signed } from "../../ui/AnimatedNumber";
import { ArtImg } from "../../ui/Art";
import { playClip } from "../../app/sound";
import { actionEntityIds, actionSound } from "./actionMedia";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { cn } from "../../ui/cn";
import { Sheet } from "../../ui/Sheet";
import { useOnce } from "../../ui/hooks";
import { toast } from "../../ui/Toast";
import { useNames } from "../common/names";
import { afterLanding, type RollRecord } from "../dice/store";
import { RichText } from "../terms/RichText";
import { Term } from "../terms/Term";
import { useEventText } from "./logText";
import { usePlay } from "./play";
import { basicRule, SLOT_RULE } from "./TurnGuide";
import { d20, edge, effectName } from "./util";
import { AdvToggle } from "../../ui/AdvToggle";

type Edge = "normal" | "adv" | "dis";

/** "1d8+3" + "1d8" → "2d8+3" is not needed: dice strings are simply joined. */
const joinDice = (parts: string[]) => parts.filter(Boolean).join("+").replace(/\+-/g, "-");

/** Extra dice for casting above the spell's level. */
function upcast(base: string | undefined, per: string | undefined, levels: number): string | undefined {
  if (!base) return undefined;
  if (!per || levels <= 0) return base;
  return joinDice([base, ...Array.from({ length: levels }, () => per)]);
}

/** Detail of one action: what it does, rolls, and the confirm that spends its costs. */
export function ActionSheet({ action, onClose }: { action: ResolvedAction | null; onClose: () => void }) {
  // keep showing the last action while the sheet animates closed
  const [last, setLast] = useState(action);
  if (action && action !== last) setLast(action);
  const a = action ?? last;
  return (
    <Sheet open={!!action} onOpenChange={(o) => !o && onClose()} title={a ? <Title action={a} /> : undefined} width="md" footer={a ? <Footer action={a} onClose={onClose} closing={!action} /> : undefined}>
      {a ? <Body action={a} /> : null}
    </Sheet>
  );
}

/** The action's own (or its spell's / item's / feat's) sound, when there is one. */
function playActionSound(action: ResolvedAction, engine: { reg: { get(id: string): Entity | undefined } }) {
  const src = actionSound(action, (id) => engine.reg.get(id));
  if (src) void playClip(src);
}

function Title({ action }: { action: ResolvedAction }) {
  const n = useNames();
  return <span>{n.l(action.name)}</span>;
}

/* Slot level / ritual selection lives in a tiny store shared by body and footer. */
const useCast = create<{ slot?: number; ritual: boolean; set(p: { slot?: number; ritual?: boolean }): void }>()((set) => ({
  slot: undefined,
  ritual: false,
  set: (p) => set(p),
}));

function Body({ action }: { action: ResolvedAction }) {
  const t = useT();
  const n = useNames();
  const { sheet, state, roll, push, engine } = usePlay();
  const cast = useCast();
  const [mode, setMode] = useState<Edge>("normal");
  const [lastAttack, setLastAttack] = useState<RollRecord | null>(null);
  const [lastHeal, setLastHeal] = useState<RollRecord | null>(null);
  const [lastDamage, setLastDamage] = useState<RollRecord | null>(null);
  const spell = action.spell;
  const leveled = !!spell && spell.level > 0;
  const freeCast = action.costs.some((c) => "resource" in c) && leveled;

  // default slot: lowest available at or above the spell's level
  useEffect(() => {
    const slot = leveled && !freeCast ? lowestAvailableSlot(state, sheet, spell!.level) ?? spell!.level : undefined;
    useCast.getState().set({ slot, ritual: false });
    setMode(action.attack ? (edgeMode(sheet, action) ?? "normal") : "normal");
    setLastAttack(null);
    setLastHeal(null);
    setLastDamage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.id]);

  const extra = cast.slot && spell ? cast.slot - spell.level : 0;
  const damage = action.damage?.length ? upcast(joinDice(action.damage.map((d) => d.dice)), spell?.upcastDamage, extra) : undefined;
  const heal = upcast(action.heal?.dice, spell?.upcastHeal, extra);
  const dmgTypes = [...new Set(action.damage?.map((d) => n.damage(d.type)))].join(" / ");
  const name = n.l(action.name, { mono: true });

  const rollAttack = async () => {
    playActionSound(action, engine);
    const r = await roll({ expr: d20(action.attack!.bonus), label: `${name} · ${t("sheet.attackRoll")}`, kind: "attack", advantage: mode === "adv", disadvantage: mode === "dis" });
    if (r) await afterLanding(r);
    if (r) setLastAttack(r);
  };
  const rollDamage = async (expr: string, crit: boolean) => {
    const r = await roll({ expr, label: `${name} · ${t("sheet.damageRoll")}${dmgTypes ? ` (${dmgTypes})` : ""}`, kind: "damage", crit });
    if (r) await afterLanding(r);
    if (r) setLastDamage(r);
  };
  const rollHeal = async () => {
    const r = await roll({ expr: heal!, label: `${name} · ${t("sheet.healing")}`, kind: "heal" });
    if (r) await afterLanding(r);
    if (r) setLastHeal(r);
  };

  const slots = slotsRemaining(state, sheet);
  const pact = sheet.pact;
  const slotChoices = leveled ? Array.from({ length: Math.max(0, slots.length - spell!.level + 1) }, (_, i) => spell!.level + i) : [];
  if (leveled && pact && pact.level >= spell!.level && !slotChoices.includes(pact.level)) slotChoices.push(pact.level);
  const crit = !!lastAttack?.result.crit;

  return (
    <div className="space-y-4">
      <ArtImg id={actionEntityIds(action)} focus={[0.5, 0.35]} className="h-32 rounded-2xl [mask-image:linear-gradient(to_bottom,black_65%,transparent)] sm:h-40" />
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="class">
          {action.activation in SLOT_RULE ? (
            <Term id={SLOT_RULE[action.activation as keyof typeof SLOT_RULE]} plain className="underline decoration-dotted underline-offset-[3px]">
              {n.activation(action.activation)}
            </Term>
          ) : (
            n.activation(action.activation)
          )}
        </Chip>
        {basicRule(action) && (
          <Chip tone="info">
            <Term id={basicRule(action)!} plain className="underline decoration-dotted underline-offset-[3px]">
              {t("sheet.fullRule")}
            </Term>
          </Chip>
        )}
        {spell && <Chip tone="magic">{spell.level ? t("spell.level", { n: spell.level }) : t("spell.cantrip")}</Chip>}
        {action.range && <Chip>{n.l(action.range, { mono: true })}</Chip>}
        {action.duration && <Chip>{n.l(action.duration, { mono: true })}</Chip>}
        {action.concentration && (
          <Chip tone="magic" icon={<Brain size={11} />}>
            {t("sheet.concentration")}
          </Chip>
        )}
        {spell?.ritual && <Chip tone="info">{t("spell.ritual")}</Chip>}
        {action.item && <Chip tone="warn">{t("sheet.carried", { n: action.item.qty })}</Chip>}
        {action.weapon?.properties.map((p) => (
          <Chip key={p}>{t(`workshop.prop.${p}`, { defaultValue: p })}</Chip>
        ))}
      </div>

      {action.weapon?.mastery && <MasteryBox action={action} attacked={!!lastAttack} />}

      {action.trigger && (
        <div className="rounded-xl border border-info/30 bg-info/8 px-3 py-2 text-sm">
          <span className="mr-1 text-xs font-semibold text-info">{t("sheet.trigger")}</span>
          {n.l(action.trigger, { mono: true })}
        </div>
      )}

      {action.text && <RichText text={action.text} selfId={spell?.id} className="text-sm leading-relaxed text-ink-2" />}

      {leveled && (
        <div>
          <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">{t("sheet.castWith")}</div>
          <div className="flex flex-wrap gap-1.5">
            {freeCast && (
              <SlotButton active={cast.slot === undefined && !cast.ritual} onClick={() => cast.set({ slot: undefined, ritual: false })}>
                {t("sheet.freeCast")}
              </SlotButton>
            )}
            {slotChoices.map((lv) => {
              const left = (slots[lv - 1] ?? 0) + (pact && pact.level === lv ? pactRemaining(state, sheet) : 0);
              return (
                <SlotButton key={lv} active={cast.slot === lv && !cast.ritual} disabled={left <= 0} onClick={() => cast.set({ slot: lv, ritual: false })}>
                  {t("sheet.slot", { n: lv })} <span className="tnum opacity-70">×{left}</span>
                </SlotButton>
              );
            })}
            {spell!.ritual && (
              <SlotButton active={cast.ritual} onClick={() => cast.set({ ritual: true, slot: undefined })}>
                {t("spell.ritual")} <span className="opacity-70">+10′</span>
              </SlotButton>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-line bg-surface/60 p-3">
        {action.attack && (
          <div className="flex items-center gap-2">
            <Crosshair size={16} className="shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink">
                {t("sheet.attack")} <b className="tnum">{signed(action.attack.bonus)}</b>
                {lastAttack && <LastRoll rec={lastAttack} />}
              </div>
              <AdvToggle mode={mode} onChange={setMode} className="mt-1.5" />
            </div>
            <Button size="sm" variant="primary" onClick={() => void rollAttack()}>
              <Dices size={14} /> {t("common.roll")}
            </Button>
          </div>
        )}
        {action.save && (
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0 text-warn" />
            <div className="flex-1 text-sm text-ink">
              {t("sheet.save", { ability: n.ability(action.save.ability), dc: action.save.dc })}
              {action.save.onSave === "half" && <span className="ml-1 text-xs text-ink-3">· {t("sheet.halfOnSave")}</span>}
            </div>
          </div>
        )}
        {damage && (
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="shrink-0 text-bad" />
            <div className="min-w-0 flex-1 text-sm text-ink">
              {t("sheet.damage")} <b className="tnum">{damage}</b> <span className="text-xs text-ink-3">{dmgTypes}</span>
              {lastDamage && <LastRoll rec={lastDamage} />}
              {action.weapon?.versatile && (
                <div className="text-xs text-ink-3">
                  {t("sheet.versatile")} <span className="tnum">{action.weapon.versatile}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Button size="sm" variant={crit ? "primary" : "secondary"} onClick={() => void rollDamage(damage, crit)}>
                <Dices size={14} /> {crit ? t("sheet.critDamage") : t("common.roll")}
              </Button>
              {action.weapon?.versatile && (
                <Button size="sm" variant="ghost" onClick={() => void rollDamage(action.weapon!.versatile!, crit)}>
                  {t("sheet.versatile")}
                </Button>
              )}
            </div>
          </div>
        )}
        {heal && (
          <div className="flex items-center gap-2">
            <HeartPulse size={16} className="shrink-0 text-good" />
            <div className="flex-1 text-sm text-ink">
              {t("sheet.healing")} <b className="tnum">{heal}</b>
              {lastHeal && <LastRoll rec={lastHeal} />}
            </div>
            {lastHeal && (
              <Button size="sm" onClick={() => (push({ type: "hp.heal", amount: lastHeal.result.total }), setLastHeal(null))}>
                {t("sheet.healSelf", { n: lastHeal.result.total })}
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => void rollHeal()}>
              <Dices size={14} /> {t("common.roll")}
            </Button>
          </div>
        )}
        {!action.attack && !action.save && !damage && !heal && <div className="text-sm text-ink-3">{t("sheet.noRolls")}</div>}
      </div>
    </div>
  );
}

function edgeMode(sheet: SheetData, a: ResolvedAction): Edge | undefined {
  const keys = a.attack!.kind === "spell" ? ["attack.spell"] : [`attack.${a.attack!.kind}`, a.tags.includes("finesse") ? "" : "attack.str"];
  const e = edge(sheet, ...keys.filter(Boolean));
  return e.advantage && !e.disadvantage ? "adv" : e.disadvantage && !e.advantage ? "dis" : undefined;
}

/** "→ 17" after a roll, green on a crit, red on a natural 1. */
function LastRoll({ rec }: { rec: RollRecord }) {
  const r = rec.result;
  return <b className={cn("tnum ml-2 rounded-md px-1.5 py-0.5 text-sm", r.crit ? "bg-good/15 text-good" : r.fumble ? "bg-bad/15 text-bad" : "bg-surface-3 text-ink")}>→ {r.total}</b>;
}

function SlotButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-35",
        active ? "border-magic/60 bg-magic/15 text-magic" : "border-line text-ink-2 hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

function Footer({ action, onClose, closing }: { action: ResolvedAction; onClose: () => void; closing: boolean }) {
  const t = useT();
  const n = useNames();
  const { sheet, state, push, roll, engine, character, build } = usePlay();
  const describe = useEventText(sheet, character.play, build);
  const cast = useCast();
  const opts = { slotLevel: cast.slot, ritual: cast.ritual };
  const ev = actionUseEvent(action, opts);
  const check = canUse({ ...action, costs: ev.type === "action.use" ? ev.costs : action.costs }, state, sheet, cast.ritual ? undefined : cast.slot);
  const conc = state.concentration;
  const breaks = action.concentration && conc;

  const confirm = useOnce(action, () => {
    const e = push(ev);
    if (!e) return;
    playActionSound(action, engine);
    toast({ content: describe(e), tone: "accent", action: { label: t("common.undo"), run: () => push({ type: "revert", target: e.id }) } }, 5000);
    onClose();
  });
  // Drinking a potion: spend it, roll the healing and apply it in one go.
  const selfHeal = action.item && action.heal;
  const drink = useOnce(action, async () => {
    const e = push(ev);
    if (!e) return;
    playActionSound(action, engine);
    onClose();
    const name = n.l(action.name, { mono: true });
    const r = await roll({ expr: action.heal!.dice, label: `${name} · ${t("sheet.healing")}`, kind: "heal" });
    if (r) await afterLanding(r);
    const h = r ? push({ type: "hp.heal", amount: r.result.total }) : undefined;
    const ids = [e.id, ...(h ? [h.id] : [])];
    toast({ content: h ? `${name} · ${t("log.heal", { n: r!.result.total })}` : describe(e), tone: "accent", action: { label: t("common.undo"), run: () => ids.reverse().forEach((id) => push({ type: "revert", target: id })) } }, 5000);
  });

  return (
    <div className="space-y-2">
      {!closing && [...check.blockers, ...check.warnings].map((w, i) => (
        <div key={i} className={cn("text-xs", i < check.blockers.length ? "text-bad" : "text-warn")}>
          {n.l(w, { mono: true })}
        </div>
      ))}
      {breaks && <div className="text-xs text-magic">{t("sheet.endsConcentration", { name: n.l(effectName(engine, sheet, { effect: state.effects.find((x) => x.key === conc.key)?.effect ?? conc.source, source: conc.source }), { mono: true }) })}</div>}
      {selfHeal ? (
        <div className="flex gap-2">
          <Button variant="class" size="lg" className="flex-1" disabled={!check.ok && !closing} onClick={() => void drink()}>
            <HeartPulse size={16} /> {t("sheet.useOnMe")}
          </Button>
          <Button variant="secondary" size="lg" disabled={!check.ok && !closing} onClick={confirm}>
            {t("sheet.useOnOther")}
          </Button>
        </div>
      ) : (
        <Button variant="class" size="lg" className="w-full" disabled={!check.ok && !closing} onClick={confirm}>
          {action.spell ? t("sheet.cast") : t("sheet.use")}
          <CostSummary action={action} slot={cast.ritual ? undefined : cast.slot} ritual={cast.ritual} />
        </Button>
      )}
    </div>
  );
}

/** "· 1 Rage · level 2 slot" next to the confirm label. */
export function CostSummary({ action, slot, ritual }: { action: ResolvedAction; slot?: number; ritual?: boolean }) {
  const t = useT();
  const n = useNames();
  const { sheet } = usePlay();
  const parts: string[] = [];
  for (const c of action.costs) {
    if ("resource" in c) {
      if (ritual || (slot && action.spell)) continue;
      const r = sheet.resources.find((x) => x.id === c.resource);
      parts.push(`${typeof c.amount === "number" && c.amount > 1 ? c.amount : ""}${r ? n.l(r.name, { mono: true }) : c.resource}`);
    } else if ("slot" in c && !ritual) parts.push(t("sheet.slot", { n: slot ?? c.slot }));
    else if ("item" in c) parts.push(t("sheet.usesUp", { n: c.amount ?? 1 }));
  }
  if (slot && action.spell && !action.costs.some((c) => "slot" in c) && !ritual) parts.push(t("sheet.slot", { n: slot }));
  if (!parts.length) return null;
  return <span className="text-sm font-normal opacity-80">· {parts.join(" · ")}</span>;
}

/**
 * The weapon's mastery property spelled out for this attack: the rule, the numbers it
 * needs (Topple DC, Graze damage), and for Graze a one-tap note after a miss.
 */
function MasteryBox({ action, attacked }: { action: ResolvedAction; attacked: boolean }) {
  const t = useT();
  const n = useNames();
  const { sheet, push } = usePlay();
  const f = masteryFacts(action, sheet);
  if (!f) return null;
  const id = `mastery:${f.id}`;
  const e = n.engine.reg.get(id);
  const facts: string[] = [];
  if (f.save) facts.push(t("sheet.masteryFacts.save", { dc: f.save.dc, ability: n.ability(f.save.ability) }));
  if (f.missDamage) facts.push(t("sheet.masteryFacts.miss", { n: f.missDamage.amount, type: n.damage(f.missDamage.type) }));
  if (f.feet) facts.push(t(`sheet.masteryFacts.${f.id === "push" ? "push" : "slow"}`, { n: f.feet }));
  if (f.nextAttack) facts.push(t(`sheet.masteryFacts.${f.nextAttack}`));
  if (f.extraAttack) facts.push(t(`sheet.masteryFacts.${f.extraAttack}`));
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/6 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs font-semibold text-accent">{t("sheet.mastery")}</span>
        <Term id={id} className="font-medium">
          {n.entity(id, true)}
        </Term>
      </div>
      {!!facts.length && <div className="tnum mt-1 text-sm font-medium text-ink">{facts.join(" · ")}</div>}
      {e?.text && <RichText text={e.text} selfId={id} className="mt-1 block text-xs leading-relaxed text-ink-2" />}
      {f.missDamage && attacked && f.missDamage.amount > 0 && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => {
            push({ type: "note", text: t("sheet.masteryFacts.grazeLog", { name: n.l(action.name, { mono: true }), n: f.missDamage!.amount, type: n.damage(f.missDamage!.type) }) });
            toast({ content: t("sheet.masteryFacts.grazed", { n: f.missDamage!.amount }), tone: "accent" }, 3000);
          }}
        >
          {t("sheet.masteryFacts.grazeButton", { n: f.missDamage.amount })}
        </Button>
      )}
    </div>
  );
}
