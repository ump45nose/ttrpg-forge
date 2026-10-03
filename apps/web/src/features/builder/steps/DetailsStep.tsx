import { Dices } from "lucide-react";
import { useT } from "../../../app/i18n";
import { Button } from "../../../ui/Button";
import { Input, Label, Textarea } from "../../../ui/Field";
import { randomName } from "../../library/Library";
import { useBuilder } from "../state";
import { PortraitEditor } from "../../media/PortraitEditor";

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
  const { character, sheet, setMeta } = useBuilder();
  return <PortraitEditor character={character} speciesId={sheet.speciesId} classId={sheet.classes[0]?.id} onChange={setMeta} />;
}
