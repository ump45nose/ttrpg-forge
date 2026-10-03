import { AlertDialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { create } from "zustand";
import { useT } from "../app/i18n";
import { Button } from "./Button";

interface Ask {
  title: ReactNode;
  body?: ReactNode;
  /** Label of the confirming button (defaults to "OK"). */
  confirmLabel?: string;
  /** "danger" for something that throws work away. */
  tone?: "danger" | "primary";
}

interface ConfirmStore {
  ask: (Ask & { resolve: (ok: boolean) => void }) | null;
}

const useConfirm = create<ConfirmStore>()(() => ({ ask: null }));

/** In-app replacement for window.confirm: resolves true when the user confirms. */
export function confirmDialog(ask: Ask): Promise<boolean> {
  useConfirm.getState().ask?.resolve(false);
  return new Promise((resolve) => useConfirm.setState({ ask: { ...ask, resolve } }));
}

export function ConfirmHost() {
  const t = useT();
  const ask = useConfirm((s) => s.ask);
  const settle = (ok: boolean) => {
    ask?.resolve(ok);
    useConfirm.setState({ ask: null });
  };
  return (
    <AlertDialog.Root open={!!ask} onOpenChange={(o) => !o && settle(false)}>
      <AnimatePresence>
        {ask && (
          <AlertDialog.Portal forceMount>
            <AlertDialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </AlertDialog.Overlay>
            <AlertDialog.Content asChild forceMount>
              <motion.div
                className="fixed top-1/2 left-1/2 z-[70] w-[calc(100vw-2rem)] max-w-sm rounded-[22px] border border-line-strong bg-surface-2 p-5 shadow-float outline-none"
                initial={{ opacity: 0, scale: 0.96, x: "-50%", y: "-46%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.97, x: "-50%", y: "-48%" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                <AlertDialog.Title className="font-display text-lg text-ink">{ask.title}</AlertDialog.Title>
                {ask.body ? <AlertDialog.Description className="mt-2 text-sm whitespace-pre-line text-ink-2">{ask.body}</AlertDialog.Description> : <AlertDialog.Description />}
                <div className="mt-5 flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <Button variant="ghost">{t("common.cancel")}</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <Button variant={ask.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
                      {ask.confirmLabel ?? t("common.confirm")}
                    </Button>
                  </AlertDialog.Action>
                </div>
              </motion.div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}
