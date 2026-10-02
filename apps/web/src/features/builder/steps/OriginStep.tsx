import type { Entity } from "@forge/core";
import { motion } from "motion/react";
import { useState } from "react";
import { useT } from "../../../app/i18n";
import { CountBadge } from "../../../ui/Badge";
import { Chip } from "../../../ui/Chip";
import { Tabs } from "../../../ui/Tabs";
import { GrantList } from "../../common/GrantList";
import { useNames } from "../../common/names";
import { ChoiceBlock } from "../ChoiceBlock";
import { EntityPicker } from "../EntityPicker";
import { stepOfChoice, useBuilder } from "../state";

type Sub = "background" | "species";

export function OriginStep() {
  const t = useT();
  const { build, sheet } = useBuilder();
  const [sub, setSub] = useState<Sub>(build.backgroundId && !build.speciesId ? "species" : "background");
  const current = sub === "background" ? build.backgroundId : build.speciesId;
  const choices = sheet.choices.filter(
    (c) => stepOfChoice(c.path, c.choice.from.kind) === "origin" && ((current && c.path.startsWith(current)) || (sub === "species" && c.path.startsWith("global/"))),
  );
  const badge = (s: Sub) => {
    const id = s === "background" ? build.backgroundId : build.speciesId;
    const pend = sheet.choices.filter((c) => c.remaining > 0 && stepOfChoice(c.path, c.choice.from.kind) === "origin" && ((id && c.path.startsWith(id)) || (s === "species" && c.path.startsWith("global/")))).length;
    return !id ? 1 : pend;
  };

  return (
    <div className="space-y-5">
      <Tabs
        items={(["background", "species"] as const).map((s) => ({ id: s, label: t(`builder.${s}`), badge: <CountBadge n={badge(s)} /> }))}
        value={sub}
        onChange={setSub}
      />
      <EntityPicker
        key={sub}
        type={sub}
        current={current}
        opsFor={(id) => [sub === "background" ? { op: "setBackground", id } : { op: "setSpecies", id }]}
        showcase={(e) => <OriginShowcase e={e} />}
        editable
      />
      {choices.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {choices.map((c) => (
            <ChoiceBlock key={c.path} ch={c} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function OriginShowcase({ e }: { e: Entity }) {
  const t = useT();
  const n = useNames();
  return (
    <div className="space-y-3">
      {e.type === "species" && (
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="class">{n.l(e.size)}</Chip>
          <Chip>
            {t("sheet.speed")} {t("common.ft", { n: e.speed })}
          </Chip>
        </div>
      )}
      <GrantList grants={e.grants} />
    </div>
  );
}
