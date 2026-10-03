import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useT } from "../app/i18n";
import { useSettings } from "../app/settings";
import { cn } from "./cn";

/** A tip shown until dismissed once (remembered in settings). */
export function Hint({ id, when = true, icon, children, className }: { id: string; when?: boolean; icon?: ReactNode; children: ReactNode; className?: string }) {
  const t = useT();
  const seen = useSettings((s) => s.seenHints.includes(id));
  const set = useSettings((s) => s.set);
  return (
    <AnimatePresence initial={false}>
      {when && !seen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn("overflow-hidden", className)}
        >
          <div className="flex gap-3 rounded-2xl border border-accent/30 bg-accent/[0.06] p-3 text-sm text-ink-2">
            {icon && <span className="mt-0.5 shrink-0 text-accent">{icon}</span>}
            <div className="min-w-0 flex-1 space-y-1">{children}</div>
            <button
              type="button"
              onClick={() => set({ seenHints: [...useSettings.getState().seenHints, id] })}
              aria-label={t("common.close")}
              className="-m-1 h-7 w-7 shrink-0 rounded-lg p-1 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** iOS Safari can install the app only through Share → Add to Home Screen, and never says so. */
export function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}
