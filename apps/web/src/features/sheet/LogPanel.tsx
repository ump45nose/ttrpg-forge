import { revertedIds, type PlayEvent } from "@forge/core";
import { Dices, Heart, MessageSquareWarning, Moon, RotateCcw, RotateCw, Sparkles, Swords, TimerReset } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui/Button";
import { Textarea } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { toast } from "../../ui/Toast";
import { useT } from "../../app/i18n";
import { useSettings } from "../../app/settings";
import { cn } from "../../ui/cn";
import { useEventText } from "./logText";
import { usePlay } from "./play";

const ICON: Partial<Record<PlayEvent["type"], typeof Dices>> = {
  roll: Dices,
  "hp.damage": Heart,
  "hp.heal": Heart,
  "hp.temp": Heart,
  "action.use": Sparkles,
  "combat.start": Swords,
  "combat.end": Swords,
  "turn.start": TimerReset,
  rest: Moon,
};

/** The play log, newest first. Any entry can be undone or brought back on its own. */
export function LogPanel({ limit }: { limit?: number }) {
  const t = useT();
  const { character } = usePlay();
  const events = character.play.filter((e) => e.type !== "revert");
  return (
    <div className="space-y-2">
      <FeedbackButton />
      {events.length ? <Entries limit={limit} /> : <div className="py-6 text-center text-sm text-ink-3">{t("sheet.logEmpty")}</div>}
    </div>
  );
}

function Entries({ limit }: { limit?: number }) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const { character, sheet, build, toggle } = usePlay();
  const text = useEventText(sheet, character.play, build);
  const reverted = revertedIds(character.play);
  const events = character.play.filter((e) => e.type !== "revert").reverse();
  const shown = limit ? events.slice(0, limit) : events;
  const time = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { hour: "2-digit", minute: "2-digit" });
  return (
    <ol className="space-y-1">
      {shown.map((e) => {
        const off = reverted.has(e.id);
        const Icon = e.type === "note" && e.feedback ? MessageSquareWarning : ICON[e.type];
        const roll = e.type === "roll" ? e : null;
        return (
          <li key={e.id} className={cn("group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-3/40", off && "opacity-45")}>
            <span className="w-4 shrink-0 text-ink-3">{Icon && <Icon size={13} className={e.type === "hp.damage" ? "text-bad" : e.type === "hp.heal" ? "text-good" : undefined} />}</span>
            <span className={cn("min-w-0 flex-1", off && "line-through")}>
              <span className="text-ink">{text(e)}</span>
              {roll?.detail && <span className="tnum ml-1.5 text-xs text-ink-3">{roll.detail}</span>}
            </span>
            <span className="tnum shrink-0 text-[10px] text-ink-3">{time.format(e.at)}</span>
            {e.type !== "roll" && e.type !== "note" && (
              <button type="button" onClick={() => toggle(e.id)} title={off ? t("common.redo") : t("common.undo")} className="shrink-0 rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink">
                {off ? <RotateCw size={13} /> : <RotateCcw size={13} />}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Playtest notes: "this was confusing", "this rule is wrong". Kept in the log with the moment it happened. */
function FeedbackButton() {
  const t = useT();
  const { push } = usePlay();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const save = () => {
    if (!text.trim()) return;
    push({ type: "note", text: text.trim(), feedback: true });
    setText("");
    setOpen(false);
    toast({ content: t("feedback.saved"), tone: "good" });
  };
  return (
    <>
      <Button size="sm" variant="ghost" className="text-ink-3" onClick={() => setOpen(true)}>
        <MessageSquareWarning size={14} /> {t("feedback.button")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("feedback.title")}
        description={t("feedback.hint")}
        width="sm"
        footer={
          <Button variant="primary" size="lg" className="w-full" disabled={!text.trim()} onClick={save}>
            {t("common.save")}
          </Button>
        }
      >
        <Textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("feedback.placeholder")} />
      </Sheet>
    </>
  );
}
