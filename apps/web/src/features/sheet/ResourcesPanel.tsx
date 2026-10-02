import { pactRemaining, resourceRemaining, restPreview, slotsRemaining, type RestKind } from "@forge/core";
import { Moon, Sunset } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "../../app/i18n";
import { Button } from "../../ui/Button";
import { Pips } from "../../ui/Pips";
import { Sheet } from "../../ui/Sheet";
import { Tabs } from "../../ui/Tabs";
import { useOnce } from "../../ui/hooks";
import { toast } from "../../ui/Toast";
import { useNames } from "../common/names";
import { usePlay } from "./play";
import { effectName } from "./util";

/** Spell slots, class resources and Hit Dice as tappable pips, plus rests. */
export function ResourcesPanel() {
  const t = useT();
  const n = useNames();
  const { sheet, state, push } = usePlay();
  const [rest, setRest] = useState<RestKind | null>(null);
  const slots = slotsRemaining(state, sheet);
  const features = sheet.resources.filter((r) => r.kind !== "hitdie");
  const hitDice = sheet.resources.filter((r) => r.kind === "hitdie");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={() => setRest("short")}>
          <Sunset size={17} /> {t("sheet.rest.short")}
        </Button>
        <Button size="lg" onClick={() => setRest("long")}>
          <Moon size={17} /> {t("sheet.rest.long")}
        </Button>
      </div>

      {(sheet.slots.some((x) => x > 0) || sheet.pact) && (
        <Section title={t("sheet.slots")}>
          {sheet.slots.map((max, i) =>
            max > 0 ? (
              <Row key={i} label={t("sheet.slot", { n: i + 1 })} right={`${slots[i]}/${max}`}>
                <Pips max={max} remaining={slots[i] ?? 0} tone="magic" onSpend={() => push({ type: "slot.spend", level: i + 1 })} onRestore={() => push({ type: "slot.restore", level: i + 1 })} />
              </Row>
            ) : null,
          )}
          {sheet.pact && (
            <Row label={`${t("sheet.pact")} · ${t("sheet.slot", { n: sheet.pact.level })}`} right={`${pactRemaining(state, sheet)}/${sheet.pact.count}`}>
              <Pips
                max={sheet.pact.count}
                remaining={pactRemaining(state, sheet)}
                tone="magic"
                onSpend={() => push({ type: "slot.spend", level: sheet.pact!.level })}
                onRestore={() => push({ type: "slot.restore", level: sheet.pact!.level })}
              />
            </Row>
          )}
        </Section>
      )}

      {!!features.length && (
        <Section title={t("sheet.tabs.resources")}>
          {features.map((r) => {
            const left = resourceRemaining(state, sheet, r.id);
            return (
              <Row key={r.id} label={n.l(r.name, { mono: true })} hint={r.recovery.map((x) => t(`sheet.recovers.${x.on}`)).join(" · ")} right={`${left}/${r.max}`}>
                <Pips max={r.max} remaining={left} tone="class" onSpend={() => push({ type: "resource.spend", resource: r.id, amount: 1 })} onRestore={() => push({ type: "resource.restore", resource: r.id, amount: 1 })} />
              </Row>
            );
          })}
        </Section>
      )}

      <Section title={t("sheet.hitDice")}>
        {hitDice.map((r) => (
          <HitDieRow key={r.id} id={r.id} />
        ))}
      </Section>

      <RestSheet kind={rest} onClose={() => setRest(null)} />
    </div>
  );
}

