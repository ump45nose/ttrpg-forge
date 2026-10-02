import { useEffect, useState } from "react";

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
export const useIsTablet = () => useMediaQuery("(min-width: 768px)");

/**
 * Wraps a confirm handler so it runs once per `key` (a dialog's subject): closing
 * dialogs keep their buttons on screen while they animate out, and a double tap
 * must not spend resources twice.
 */
export function useOnce<A extends unknown[]>(key: unknown, fn: (...args: A) => void): (...args: A) => void {
  const [state] = useState(() => ({ key, done: false }));
  if (state.key !== key) {
    state.key = key;
    state.done = false;
  }
  return (...args: A) => {
    if (state.done) return;
    state.done = true;
    fn(...args);
  };
}
