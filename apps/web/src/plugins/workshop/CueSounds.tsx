import { AudioLines, Play, RotateCcw } from "lucide-react";
import { useT } from "../../app/i18n";
import { CUES, playClip, playCue, setCueSound, useCueSounds } from "../../app/sound";
import { useSettings } from "../../app/settings";
import { openSoundStudio } from "../../features/media/soundRequest";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";

/** Replace the built-in feedback sounds (dice, crits, damage, healing) with the player's own clips. */
export function CueSounds() {
  const t = useT();
  const own = useCueSounds((s) => s.cues);
  const soundOn = useSettings((s) => s.sound);
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-3">{soundOn ? t("sound.cuesHint") : t("sound.cuesOff")}</p>
      {CUES.map((cue) => {
        const mine = own[cue];
        return (
          <div key={cue} className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 py-2 pr-1.5 pl-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink">{t(`sound.cue.${cue}`)}</div>
              <div className="truncate text-xs text-ink-3">{mine ? <Chip tone="accent">{mine.name ?? t("sound.custom")}</Chip> : t("sound.builtin")}</div>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={`${t("sound.preview")} ${t(`sound.cue.${cue}`)}`} onClick={() => (mine ? void playClip(mine.data, { force: true }) : playCue(cue, { force: true, synth: true }))}>
              <Play size={15} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openSoundStudio({ title: t(`sound.cue.${cue}`), onPick: (data, name) => void setCueSound(cue, { data, name }) })}>
              <AudioLines size={15} /> {mine ? t("sound.replace") : t("sound.add")}
            </Button>
            {mine && (
              <Button variant="ghost" size="icon-sm" aria-label={t("sound.reset")} onClick={() => void setCueSound(cue, null)}>
                <RotateCcw size={14} />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
