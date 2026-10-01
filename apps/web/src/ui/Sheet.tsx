import { Dialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "./cn";
import { useIsTablet } from "./hooks";

interface SheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Desktop width. */
  width?: "sm" | "md" | "lg";
}

/** Bottom sheet on phones (drag to dismiss), centred dialog on larger screens. */
export function Sheet({ open, onOpenChange, title, description, children, footer, className, width = "md" }: SheetProps) {
  const wide = useIsTablet();
  if (!wide) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
          <Drawer.Content className={cn("fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[22px] border-t border-line-strong bg-surface-2 outline-none", className)}>
            <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
            {(title || description) && (
              <div className="px-5 pt-2 pb-3">
                {title && <Drawer.Title className="font-display text-lg text-ink">{title}</Drawer.Title>}
                {description && <Drawer.Description className="mt-0.5 text-sm text-ink-2">{description}</Drawer.Description>}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && <div className="safe-b border-t border-line px-5 pt-3 pb-3">{footer}</div>}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" }[width];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className={cn("fixed top-1/2 left-1/2 z-50 flex max-h-[86dvh] w-[calc(100vw-2rem)] flex-col rounded-[22px] border border-line-strong bg-surface-2 shadow-float outline-none", w, className)}
                initial={{ opacity: 0, scale: 0.96, x: "-50%", y: "-46%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.97, x: "-50%", y: "-48%" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                <div className="flex items-start gap-3 px-6 pt-5 pb-3">
                  <div className="min-w-0 flex-1">
                    {title && <Dialog.Title className="font-display text-xl text-ink">{title}</Dialog.Title>}
                    {description && <Dialog.Description className="mt-1 text-sm text-ink-2">{description}</Dialog.Description>}
                  </div>
                  <Dialog.Close className="-mr-2 rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink">
                    <X size={18} />
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
                {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
