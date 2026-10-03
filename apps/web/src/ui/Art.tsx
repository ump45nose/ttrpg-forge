import type { RulePack } from "@forge/core";
import type { ArtImage } from "@forge/plugin-api";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { host, useHostRevision } from "../app/host";
import { orderedPacks, usePacks } from "../app/packs";
import type { StoredPack } from "../app/db";
import { useSettings } from "../app/settings";
import { cn } from "./cn";

/** `entity.art` / `meta.portrait` value that points at pack art instead of holding a picture. */
export const ART_REF = "art:";

let cache: { rev: number; packs: StoredPack[]; map: Map<string, ArtImage> } | undefined;

/** A picture stored inline (data URL) or anywhere off-site, used as-is rather than as a pack path. */
const isInline = (src: string) => /^(data:|blob:|https?:)/.test(src);

export const inlineArt = (src: string): ArtImage => ({ src, w: 0, h: 0 });

/**
 * id -> image. Art packs first (later packs win), then pictures that user content
 * carries itself (`entity.art`, from the Workshop), which win over pack art.
 */
function artMap(rev: number, packs: StoredPack[]): Map<string, ArtImage> {
  if (cache?.rev !== rev || cache.packs !== packs) {
    const map = new Map<string, ArtImage>();
    for (const pack of host.get("art")) for (const [id, img] of Object.entries(pack.images)) map.set(id, img);
    const content: RulePack[] = [...host.get("rulePacks"), ...orderedPacks(packs).filter((p) => p.enabled).map((p) => p.pack)];
    const own = new Map<string, ArtImage>();
    for (const pack of content)
      for (const e of pack.entities) {
        if (!e.art) continue;
        const img = e.art.startsWith(ART_REF) ? map.get(e.art.slice(ART_REF.length)) : isInline(e.art) ? inlineArt(e.art) : undefined;
        if (img) own.set(e.id, img);
      }
    for (const [id, img] of own) map.set(id, img);
    cache = { rev, packs, map };
  }
  return cache.map;
}

function useArtMap(): Map<string, ArtImage> {
  const rev = useHostRevision();
  const packs = usePacks((s) => s.packs);
  return artMap(rev, packs);
}

/** The illustration for an entity id or scene, unless art is switched off or none exists. */
export function useArt(id: string | undefined): ArtImage | undefined {
  const map = useArtMap();
  const on = useSettings((s) => s.art);
  return on && id ? map.get(id) : undefined;
}

/** First id in the list that has art. */
export function useFirstArt(ids: (string | undefined)[]): { id: string; img: ArtImage } | undefined {
  const map = useArtMap();
  const on = useSettings((s) => s.art);
  const key = ids.join("|");
  return useMemo(() => {
    if (!on) return undefined;
    for (const id of ids) {
      const img = id ? map.get(id) : undefined;
      if (img) return { id: id!, img };
    }
    return undefined;
    // ids is captured through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, on, key]);
}

export function artUrl(img: ArtImage, size: "sm" | "lg" = "lg") {
  if (isInline(img.src)) return img.src;
  return `${import.meta.env.BASE_URL}${img.src}${size === "sm" ? ".sm" : ""}.webp${img.v ? `?v=${img.v}` : ""}`;
}

/**
 * A cover-cropped illustration that fades in once decoded. Renders `fallback`
 * (or nothing) when there is no art for the id.
 */
export function ArtImg({
  id,
  img: givenImg,
  src: givenSrc,
  size = "lg",
  focus,
  className,
  imgClassName,
  fallback,
  children,
  style,
}: {
  /** One id, or several to use the first that has art (e.g. subclass, then class). */
  id?: string | (string | undefined)[];
  img?: ArtImage;
  /** A picture the caller holds itself (e.g. a character's own portrait), shown even with art switched off. */
  src?: string;
  size?: "sm" | "lg";
  /** Override the focal point, e.g. [0.5, 0.2] to keep heads in a short banner. */
  focus?: [number, number];
  className?: string;
  imgClassName?: string;
  fallback?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const given = givenImg ?? (givenSrc ? inlineArt(givenSrc) : undefined);
  const found = useFirstArt(given ? [] : Array.isArray(id) ? id : [id])?.img;
  const img = given ?? found;
  const [loaded, setLoaded] = useState<string>();
  if (!img) return <>{fallback ?? null}</>;
  const src = artUrl(img, size);
  const [fx, fy] = focus ?? img.focus ?? [0.5, 0.3];
  return (
    <div className={cn(!/\b(absolute|fixed)\b/.test(className ?? "") && "relative", "overflow-hidden", !/\bbg-/.test(className ?? "") && "bg-surface-3", className)} style={style}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(src)}
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-500", loaded === src ? "opacity-100" : "opacity-0", imgClassName)}
        style={{ objectPosition: `${fx * 100}% ${fy * 100}%` }}
      />
      {children}
    </div>
  );
}

/** All art ids with a prefix, e.g. "portrait:" for the portrait gallery. */
export function useArtIds(prefix: string): string[] {
  const map = useArtMap();
  const on = useSettings((s) => s.art);
  return useMemo(() => (on ? [...map.keys()].filter((k) => k.startsWith(prefix)).sort() : []), [map, on, prefix]);
}