function HitDieRow({ id }: { id: string }) {
  const t = useT();
  const { sheet, state, push, roll } = usePlay();
  const r = sheet.resources.find((x) => x.id === id)!;
  const die = Number(id.replace("hitdie:d", ""));
  const left = resourceRemaining(state, sheet, id);
  const spend = async () => {
    const res = await roll({ expr: `1d${die}`, label: `${t("sheet.rest.spendHitDie")} d${die}`, kind: "hitdie" });
    if (res) push({ type: "hitdie.spend", die, roll: res.result.total });
  };
  return (
    <Row label={`d${die}`} hint={t("sheet.hitDieHint", { con: sheet.abilities.con.mod >= 0 ? `+${sheet.abilities.con.mod}` : sheet.abilities.con.mod })} right={`${left}/${r.max}`}>
      <div className="flex items-center gap-3">
        <Pips max={r.max} remaining={left} tone="hp" size="sm" onSpend={() => push({ type: "hitdie.spend", die })} onRestore={() => push({ type: "resource.restore", resource: id, amount: 1 })} />
        <Button size="sm" disabled={left <= 0} onClick={() => void spend()}>
          {t("sheet.rest.spendHitDie")}
        </Button>
      </div>
    </Row>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-3">
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{title}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, right, children }: { label: string; hint?: string; right?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-ink">
          {label}
          {hint && <span className="ml-1.5 text-[11px] text-ink-3">{hint}</span>}
        </span>
        {right && <span className="tnum shrink-0 text-xs text-ink-2">{right}</span>}
      </div>
      {children}
    </div>
  );
}

/** Rest wizard: what will come back, Hit Dice for short rests, then confirm. */
function RestSheet({ kind, onClose }: { kind: RestKind | null; onClose: () => void }) {
  const t = useT();
  const n = useNames();
  const { sheet, state, push, engine } = usePlay();
  const [tab, setTab] = useState<RestKind>("short");
  // opening from the "Long Rest" button selects that tab
  const [opened, setOpened] = useState<RestKind | null>(null);
  if (kind !== opened) {
    setOpened(kind);
    if (kind) setTab(kind);
  }
  const k = tab;
  const open = !!kind;
  const p = restPreview(state, sheet, k);
  const hitDice = sheet.resources.filter((r) => r.kind === "hitdie");
  const confirm = useOnce(kind, () => {
    const e = push({ type: "rest", kind: k });
    if (e) toast({ content: t(`sheet.rest.done.${k}`), tone: "good", action: { label: t("common.undo"), run: () => push({ type: "revert", target: e.id }) } }, 5000);
    onClose();
  });
  const nothing = !p.hp && !p.resources.length && !p.slots.length && !p.pact && !p.effectsEnding.length;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        onClose();
      }}
      title={t("sheet.rest.title")}
      width="sm"
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={confirm}
        >
          {t(`sheet.rest.${k}`)}
        </Button>
      }
    >
      <div className="space-y-4">
        <Tabs
          items={[
            { id: "short", label: t("sheet.rest.short") },
            { id: "long", label: t("sheet.rest.long") },
          ]}
          value={k}
          onChange={setTab}
        />
        <p className="text-sm text-ink-2">{t(k === "short" ? "sheet.rest.shortHint" : "sheet.rest.longHint")}</p>
        {k === "short" && (
          <div className="space-y-3 rounded-2xl border border-line bg-surface/60 p-3">
            {hitDice.map((r) => (
              <HitDieRow key={r.id} id={r.id} />
            ))}
          </div>
        )}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t("sheet.rest.restored")}</div>
          <ul className="space-y-1 text-sm">
            {p.hp > 0 && <Line label={t("sheet.hp")} from={sheet.hpMax - state.damage} to={sheet.hpMax - state.damage + p.hp} />}
            {p.slots.map((s) => (
              <Line key={s.level} label={t("sheet.slot", { n: s.level })} from={s.from} to={s.to} />
            ))}
            {p.pact && <Line label={t("sheet.pact")} from={p.pact.from} to={p.pact.to} />}
            {p.resources.map((r) => (
              <Line key={r.id} label={n.l(r.name, { mono: true })} from={r.from} to={r.to} />
            ))}
            {p.effectsEnding.map((e) => (
              <li key={e.key} className="flex justify-between text-ink-3">
                <span>{n.l(effectName(engine, sheet, e), { mono: true })}</span>
                <span>{t("sheet.rest.ends")}</span>
              </li>
            ))}
            {nothing && <li className="text-ink-3">{t("sheet.rest.nothing")}</li>}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}

const Line = ({ label, from, to }: { label: string; from: number; to: number }) => (
  <li className="flex justify-between gap-2">
    <span className="text-ink">{label}</span>
    <span className="tnum text-ink-2">
      {from} → <b className="text-good">{to}</b>
    </span>
  </li>
);
