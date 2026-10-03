import { Check, Dices, ImageUp, RotateCcw } from "lucide-react";
import { useRef } from "react";
import { useT } from "../../../app/i18n";
import { ArtImg, useArtIds } from "../../../ui/Art";
import { Button } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { compressPortrait, Portrait, PORTRAIT_ART } from "../../../ui/Portrait";
import { toast } from "../../../ui/Toast";
import { Input, Label, Textarea } from "../../../ui/Field";
import { randomName } from "../../library/Library";
import { useBuilder } from "../state";

const ALIGNMENTS = ["LG", "NG", "CG", "LN", "N", "CN", "LE", "NE", "CE"] as const;

export function DetailsStep() {
  const t = useT();
  const { character, setMeta } = useBuilder();
  const m = character.meta;
  return (
    <div className="card mx-auto max-w-2xl space-y-5 p-5 sm:p-6">
      <PortraitPicker />
      <div>
        <Label>{t("builder.details.name")}</Label>
        <div className="flex gap-2">
          <Input value={character.name} onChange={(e) => setMeta({ name: e.target.value })} className="font-display text-lg" />
          <Button variant="secondary" size="icon" onClick={() => setMeta({ name: randomName() })} aria-label="random">
            <Dices size={18} />
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("builder.details.player")}</Label>
          <Input value={m.player ?? ""} onChange={(e) => setMeta({ player: e.target.value })} />
        </div>
        <div>
          <Label>{t("builder.details.pronouns")}</Label>
          <Input value={m.pronouns ?? ""} onChange={(e) => setMeta({ pronouns: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>{t("builder.details.alignment")}</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {ALIGNMENTS.map((a) => (
            <button
              key={a}
              onClick={() => setMeta({ alignment: m.alignment === a ? undefined : a })}
              className={`rounded-lg border px-2 py-2 text-sm transition-colors ${m.alignment === a ? "border-class bg-class/15 text-ink" : "border-line text-ink-2 hover:border-line-strong"}`}
            >
              {t(`alignment.${a}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>{t("builder.details.appearance")}</Label>
        <Textarea rows={3} value={m.appearance ?? ""} onChange={(e) => setMeta({ appearance: e.target.value })} />
      </div>
      <div>
        <Label>{t("builder.details.backstory")}</Label>
        <Textarea rows={6} value={m.backstory ?? ""} onChange={(e) => setMeta({ backstory: e.target.value })} />
      </div>
    </div>
  );
}

function PortraitPicker() {
  const t = useT();
  const { character, sheet, setMeta } = useBuilder();
  const fileRef = useRef<HTMLInputElement>(null);
  const gallery = useArtIds("portrait:");
  const current = character.meta.portrait;
  return (
    <div>
      <Label>{t("portrait.title")}</Label>
      <div className="flex items-center gap-4">
        <Portrait character={character} speciesId={sheet.speciesId} size={88} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <ImageUp size={15} /> {t("portrait.upload")}
          </Button>
          {current && (
            <Button variant="ghost" size="sm" onClick={() => setMeta({ portrait: undefined })}>
              <RotateCcw size={14} /> {t("portrait.reset")}
            </Button>
          )}
        </div>
      </div>
      {gallery.length > 0 && (
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {gallery.map((id) => {
            const on = current === PORTRAIT_ART + id;
            return (
              <button key={id} type="button" onClick={() => setMeta({ portrait: on ? undefined : PORTRAIT_ART + id })} aria-pressed={on} className="relative shrink-0 rounded-full">
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
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            setMeta({ portrait: await compressPortrait(f) });
          } catch {
            toast({ content: t("portrait.failed"), tone: "bad" });
          }
        }}
      />
    </div>
  );
}
