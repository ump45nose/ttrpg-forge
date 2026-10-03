import type { ClassEntity, Entity } from "@forge/core";
import { Minus, Plus } from "lucide-react";
import { useT } from "../../../app/i18n";
import { AnimatedNumber } from "../../../ui/AnimatedNumber";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { GrantList } from "../../common/GrantList";
import { useNames } from "../../common/names";
import { LevelTimeline } from "../ChoiceBlock";
import { EntityPicker } from "../EntityPicker";
import { useBuilder } from "../state";

export function ClassStep() {
  const { build } = useBuilder();
  return (
    <EntityPicker
      type="class"
      current={build.levels[0]?.classId}
      opsFor={(id) => [{ op: "setClass", id }]}
      lead={(e, cur) => cur && e.type === "class" && <LevelPicker e={e} />}
      showcase={(e, cur) => <ClassShowcase e={e} isCurrent={cur} />}
    />
  );
}

/** Highest level the loaded content defines for a class. */
export function maxLevelOf(c: ClassEntity): number {
  return Math.max(1, ...Object.keys(c.levels).map(Number));
}

function ClassShowcase({ e, isCurrent }: { e: Entity; isCurrent: boolean }) {
  const t = useT();
  const n = useNames();
  const { build } = useBuilder();
  if (e.type !== "class") return null;
  const saves = e.starting.flatMap((g) => (g.type === "proficiency" && g.kind === "save" ? [g.key] : []));
  const level = build.levels.length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="class">
          {t("builder.hitDie")} d{e.hitDie}
        </Chip>
        <Chip>
          {t("builder.primary")} · {e.primaryAbility.map((a) => n.ability(a)).join(" / ")}
        </Chip>
        <Chip>
          {t("builder.saves")} · {saves.map((a) => n.ability(a as never)).join(" / ")}
        </Chip>
        <Chip>{t("builder.subclassAt", { n: e.subclassLevel })}</Chip>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase">{t("common.levelN", { n: 1 })}</h3>
        <GrantList grants={e.starting} dense />
      </div>
      <div>
        <h3 className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase">{t("builder.features")}</h3>
        <div className="pl-3">
          <LevelTimeline levels={e.levels} highlight={isCurrent ? level : 0} />
        </div>
      </div>
    </div>
  );
}

/** Level for the chosen class, right under its title. */
function LevelPicker({ e }: { e: ClassEntity }) {
  const t = useT();
  const { build, apply, engine } = useBuilder();
  const level = build.levels.length;
  const contentMax = maxLevelOf(e);
  const max = Math.min(engine.reg.system.maxLevel, contentMax);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-class/30 bg-class/8 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{t("builder.level")}</div>
        <div className="text-xs text-ink-3">
          1 – {max}
          {contentMax < engine.reg.system.maxLevel && ` · ${t("builder.contentTo", { n: contentMax })}`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="icon-sm" disabled={level <= 1} onClick={() => apply([{ op: "setLevel", level: level - 1 }])} aria-label={t("builder.levelDown")}>
          <Minus size={16} />
        </Button>
        <AnimatedNumber value={level} className="w-8 text-center font-display text-2xl" />
        <Button variant="secondary" size="icon-sm" disabled={level >= max} onClick={() => apply([{ op: "setLevel", level: level + 1 }])} aria-label={t("builder.levelUp")}>
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
