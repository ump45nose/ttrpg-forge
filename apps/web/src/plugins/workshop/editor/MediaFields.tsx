import type { EntityType } from "@forge/core";
import { ImageUp, Trash2, Wand2 } from "lucide-react";
import type { ImageSize } from "../../../app/imageApi";
import { useT } from "../../../app/i18n";
import { openStudio } from "../../../features/media/studio";
import { ART_REF, ArtImg } from "../../../ui/Art";
import { Button } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { SoundField } from "../../../features/media/SoundField";
import { Field } from "./fields";

interface Shape {
  aspect: number;
  maxEdge: number;
  size: ImageSize;
  framing: string;
}

// same canvases and compositions as the art pack (tools/art/prompts.json), so homebrew sits beside it
const TALL: Shape = { aspect: 2 / 3, maxEdge: 960, size: "1024x1536", framing: "Full figure, vertical composition, subject centered in the lower two thirds with open sky or atmosphere at the top for UI overlay." };
const WIDE: Shape = { aspect: 3 / 2, maxEdge: 960, size: "1536x1024", framing: "Horizontal composition, a single character three-quarter figure on one side, their homeland or story setting filling the rest." };
const ICON: Shape = { aspect: 1, maxEdge: 512, size: "1024x1024", framing: "Square composition, a single clear subject centered, dramatic lighting, simple painterly background." };

/** Entries that are "used" at the table, so a sound can play. */
const SOUNDED = new Set<EntityType>(["spell", "feat", "item"]);

export function shapeFor(type: EntityType): Shape {
  if (type === "class" || type === "subclass") return TALL;
  if (type === "species" || type === "background") return WIDE;
  return ICON;
}

/** Picture for a Workshop entry: generated or uploaded, stored in the entity so it travels with the pack. */
export function MediaFields({
  type,
  art,
  onArt,
  sound,
  onSound,
  describe,
}: {
  type: EntityType;
  art?: string;
  onArt: (art: string | undefined) => void;
  sound?: string;
  onSound: (sound: string | undefined) => void;
  describe: string;
}) {
  const t = useT();
  const shape = shapeFor(type);
  const ref = art?.startsWith(ART_REF) ? art.slice(ART_REF.length) : undefined;
  const inline = art && !ref ? art : undefined;
  const studio = (tab: "generate" | "upload") =>
    openStudio({
      title: t("media.entityPicture"),
      outputs: [{ key: "art", aspect: shape.aspect, maxEdge: shape.maxEdge }],
      size: shape.size,
      framing: shape.framing,
      describe: describe || undefined,
      describeLabel: t("media.fromName"),
      refCandidates: inline ? [{ label: t("media.currentPicture"), src: inline }] : [],
      tab,
      onPick: (r) => onArt(r.art),
    });

  return (
    <div className="space-y-4">
    <Field label={t("media.entityPicture")} hint={t("media.entityPictureHint")}>
      <div className="flex items-center gap-3">
        <ArtImg
          id={ref}
          src={inline}
          size="sm"
          focus={[0.5, 0.35]}
          className={cn("shrink-0 rounded-xl border border-line", shape.aspect > 1 ? "h-16 w-24" : shape.aspect < 1 ? "h-24 w-16" : "h-20 w-20")}
          fallback={<div className={cn("shrink-0 rounded-xl border border-dashed border-line-strong", shape.aspect > 1 ? "h-16 w-24" : shape.aspect < 1 ? "h-24 w-16" : "h-20 w-20")} />}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => studio("generate")}>
            <Wand2 size={15} /> {t("media.aiCreate")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => studio("upload")}>
            <ImageUp size={15} /> {t("portrait.upload")}
          </Button>
          {inline && (
            <Button size="sm" variant="ghost" onClick={() => onArt(undefined)} aria-label={t("media.removePicture")}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
    </Field>
    {SOUNDED.has(type) && (
      <Field label={t("sound.entitySound")} hint={t("sound.entitySoundHint")}>
        <SoundField value={sound} onChange={onSound} title={t("sound.entitySound")} />
      </Field>
    )}
    </div>
  );
}
