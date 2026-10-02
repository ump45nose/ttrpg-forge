import { keyName, type Ability, type Activation, type ProficiencyKind } from "@forge/core";
import { useCallback } from "react";
import { useL, useT } from "../../app/i18n";
import { useEngine } from "../../app/packs";

/** Display names for ids, keys and enums in the current locale. */
export function useNames() {
  const t = useT();
  const l = useL();
  const engine = useEngine();
  const entity = useCallback((id: string | undefined, mono = false) => (id ? l(engine.reg.get(id)?.name ?? id, { mono }) : ""), [engine, l]);
  const prof = useCallback(
    (kind: string, key: string) => (kind === "save" ? t(`ability.${key}`) : l(keyName(engine.reg, undefined, kind, key), { mono: true })),
    [engine, l, t],
  );
  const ability = useCallback((a: Ability) => t(`ability.${a}`), [t]);
  const abbr = useCallback((a: Ability) => t(`abbr.${a}`), [t]);
  const damage = useCallback((d: string) => t(`damage.${d}`, { defaultValue: d }), [t]);
  const activation = useCallback((a: Activation) => t(`activation.${a}`), [t]);
  const profKind = useCallback((k: ProficiencyKind) => t(`profKind.${k}`), [t]);
  return { entity, prof, ability, abbr, damage, activation, profKind, l, t, engine };
}
