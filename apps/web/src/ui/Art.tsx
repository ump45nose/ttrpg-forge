import type { ArtImage } from "@forge/plugin-api";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { host, useHostRevision } from "../app/host";
import { useSettings } from "../app/settings";
import { cn } from "./cn";

let cache: { rev: number; map: Map<string, ArtImage> } | undefined;

/** id -> image across enabled art packs; later packs win. */
function artMap(rev: number): Map<string, ArtImage> {
  if (cache?.rev !== rev) {
    const map = new Map<string, ArtImage>();
    for (const pack of host.get("art")) for (const [id, img] of Object.entries(pack.images)) map.set(id, img);
    cache = { rev, map };
  }
  return cache.map;
}

/** The illustration for an entity id or scene, unless art is switched off or none exists. */
export function useArt(id: string | undefined): ArtImage | undefined {
  const rev = useHostRevision();
  const on = useSettings((s) => s.art);
  return on && id ? artMap(rev).get(id) : undefined;
}

/** First id in the list that has art. */
export function useFirstArt(ids: (string | undefined)[]): { id: string; img: ArtImage } | undefined {
  const rev = useHostRevision();
  const on = useSettings((s) => s.art);
  const key = ids.join("|");
  return useMemo(() => {
    if (!on) return undefined;
    const map = artMap(rev);
    for (const id of ids) {
      const img = id ? map.get(id) : undefined;
      if (img) return { id: id!, img };
    }
    return undefined;
    // ids is captured through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, on, key]);
}

export function artUrl(img: ArtImage, size: "sm" | "lg" = "lg") {
  return `${import.meta.env.BASE_URL}${img.src}${size === "sm" ? ".sm" : ""}.webp${img.v ? `?v=${img.v}` : ""}`;
}

/**
 * A cover-cropped illustration that fades in once decoded. Renders `fallback`
 * (or nothing) when there is no art for the id.
 */
export function ArtImg({
  id,
  img: given,
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
  size?: "sm" | "lg";
  /** Override the focal point, e.g. [0.5, 0.2] to keep heads in a short banner. */
  focus?: [number, number];
  className?: string;
  imgClassName?: string;
  fallback?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}) {
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
  const rev = useHostRevision();
  const on = useSettings((s) => s.art);
  return useMemo(() => (on ? [...artMap(rev).keys()].filter((k) => k.startsWith(prefix)).sort() : []), [rev, on, prefix]);
}
