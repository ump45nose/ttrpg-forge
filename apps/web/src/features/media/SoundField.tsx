import { AudioLines, Play, Trash2 } from "lucide-react";
import { useT } from "../../app/i18n";
import { playClip } from "../../app/sound";
import { Button } from "../../ui/Button";
import { clipKb } from "./audio";
import { openSoundStudio } from "./soundRequest";

/** A sound slot: preview, replace (file or recording), remove. */
export function SoundField({ value, onChange, title, name }: { value?: string; onChange: (v: string | undefined, name?: string) => void; title?: string; name?: string }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value && (
        <Button size="sm" variant="secondary" onClick={() => void playClip(value, { force: true })} aria-label={t("sound.preview")}>
          <Play size={14} /> <span className="max-w-32 truncate">{name ?? t("sound.custom")}</span>
          <span className="tnum text-[11px] text-ink-3">{clipKb(value)} KB</span>
        </Button>
      )}
      <Button size="sm" variant={value ? "ghost" : "secondary"} onClick={() => openSoundStudio({ title, onPick: (data, n) => onChange(data, n) })}>
        <AudioLines size={15} /> {value ? t("sound.replace") : t("sound.add")}
      </Button>
      {value && (
        <Button size="sm" variant="ghost" onClick={() => onChange(undefined)} aria-label={t("sound.remove")}>
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );
}
