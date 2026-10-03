import { Check, ChevronDown, Eye, EyeOff, PlugZap, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ulid } from "ulid";
import { useT } from "../../app/i18n";
import { addressProblem, ImageApiError, listImageModels, type ImageConnection } from "../../app/imageApi";
import { activeConnection, useSettings } from "../../app/settings";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { cn } from "../../ui/cn";
import { Input, Label } from "../../ui/Field";

type Status = { ok: boolean; text: string; models?: string[] };

const hostOf = (base: string) => {
  try {
    return new URL(base).host;
  } catch {
    return base || "—";
  }
};

/**
 * SillyTavern-style connections for an OpenAI-compatible images API: each has an
 * address, the player's own key and a model; one is in use. The browser calls the
 * address directly, and keys never leave this device (they're stripped from backups).
 */
export function ImageApiSection() {
  const t = useT();
  const connections = useSettings((s) => s.imageConnections);
  const active = useSettings(activeConnection);
  const set = useSettings((s) => s.set);
  const [open, setOpen] = useState<string>();
  const [status, setStatus] = useState<Record<string, Status>>({});

  const patch = (id: string, p: Partial<ImageConnection>) => {
    set({ imageConnections: useSettings.getState().imageConnections.map((c) => (c.id === id ? { ...c, ...p } : c)) });
    if (p.base !== undefined || p.key !== undefined) setStatus(({ [id]: _, ...rest }) => rest);
  };
  const add = () => {
    const c: ImageConnection = { id: ulid(), name: t("settings.image.newName", { n: connections.length + 1 }), base: "", key: "", model: "gpt-image-1" };
    set({ imageConnections: [...connections, c], imageConnectionId: active?.id ?? c.id });
    setOpen(c.id);
  };
  const remove = (id: string) => {
    const rest = connections.filter((c) => c.id !== id);
    set({ imageConnections: rest, imageConnectionId: active?.id === id ? rest[0]?.id : active?.id });
    setOpen(undefined);
  };
  const connect = async (c: ImageConnection) => {
    const problem = addressProblem(c.base);
    if (problem) return setStatus((s) => ({ ...s, [c.id]: { ok: false, text: t(`settings.image.problem.${problem}`) } }));
    setStatus((s) => ({ ...s, [c.id]: { ok: true, text: t("settings.image.connecting") } }));
    try {
      const models = await listImageModels(c);
      setStatus((s) => ({ ...s, [c.id]: { ok: true, text: t("settings.image.ok", { n: models.length }), models } }));
      if (models.length && !models.includes(c.model)) patch(c.id, { model: models[0] });
    } catch (e) {
      const kind = e instanceof ImageApiError ? e.kind : "bad";
      setStatus((s) => ({ ...s, [c.id]: { ok: false, text: t(kind === "network" ? "settings.image.networkHint" : `media.error.${kind}`, { detail: (e as Error).message }) } }));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">{t("settings.image.hint")}</p>
      <div className="space-y-2">
        {connections.map((c) => {
          const isActive = c.id === active?.id;
          const expanded = open === c.id;
          const st = status[c.id];
          const problem = c.base ? addressProblem(c.base) : undefined;
          return (
            <div key={c.id} className={cn("rounded-2xl border bg-surface/60 transition-colors", isActive ? "border-accent/60" : "border-line")}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => set({ imageConnectionId: c.id })}
                  aria-pressed={isActive}
                  aria-label={t("settings.image.use")}
                  className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", isActive ? "border-accent bg-accent text-[var(--accent-ink)]" : "border-line-strong")}
                >
                  {isActive && <Check size={12} strokeWidth={3} />}
                </button>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(expanded ? undefined : c.id)}>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                    {isActive && <Chip tone="accent">{t("settings.image.inUse")}</Chip>}
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {hostOf(c.base)} · {c.model}
                  </span>
                </button>
                {problem && <TriangleAlert size={15} className="shrink-0 text-warn" />}
                <Button variant="ghost" size="icon-sm" onClick={() => setOpen(expanded ? undefined : c.id)} aria-label={t("common.edit")}>
                  <ChevronDown size={16} className={cn("transition-transform", expanded && "rotate-180")} />
                </Button>
              </div>
              {expanded && <ConnectionForm c={c} status={st} problem={problem} onPatch={(p) => patch(c.id, p)} onConnect={() => void connect(c)} onRemove={() => remove(c.id)} />}
            </div>
          );
        })}
      </div>
      <Button variant="outline" size="sm" onClick={add}>
        <Plus size={15} /> {t("settings.image.add")}
      </Button>
    </div>
  );
}

function ConnectionForm({
  c,
  status,
  problem,
  onPatch,
  onConnect,
  onRemove,
}: {
  c: ImageConnection;
  status?: Status;
  problem?: string;
  onPatch: (p: Partial<ImageConnection>) => void;
  onConnect: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [show, setShow] = useState(false);
  const listId = `forge-image-models-${c.id}`;
  return (
    <div className="space-y-3 border-t border-line px-3 pt-3 pb-3">
      <div>
        <Label>{t("settings.image.name")}</Label>
        <Input value={c.name} onChange={(e) => onPatch({ name: e.target.value })} />
      </div>
      <div>
        <Label>{t("settings.image.base")}</Label>
        <Input value={c.base} onChange={(e) => onPatch({ base: e.target.value })} placeholder="https://api.openai.com/v1" spellCheck={false} autoCapitalize="off" inputMode="url" />
        {problem && <p className="mt-1 text-xs text-warn">{t(`settings.image.problem.${problem}`)}</p>}
      </div>
      <div>
        <Label>{t("settings.image.key")}</Label>
        <div className="relative">
          <Input type={show ? "text" : "password"} value={c.key} onChange={(e) => onPatch({ key: e.target.value })} placeholder="sk-…" autoComplete="off" spellCheck={false} className="pr-11" />
          <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" aria-label={t("settings.image.showKey")}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={onConnect}>
          <PlugZap size={15} /> {t("settings.image.connect")}
        </Button>
        {status && <Chip tone={status.ok ? "good" : "bad"}>{status.text}</Chip>}
      </div>
      <div>
        <Label>{t("settings.image.model")}</Label>
        <Input value={c.model} onChange={(e) => onPatch({ model: e.target.value })} list={listId} spellCheck={false} autoCapitalize="off" />
        <datalist id={listId}>
          {status?.models?.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {!!status?.models?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {status.models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onPatch({ model: m })}
                className={cn("h-7 rounded-lg border px-2 text-xs", m === c.model ? "border-accent bg-accent/15 text-ink" : "border-line text-ink-3 hover:border-line-strong")}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-bad" onClick={onRemove}>
          <Trash2 size={14} /> {t("settings.image.remove")}
        </Button>
      </div>
    </div>
  );
}
