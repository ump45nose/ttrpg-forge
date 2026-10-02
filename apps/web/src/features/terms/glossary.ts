import { Glossary } from "@forge/core";
import { useMemo } from "react";
import { useEngine } from "../../app/packs";

const cache = new WeakMap<object, Glossary>();

export function useGlossary(): Glossary {
  const engine = useEngine();
  return useMemo(() => {
    let g = cache.get(engine.reg);
    if (!g) cache.set(engine.reg, (g = new Glossary(engine.reg)));
    return g;
  }, [engine]);
}
