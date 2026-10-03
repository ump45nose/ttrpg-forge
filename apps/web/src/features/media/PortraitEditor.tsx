import type { Character, CharacterMeta } from "@forge/core";
import { Check, Crop, ImageUp, RotateCcw, Wand2 } from "lucide-react";
import { useCharacters } from "../../app/characters";
import { useT } from "../../app/i18n";
import { ArtImg, useArtIds } from "../../ui/Art";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Label } from "../../ui/Field";
import { Portrait, PORTRAIT_ART } from "../../ui/Portrait";
import { Sheet } from "../../ui/Sheet";
import { useNames } from "../common/names";
import { openStudio, type StudioOutput } from "./studio";

const PICTURE: StudioOutput = { key: "picture", maxEdge: 1024 };
const AVATAR: StudioOutput = { key: "portrait", aspect: 1, maxEdge: 512 };
const FRAMING = "Vertical character portrait, three-quarter figure, face clearly visible in the upper third, plain painterly background.";

/**
 * A character's looks: a full picture (shown behind the sheet header and the
 * library card) and a round avatar cropped from it, or a stock species portrait.
 */
export function PortraitEditor({
  character,
  speciesId,
  classId,
  onChange,
}: {
  character: Character;
  speciesId?: string;
  classId?: string;
  onChange: (patch: Partial<CharacterMeta>) => void;
}) {
  const t = useT();
  const n = useNames();
  const gallery = useArtIds("portrait:");
  const { portrait, picture, appearance } = character.meta;
  const inline = (s?: string) => (s && !s.startsWith(PORTRAIT_ART) ? s : undefined);

  const describe = [[n.entity(speciesId, true), n.entity(classId, true)].filter(Boolean).join(" "), appearance?.trim()].filter(Boolean).join(t("media.comma"));
  const studio = (tab: "generate" | "upload") =>
    openStudio({
      title: t("media.looksTitle", { name: character.name }),
      outputs: [PICTURE, { ...AVATAR, label: t("media.cropAvatar") }],
      size: "1024x1536",
      framing: FRAMING,
      describe: describe || undefined,
      refCandidates: [
        ...(picture ? [{ label: t("media.currentPicture"), src: picture }] : []),
        ...(inline(portrait) && !picture ? [{ label: t("media.currentAvatar"), src: portrait! }] : []),
      ],
      tab,
      onPick: (r) => onChange({ picture: r.picture, portrait: r.portrait }),
    });
  const recrop = () => openStudio({ title: t("media.cropAvatar"), outputs: [{ ...AVATAR, label: t("media.cropAvatar") }], size: "1024x1024", initial: picture, onPick: (r) => onChange({ portrait: r.portrait }) });

  return (
    <div>
      <Label>{t("portrait.title")}</Label>
      <div className="flex items-center gap-4">
        <Portrait character={character} speciesId={speciesId} size={88} />
        {picture && <ArtImg src={picture} focus={[0.5, 0.2]} className="h-28 w-20 shrink-0 rounded-xl border border-line" />}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => studio("generate")}>
            <Wand2 size={15} /> {t("media.aiCreate")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => studio("upload")}>
            <ImageUp size={15} /> {t("portrait.upload")}
          </Button>
          {picture && (
            <Button variant="ghost" size="sm" onClick={recrop}>
              <Crop size={14} /> {t("media.cropAvatar")}
            </Button>
          )}
          {(portrait || picture) && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ portrait: undefined, picture: undefined })}>
              <RotateCcw size={14} /> {t("portrait.reset")}
            </Button>
          )}
        </div>
      </div>
      {gallery.length > 0 && (
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {gallery.map((id) => {
            const on = portrait === PORTRAIT_ART + id;
            return (
              <button key={id} type="button" onClick={() => onChange({ portrait: on ? undefined : PORTRAIT_ART + id })} aria-pressed={on} className="relative shrink-0 rounded-full">
                <ArtImg id={id} size="sm" className={cn("h-14 w-14 rounded-full ring-2 transition", on ? "ring-class" : "ring-transparent opacity-80 hover:opacity-100")} />
                {on && (
                  <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-class text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-ink-3">{t("portrait.hint")}</p>
    </div>
  );
}

/** The portrait editor on its own, for the sheet header (the table is not the builder). */
export function LooksSheet({ open, onClose, character, speciesId, classId }: { open: boolean; onClose: () => void; character: Character; speciesId?: string; classId?: string }) {
  const t = useT();
  const update = useCharacters((s) => s.update);
  const id = character.id;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={t("media.looks")} width="md">
      <PortraitEditor character={character} speciesId={speciesId} classId={classId} onChange={(patch) => update(id, (c) => ({ ...c, meta: { ...c.meta, ...patch } }))} />
    </Sheet>
  );
}
