import { DatabaseBackup, HardDrive, MessageSquareWarning, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadBackup, downloadText, feedbackNotes, readBackup, restoreBackup, storageStatus, type Backup } from "../../app/backup";
import { useCharacters } from "../../app/characters";
import { useT } from "../../app/i18n";
import { useSettings } from "../../app/settings";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { useOnce } from "../../ui/hooks";
import { Sheet } from "../../ui/Sheet";
import { toast } from "../../ui/Toast";

/** Back up / restore everything on this device, and whether the browser may evict it. */
export function DataSection({ count, packCount }: { count: number; packCount: number }) {
  const t = useT();
  const lastBackup = useSettings((s) => s.lastBackup);
  const locale = useSettings((s) => s.locale);
  const fileRef = useRef<HTMLInputElement>(null);
  const byId = useCharacters((s) => s.byId);
  const notes = feedbackNotes(Object.values(byId));
  const [status, setStatus] = useState<{ persisted: boolean | null; usage?: number } | null>(null);
  const [pending, setPending] = useState<{ backup: Backup; skipped: number } | null>(null);
  useEffect(() => {
    void storageStatus().then(setStatus);
  }, []);
  const date = (ts: number) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(ts);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <HardDrive size={16} className="text-ink-3" />
        {status?.persisted === true && <Chip tone="good">{t("backup.persisted")}</Chip>}
        {status?.persisted === false && <Chip tone="warn">{t("backup.notPersisted")}</Chip>}
        {status?.usage !== undefined && <span className="text-xs text-ink-3">{t("backup.usage", { n: (status.usage / 1024 / 1024).toFixed(1) })}</span>}
      </div>
      <p className="text-sm text-ink-2">{status?.persisted === false ? t("backup.notPersistedHint") : t("settings.storageHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={downloadBackup}>
          <DatabaseBackup size={16} /> {t("backup.download", { n: count, p: packCount })}
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> {t("backup.restore")}
        </Button>
      </div>
      <p className="text-xs text-ink-3">{lastBackup ? t("backup.last", { when: date(lastBackup) }) : t("backup.never")}</p>
      <div className="border-t border-line pt-3">
        <Button variant="ghost" size="sm" disabled={!notes.count} onClick={() => downloadText(notes.markdown, `forge-feedback-${new Date().toISOString().slice(0, 10)}.md`)}>
          <MessageSquareWarning size={15} /> {notes.count ? t("feedback.export", { n: notes.count }) : t("feedback.none")}
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const r = await readBackup(f);
          if (r.ok) setPending({ backup: r.backup, skipped: r.skipped });
          else toast({ content: `${t("backup.invalid")} (${r.error})`, tone: "bad" }, 6000);
        }}
      />
      <RestoreSheet pending={pending} onClose={() => setPending(null)} date={date} />
    </div>
  );
}

function RestoreSheet({ pending, onClose, date }: { pending: { backup: Backup; skipped: number } | null; onClose: () => void; date: (ts: number) => string }) {
  const t = useT();
  const [last, setLast] = useState(pending);
  if (pending && pending !== last) setLast(pending);
  const p = pending ?? last;
  const run = useOnce(p, async (mode: "merge" | "replace") => {
    if (!p) return;
    await restoreBackup(p.backup, mode);
    toast({ content: t("backup.restored", { n: p.backup.characters.length }), tone: "good" });
    onClose();
  });
  return (
    <Sheet
      open={!!pending}
      onOpenChange={(o) => !o && onClose()}
      title={t("backup.restoreTitle")}
      width="sm"
      footer={
        <div className="space-y-2">
          <Button variant="primary" size="lg" className="w-full" onClick={() => void run("merge")}>
            {t("backup.merge")}
          </Button>
          <Button variant="outline" size="lg" className="w-full text-bad" onClick={() => void run("replace")}>
            {t("backup.replace")}
          </Button>
        </div>
      }
    >
      {p && (
        <div className="space-y-2 text-sm text-ink-2">
          <p>{t("backup.contains", { n: p.backup.characters.length, p: p.backup.packs.length })}</p>
          {p.backup.at > 0 && <p className="text-xs text-ink-3">{t("backup.madeAt", { when: date(p.backup.at) })}</p>}
          {p.skipped > 0 && <p className="text-xs text-warn">{t("backup.skipped", { n: p.skipped })}</p>}
          <p className="pt-2 text-xs text-ink-3">{t("backup.mergeHint")}</p>
          <p className="text-xs text-ink-3">{t("backup.replaceHint")}</p>
        </div>
      )}
    </Sheet>
  );
}
