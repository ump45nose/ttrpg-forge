import { ABILITIES, type Ability, type FeatureView, type LocalizedText, type Sheet, type SourceKind } from "@forge/core";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { useT } from "../../app/i18n";
import { signed } from "../../ui/AnimatedNumber";
import { cn } from "../../ui/cn";
import { useNames } from "../common/names";
import { RichText } from "../terms/RichText";
import { Term } from "../terms/Term";
import { usePlay } from "./play";
import { d20, edge } from "./util";

/** Features by where they come from, in the order a player reads a sheet. */
const GROUPS: { id: string; kinds: SourceKind[] }[] = [
  { id: "species", kinds: ["species"] },
  { id: "background", kinds: ["background"] },
  { id: "feat", kinds: ["feat"] },
  { id: "class", kinds: ["class", "subclass"] },
];

/**
 * The whole character on one page: who they are, abilities and skills (tap to roll),
 * senses and movement, defences, proficiencies, and every feature grouped by source,
 * so the things that only work when someone remembers them are in plain sight.
 */
export function CharacterPanel() {
  const t = useT();
  const n = useNames();
  const { sheet, roll } = usePlay();
  const check = (a: Ability) => void roll({ expr: d20(sheet.abilities[a].mod), label: t("sheet.checkOf", { name: n.ability(a) }), kind: "check", ...edge(sheet, `check.${a}`) });
  const save = (a: Ability) => void roll({ expr: d20(sheet.abilities[a].save), label: t("sheet.saveOf", { name: n.ability(a) }), kind: "save", ...edge(sheet, `save.${a}`) });
  const skills = Object.entries(sheet.skills).sort(([a], [b]) => n.prof("skill", a).localeCompare(n.prof("skill", b)));

  return (
    <div className="space-y-4">
      <Identity sheet={sheet} />

      <div>
        <div className="grid grid-cols-3 gap-2">
          {ABILITIES.map((a) => {
            const v = sheet.abilities[a];
            return (
              <div key={a} className="overflow-hidden rounded-2xl border border-line bg-surface/70">
                <button type="button" onClick={() => check(a)} aria-label={t("sheet.checkOf", { name: n.ability(a) })} className="block w-full px-2 pt-2 pb-1 text-center transition-colors hover:bg-surface-3/60">
                  <div className="text-[10px] font-semibold tracking-wider text-ink-3 uppercase">{n.ability(a)}</div>
                  <div className="font-display text-xl text-ink">{signed(v.mod)}</div>
                  <div className="tnum text-[11px] text-ink-3">{v.score}</div>
                </button>
                <button
                  type="button"
                  onClick={() => save(a)}
                  aria-label={t("sheet.saveOf", { name: n.ability(a) })}
                  className={cn("flex min-h-8 w-full items-center justify-center gap-1 border-t border-line py-1.5 text-xs transition-colors hover:bg-surface-3/60", v.saveProf ? "text-class" : "text-ink-3")}
                >
                  {v.saveProf && <span className="h-1.5 w-1.5 rounded-full bg-class" />}
                  {t("sheet.saveShort")} <b className="tnum">{signed(v.save)}</b>
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-ink-3">{t("sheet.rollHint")}</p>
      </div>

      <Card title={t("sheet.skills")} aside={<>{t("sheet.passivePerception")} <b className="tnum text-ink">{sheet.skills.perception?.passive ?? 10}</b></>}>
        <div className="-mx-1 grid grid-cols-1 sm:grid-cols-2">
          {skills.map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => void roll({ expr: d20(v.value), label: n.prof("skill", k), kind: "check", ...edge(sheet, `skill.${k}`, `check.${v.ability}`) })}
              className="flex min-h-8 items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-surface-3/60"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full border", v.prof === "expertise" ? "border-class bg-class" : v.prof ? "border-class bg-class/50" : "border-line-strong")} />
              <span className="min-w-0 flex-1 truncate text-ink">{n.prof("skill", k)}</span>
              <span className="text-[10px] text-ink-3 uppercase">{n.abbr(v.ability)}</span>
              <span className="tnum w-8 text-right font-medium text-ink">{signed(v.value)}</span>
            </button>
          ))}
        </div>
      </Card>

      <SensesAndDefences sheet={sheet} />
      <Proficiencies sheet={sheet} />
      <Features sheet={sheet} />
    </div>
  );
}

function Card({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{title}</h3>
        {aside && <span className="text-[11px] text-ink-3">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-16 shrink-0 text-xs leading-5 text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 text-ink-2">{children}</span>
    </div>
  );
}

function Identity({ sheet }: { sheet: Sheet }) {
  const t = useT();
  const n = useNames();
  return (
    <Card title={t("sheet.identity")}>
      <div className="divide-y divide-line/60">
        {sheet.speciesId && (
          <Row label={t("builder.species")}>
            <Term id={sheet.speciesId} plain>
              {n.entity(sheet.speciesId, true)}
            </Term>
            {sheet.size && <span className="text-ink-3"> · {n.l(sheet.size, { mono: true })}</span>}
          </Row>
        )}
        {sheet.backgroundId && (
          <Row label={t("builder.background")}>
            <Term id={sheet.backgroundId} plain>
              {n.entity(sheet.backgroundId, true)}
            </Term>
          </Row>
        )}
        <Row label={t("sheet.classLevel")}>
          {sheet.classes.map((c) => `${n.entity(c.id, true)}${c.subclass ? `（${n.entity(c.subclass, true)}）` : ""} ${c.level}`).join(" / ")}
          <span className="text-ink-3"> · {t("sheet.levelN", { n: sheet.level })}</span>
        </Row>
      </div>
    </Card>
  );
}

const SPEEDS = ["walk", "fly", "swim", "climb"] as const;

/** "adv:save.charmed" → "对抗魅惑的豁免"; anything unknown shows as written. */
function useEdgeLabel() {
  const t = useT();
  const n = useNames();
  return (tag: string): string => {
    const what = tag.slice(4);
    const [kind, key] = what.split(".") as [string, string | undefined];
    const ability = (ABILITIES as readonly string[]).includes(key ?? "") ? n.ability(key as Ability) : undefined;
    if (kind === "save" && key === "concentration") return t("sheet.edge.concentration");
    if (kind === "save") return ability ? t("sheet.saveOf", { name: ability }) : t("sheet.edge.saveAgainst", { name: n.entity(`condition:${key}`, true) || key });
    if (kind === "check") return ability ? t("sheet.checkOf", { name: ability }) : what;
    if (kind === "skill") return n.prof("skill", key ?? "");
    if (kind === "initiative") return t("sheet.initiative");
    if (kind === "attack") return key === "spell" ? t("sheet.spellAttack") : t("sheet.edge.attack");
    return what;
  };
}

function SensesAndDefences({ sheet }: { sheet: Sheet }) {
  const t = useT();
  const n = useNames();
  const edgeLabel = useEdgeLabel();
  const speeds = SPEEDS.filter((k) => sheet.speed[k] > 0).map((k) => `${t(`sheet.speedKind.${k}`)} ${sheet.speed[k]} ${t("common.feet")}`);
  const senses = Object.entries(sheet.senses)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${t(`sheet.sense.${k}`, { defaultValue: k })} ${v} ${t("common.feet")}`);
  const by = (prefix: string) => sheet.tags.filter((x) => x.startsWith(prefix)).map((x) => x.slice(prefix.length));
  // immunities can be conditions (Poisoned) as well as damage types
  const damage = (list: string[]) => list.map((d) => (n.engine.reg.get(`condition:${d}`) ? n.entity(`condition:${d}`, true) : n.damage(d))).join(t("common.listSep"));
  const resist = by("resist:");
  const immune = by("immune:");
  const vuln = by("vuln:");
  const adv = sheet.tags.filter((x) => x.startsWith("adv:"));
  const dis = sheet.tags.filter((x) => x.startsWith("dis:"));
  return (
    <Card title={t("sheet.sensesDefences")}>
      <div className="divide-y divide-line/60">
        <Row label={t("sheet.speed")}>{speeds.join(t("common.listSep")) || "—"}</Row>
        <Row label={t("sheet.senses")}>{senses.length ? senses.join(t("common.listSep")) : t("sheet.noSenses")}</Row>
        {!!resist.length && <Row label={t("sheet.resist")}>{damage(resist)}</Row>}
        {!!immune.length && <Row label={t("sheet.immune")}>{damage(immune)}</Row>}
        {!!vuln.length && <Row label={t("sheet.vuln")}>{damage(vuln)}</Row>}
        {!!adv.length && <Row label={t("sheet.advantageOn")}>{adv.map(edgeLabel).join(t("common.listSep"))}</Row>}
        {!!dis.length && <Row label={t("sheet.disadvantageOn")}>{dis.map(edgeLabel).join(t("common.listSep"))}</Row>}
      </div>
    </Card>
  );
}

function Proficiencies({ sheet }: { sheet: Sheet }) {
  const t = useT();
  const n = useNames();
  const kinds = ["armor", "weapon", "tool", "language"] as const;
  const mastery = sheet.proficiencies.filter((p) => p.kind === "mastery");
  return (
    <Card title={t("sheet.proficiencies")}>
      <div className="divide-y divide-line/60">
        {kinds.map((k) => {
          const list = sheet.proficiencies.filter((p) => p.kind === k);
          if (!list.length) return null;
          return (
            <Row key={k} label={n.profKind(k)}>
              {list.map((p) => n.prof(k, p.key)).join(t("common.listSep"))}
            </Row>
          );
        })}
        {!!mastery.length && (
          <Row label={n.profKind("mastery")}>
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {mastery.map((p) => {
                const e = n.engine.reg.get(p.key);
                const m = e?.type === "item" ? e.weapon?.mastery : undefined;
                return (
                  <span key={p.key}>
                    {n.entity(p.key, true)}
                    {m && (
                      <>
                        {" · "}
                        <Term id={`mastery:${m}`}>{n.entity(`mastery:${m}`, true)}</Term>
                      </>
                    )}
                  </span>
                );
              })}
            </span>
          </Row>
        )}
      </div>
    </Card>
  );
}

function Features({ sheet }: { sheet: Sheet }) {
  const t = useT();
  const n = useNames();
  const used = new Set<FeatureView>();
  const groups = GROUPS.map((g) => {
    const list = sheet.features.filter((f) => g.kinds.includes(f.source.kind));
    list.forEach((f) => used.add(f));
    return { id: g.id, list };
  });
  const other = sheet.features.filter((f) => !used.has(f));
  // a feature is worth a reminder when it, or the action it grants, has to be remembered at the table
  const flagged = (tags?: string[]) => !!tags && (tags.includes("rider") || tags.includes("once-per-turn"));
  const riders = new Set(sheet.actions.filter((a) => flagged(a.tags)).map((a) => n.l(a.name, { mono: true })));
  const remind = (f: FeatureView) => flagged(f.tags) || riders.has(n.l(f.name, { mono: true }));
  return (
    <section className="space-y-3">
      {[...groups, { id: "other", list: other }]
        .filter((g) => g.list.length)
        .map((g) => (
          <div key={g.id}>
            <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{t(`sheet.featureGroup.${g.id}`)}</h3>
            <div className="space-y-1.5">
              {g.list.map((f) => (
                <Feature key={`${f.source.path}/${f.id}`} name={n.l(f.name)} source={n.l(f.source.name, { mono: true })} text={f.text} reminder={remind(f)} />
              ))}
            </div>
          </div>
        ))}
    </section>
  );
}

export function Feature({ name, source, text, reminder }: { name: string; source: string; text?: LocalizedText; reminder?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-surface/60">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
        {reminder && <span className="shrink-0 rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn">{t("sheet.remember")}</span>}
        <span className="max-w-[40%] shrink-0 truncate text-[11px] text-ink-3">{source}</span>
        <ChevronDown size={14} className={cn("shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && text && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <RichText text={text} className="block px-3 pb-3 text-sm leading-relaxed text-ink-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
