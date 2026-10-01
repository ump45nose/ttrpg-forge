import { useId } from "react";
import { cn } from "./cn";
import { entityGlyph } from "./glyphs";

/**
 * Generated emblem standing in for class/character art: a faceted shield in the
 * class accent with its glyph. Art packs can replace it later via plugins.
 */
export function Crest({ id, accent, size = 56, className, initials }: { id?: string; accent?: string; size?: number; className?: string; initials?: string }) {
  const uid = useId().replace(/:/g, "");
  const Glyph = entityGlyph(id);
  const color = accent ?? "var(--accent)";
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]">
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.95" />
            <stop offset="1" stopColor={color} stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id={`h${uid}`} cx="35%" cy="25%" r="70%">
            <stop offset="0" stopColor="white" stopOpacity="0.35" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M50 4 L90 20 L90 52 C90 74 72 90 50 97 C28 90 10 74 10 52 L10 20 Z" fill={`url(#g${uid})`} />
        <path d="M50 4 L90 20 L90 52 C90 74 72 90 50 97 C28 90 10 74 10 52 L10 20 Z" fill={`url(#h${uid})`} />
        <path d="M50 11 L83 24 L83 52 C83 70 68 83 50 89 C32 83 17 70 17 52 L17 24 Z" fill="none" stroke="white" strokeOpacity="0.28" strokeWidth="1.5" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pb-[6%] text-white">
        {initials ? (
          <span className="font-display font-bold drop-shadow" style={{ fontSize: size * 0.32 }}>
            {initials}
          </span>
        ) : (
          <Glyph style={{ width: size * 0.42, height: size * 0.42 }} strokeWidth={1.75} className="drop-shadow" />
        )}
      </div>
    </div>
  );
}
