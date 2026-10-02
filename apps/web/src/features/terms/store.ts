import { create } from "zustand";

/**
 * Open tooltips, Paradox style: level 0 is opened from page text, level n+1
 * from a term inside tooltip n. A tooltip "locks" after the pointer rests on
 * its term for a moment (or on click); only locked tooltips can be entered,
 * which is what makes nesting possible.
 */
export interface TipEntry {
  key: number;
  id: string;
  rect: { left: number; top: number; right: number; bottom: number };
  locked: boolean;
}

interface TermStore {
  tips: TipEntry[];
  /** Touch devices: term card history. */
  sheet: string[];
  open(level: number, id: string, rect: TipEntry["rect"], locked?: boolean): void;
  lock(level: number): void;
  closeFrom(level: number): void;
  push(id: string): void;
  pop(): void;
  closeSheet(): void;
}

let seq = 0;

export const useTerms = create<TermStore>()((set) => ({
  tips: [],
  sheet: [],
  open: (level, id, rect, locked = false) =>
    set((s) => {
      const cur = s.tips[level];
      if (cur && cur.id === id) return { tips: [...s.tips.slice(0, level), { ...cur, locked: cur.locked || locked }] };
      return { tips: [...s.tips.slice(0, level), { key: ++seq, id, rect, locked }] };
    }),
  lock: (level) => set((s) => (s.tips[level] && !s.tips[level]!.locked ? { tips: s.tips.map((t, i) => (i === level ? { ...t, locked: true } : t)) } : s)),
  closeFrom: (level) => set((s) => (s.tips.length > level ? { tips: s.tips.slice(0, level) } : s)),
  push: (id) => set((s) => (s.sheet.at(-1) === id ? s : { sheet: [...s.sheet, id] })),
  pop: () => set((s) => ({ sheet: s.sheet.slice(0, -1) })),
  closeSheet: () => set({ sheet: [] }),
}));

/* Timers live outside React so hover handlers on many terms share one schedule per level. */
const openTimers = new Map<number, ReturnType<typeof setTimeout>>();
const closeTimers = new Map<number, ReturnType<typeof setTimeout>>();
const lockTimers = new Map<number, ReturnType<typeof setTimeout>>();

export const OPEN_DELAY = 250;
export const LOCK_DELAY = 800;
const CLOSE_DELAY = 220;

function clear(m: Map<number, ReturnType<typeof setTimeout>>, level: number) {
  const t = m.get(level);
  if (t) clearTimeout(t);
  m.delete(level);
}

export const termHover = {
  /** Pointer entered a term at nesting `level`. */
  enter(level: number, id: string, el: HTMLElement) {
    // being inside level-1's tooltip (or a term in it) keeps every ancestor open
    for (let l = 0; l <= level; l++) clear(closeTimers, l);
    clear(openTimers, level);
    openTimers.set(
      level,
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        useTerms.getState().open(level, id, { left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        clear(lockTimers, level);
        lockTimers.set(level, setTimeout(() => useTerms.getState().lock(level), LOCK_DELAY));
      }, OPEN_DELAY),
    );
  },
  /** Pointer left a term: unlocked tips vanish fast, locked ones wait for the pointer to arrive. */
  leave(level: number) {
    clear(openTimers, level);
    clear(lockTimers, level);
    const tip = useTerms.getState().tips[level];
    this.scheduleClose(level, tip?.locked ? CLOSE_DELAY : 60);
  },
  click(level: number, id: string, el: HTMLElement) {
    clear(openTimers, level);
    clear(lockTimers, level);
    const r = el.getBoundingClientRect();
    useTerms.getState().open(level, id, { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, true);
  },
  /** Pointer is over tooltip `level`. */
  enterTip(level: number) {
    for (let l = 0; l <= level; l++) clear(closeTimers, l);
  },
  leaveTip(level: number) {
    this.scheduleClose(level, CLOSE_DELAY);
  },
  scheduleClose(level: number, ms: number) {
    clear(closeTimers, level);
    closeTimers.set(
      level,
      setTimeout(() => {
        closeTimers.delete(level);
        useTerms.getState().closeFrom(level);
      }, ms),
    );
  },
  closeAll() {
    for (const m of [openTimers, closeTimers, lockTimers]) {
      for (const t of m.values()) clearTimeout(t);
      m.clear();
    }
    useTerms.getState().closeFrom(0);
  },
};
