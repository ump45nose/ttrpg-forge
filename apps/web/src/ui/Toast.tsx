import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import { cn } from "./cn";

interface Toast {
  id: number;
  content: ReactNode;
  action?: { label: string; run: () => void };
  tone?: "neutral" | "good" | "bad" | "accent";
}

interface ToastStore {
  toasts: Toast[];
  show(t: Omit<Toast, "id">, ms?: number): void;
  dismiss(id: number): void;
}

let seq = 0;
export const useToasts = create<ToastStore>()((set, get) => ({
  toasts: [],
  show(t, ms = 3200) {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },
}));

export const toast = (t: Omit<Toast, "id">, ms?: number) => useToasts.getState().show(t, ms);

export function ToastViewport() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const covered = useModalOpen();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4",
        // over a drawer, the bottom is its footer buttons: say it at the top instead
        covered ? "top-[calc(env(safe-area-inset-top)+0.75rem)]" : "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:bottom-6",
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
            className="glass pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line-strong px-4 py-2.5 text-sm text-ink shadow-float"
          >
            <div className="min-w-0 flex-1">{t.content}</div>
            {t.action && (
              <button
                className="shrink-0 rounded-lg px-2 py-1 font-semibold text-accent hover:bg-accent/10"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Whether a dialog or drawer is open (they lock page scroll while they are). */
function useModalOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(document.body.hasAttribute("data-scroll-locked"));
    const mo = new MutationObserver(check);
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] });
    check();
    return () => mo.disconnect();
  }, []);
  return open;
}
