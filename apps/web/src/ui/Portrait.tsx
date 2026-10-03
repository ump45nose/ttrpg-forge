import type { Character } from "@forge/core";
import { useState } from "react";
import { useSettings } from "../app/settings";
import { ART_REF, ArtImg } from "./Art";
import { cn } from "./cn";
import { Crest } from "./Crest";

/** `meta.portrait` is either an uploaded image (data URL) or a reference to pack art ("art:portrait:elf"). */
export const PORTRAIT_ART = ART_REF;

export function defaultPortraitId(speciesId: string | undefined) {
  return speciesId ? `portrait:${speciesId.split(":")[1]}` : undefined;
}

/**
 * Round character avatar: the uploaded picture, the chosen pack portrait, or the
 * species' default portrait; the class crest with initials when there is none.
 */
export function Portrait({ character, speciesId, accent, size = 48, className }: { character: Character; speciesId?: string; accent?: string; size?: number; className?: string }) {
  const p = character.meta.portrait;
  const artOn = useSettings((s) => s.art);
  const [broken, setBroken] = useState<string>();
  const crest = <Crest id={character.id} accent={accent} size={size} initials={character.name.slice(0, 1)} className={className} />;
  const ring = "shrink-0 rounded-full ring-2 ring-[color-mix(in_oklab,var(--class,var(--accent))_70%,transparent)] ring-offset-2 ring-offset-bg shadow-md";
  if (p && !p.startsWith(PORTRAIT_ART) && broken !== p) {
    return (
      <img src={p} alt="" onError={() => setBroken(p)} className={cn("object-cover", ring, className)} style={{ width: size, height: size, ["--class" as string]: accent }} />
    );
  }
  const id = p?.startsWith(PORTRAIT_ART) ? p.slice(PORTRAIT_ART.length) : defaultPortraitId(speciesId);
  if (!artOn) return crest;
  return <ArtImg id={id} size={size > 96 ? "lg" : "sm"} focus={[0.5, 0.35]} fallback={crest} className={cn(ring, className)} style={{ width: size, height: size, ["--class" as string]: accent }} />;
}
