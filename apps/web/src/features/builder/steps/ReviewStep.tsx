import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useT } from "../../../app/i18n";
import { Button } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { useNames } from "../../common/names";
import { LiveSheet } from "../LiveSheet";
import { pendingByStep, STEPS, useBuilder, type StepId } from "../state";

export function ReviewStep({ goto }: { goto: (s: StepId) => void }) {
  const t = useT();
  const n = useNames();
  const navigate = useNavigate();
  const { character, sheet, build, issues } = useBuilder();
  const pending = pendingByStep(sheet, build);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity !== "error");
  const todo = STEPS.filter((s) => pending[s] > 0);
  const ready = !todo.length && !errors.length;

  return (
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn("card flex items-center gap-3 p-4", ready ? "border-good/40" : "border-warn/40")}
        >
          {ready ? <CircleCheck className="text-good" /> : <CircleAlert className="text-warn" />}
          <div className="flex-1 font-medium">{ready ? t("builder.review.ready") : t("builder.review.issues")}</div>
        </motion.div>
        {todo.map((s) => (
          <button key={s} onClick={() => goto(s)} className="card flex w-full items-center gap-3 p-3 text-left hover:border-line-strong">
            <TriangleAlert size={16} className="text-warn" />
            <span className="flex-1 text-sm">
              {t(`builder.steps.${s}`)} · {t("builder.pending", { n: pending[s] })}
            </span>
            <ArrowRight size={16} className="text-ink-3" />
          </button>
        ))}
        {[...errors, ...warnings].map((i, k) => (
          <div key={k} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", i.severity === "error" ? "border-bad/30 bg-bad/8 text-bad" : "border-warn/30 bg-warn/8 text-warn")}>
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {n.l(i.message)}
          </div>
        ))}
        <Button variant="class" size="lg" className="w-full" onClick={() => navigate({ to: "/c/$id", params: { id: character.id } })}>
          {t("builder.review.enter")} <ArrowRight size={18} />
        </Button>
        <FeatureSummary />
      </div>
      <div className="card p-4 lg:hidden">
        <LiveSheet showDiff={false} />
      </div>
    </div>
  );
}

function FeatureSummary() {
  const n = useNames();
  const t = useT();
  const { sheet } = useBuilder();
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase">{t("builder.features")}</h3>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {sheet.features.map((f) => (
          <li key={f.id} className="truncate text-sm text-ink-2">
            <span className="text-ink">{n.l(f.name)}</span> <span className="text-xs text-ink-3">· {n.l(f.source.name)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
