import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ImagePlus, ImageUp, KeyRound, LoaderCircle, PlugZap, RotateCcw, Trash2, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { db, type StoredImage } from "../../app/db";
import { i18n, useT } from "../../app/i18n";
import { addressProblem, type ImageSize } from "../../app/imageApi";
import { activeConnection, useSettings } from "../../app/settings";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Textarea } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { Tabs } from "../../ui/Tabs";
import { toast } from "../../ui/Toast";
import { centreSquare, encodeImage, toBlob } from "./encode";
import { cancelJob, closeStudio, composePrompt, cropNext, dismissJob, finishStudio, jobErrorText, retryJob, saveImage, startJob, useStudio, type StudioRequest } from "./studio";

type Tab = "generate" | "upload" | "recent";

/** Object URL for a blob, revoked when it changes or the component goes away. */
function useObjectUrl(src: Blob | string | undefined): string | undefined {
  const url = useMemo(() => (src instanceof Blob ? URL.createObjectURL(src) : src), [src]);
  useEffect(() => () => void (src instanceof Blob && url && URL.revokeObjectURL(url)), [src, url]);
  return url;
}

/**
 * Generate (OpenAI-compatible images API, prompt + optional reference pictures),
 * upload or reuse a recent picture, then crop it into whatever the caller asked for.
 */
export default function ImageStudio() {
  const t = useT();
  const req = useStudio((s) => s.req);
  const open = useStudio((s) => s.open);
  const pending = useStudio((s) => s.pending);
  const [tab, setTab] = useState<Tab>("generate");
  const [source, setSource] = useState<Blob | string>();

  useEffect(() => {
    setTab(req?.tab ?? "generate");
    setSource(req?.initial);
  }, [req]);
  useEffect(() => {
    if (!pending) return;
    void db.images.get(pending).then((img) => img && setSource(img.blob));
  }, [pending]);

  if (!req) return null;
  const back = () => {
    setSource(undefined);
    useStudio.setState({ pending: undefined });
    if (req.initial) closeStudio();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeStudio()} title={req.title ?? t("media.studio")} width="lg">
      {source ? (
        <CropFlow
          key={typeof source === "string" ? source.slice(-32) : `${source.size}-${source.type}`}
          req={req}
          source={source}
          onBack={back}
        />
      ) : (
        <div className="space-y-4">
          <Tabs
            items={[
              { id: "generate", label: t("media.tab.generate") },
              { id: "upload", label: t("media.tab.upload") },
              { id: "recent", label: t("media.tab.recent") },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "generate" && <GeneratePanel req={req} />}
          {tab === "upload" && <UploadPanel />}
          {tab === "recent" && <RecentPanel />}
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- generate ---------------- */

const SIZES: { id: ImageSize; key: string }[] = [
  { id: "1024x1536", key: "portrait" },
  { id: "1024x1024", key: "square" },
  { id: "1536x1024", key: "landscape" },
];

interface Ref {
  id: number;
  blob: Blob;
}
let refSeq = 0;

function GeneratePanel({ req }: { req: StudioRequest }) {
  const t = useT();
  const navigate = useNavigate();
  const connections = useSettings((s) => s.imageConnections);
  const conn = useSettings(activeConnection);
  const setSettings = useSettings((s) => s.set);
  const problem = conn ? addressProblem(conn.base) : "empty";
  const jobs = useStudio((s) => s.jobs).filter((j) => j.req === req);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(true);
  const [size, setSize] = useState<ImageSize>(req.size);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [now, setNow] = useState(Date.now());
  const running = jobs.some((j) => j.status === "running");
  useEffect(() => {
    if (!running) return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [running]);

  const addRefs = (blobs: Blob[]) => setRefs((r) => [...r, ...blobs.map((blob) => ({ id: ++refSeq, blob }))].slice(0, 4));
  const go = () => {
    if (!conn || problem) return toast({ content: t("media.noConnection"), tone: "bad" });
    if (!prompt.trim()) return toast({ content: t("media.promptRequired"), tone: "bad" });
    const full = composePrompt(prompt, { style, framing: req.framing, refs: refs.length });
    const api = { base: conn.base, key: conn.key, model: conn.model };
    void startJob(req, { prompt: full, size, refs: refs.map((r) => r.blob), api }, prompt.trim());
  };

  return (
    <div className="space-y-4">
      {conn && !problem ? (
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <PlugZap size={14} className="shrink-0 text-good" />
          {connections.length > 1 ? (
            <select
              value={conn.id}
              onChange={(e) => setSettings({ imageConnectionId: e.target.value })}
              className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none"
              aria-label={t("media.connection")}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.model}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate">
              {conn.name} · {conn.model}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm text-ink-2">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">{conn ? t(`settings.image.problem.${problem}`) : t("media.noConnection")}</div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              closeStudio();
              void navigate({ to: "/settings" });
            }}
          >
            {t("media.toSettings")}
          </Button>
        </div>
      )}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-wide text-ink-2 uppercase">{t("media.prompt")}</span>
          {req.describe && (
            <button type="button" className="text-xs text-accent hover:underline" onClick={() => setPrompt(req.describe!)}>
              {req.describeLabel ?? t("media.fromCharacter")}
            </button>
          )}
        </div>
        <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("media.promptPlaceholder")} className="min-h-24" />
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-2 uppercase">
          {t("media.refs")} <span className="font-normal tracking-normal text-ink-3 normal-case">· {t("media.refsHint")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {refs.map((r) => (
            <RefThumb key={r.id} blob={r.blob} onRemove={() => setRefs((x) => x.filter((y) => y.id !== r.id))} />
          ))}
          {refs.length < 4 && (
            <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line-strong text-ink-3 transition-colors hover:border-accent/60 hover:text-accent">
              <ImagePlus size={18} />
              <span className="text-[10px]">{t("media.addRef")}</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => (addRefs([...(e.target.files ?? [])]), (e.target.value = ""))} />
            </label>
          )}
          {refs.length < 4 &&
            req.refCandidates?.map((c) => (
              <button key={c.label} type="button" onClick={() => void toBlob(c.src).then((b) => addRefs([b]))} className="h-8 rounded-lg border border-line px-2.5 text-xs text-ink-2 hover:border-line-strong">
                + {c.label}
              </button>
            ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-line bg-surface/70 p-1">
          {SIZES.map((s) => (
            <button key={s.id} type="button" onClick={() => setSize(s.id)} className={cn("h-7 rounded-lg px-2.5 text-xs transition-colors", size === s.id ? "bg-surface-3 text-ink shadow-card" : "text-ink-3 hover:text-ink-2")}>
              {t(`media.size.${s.key}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStyle(!style)}
          aria-pressed={style}
          className={cn("h-9 rounded-xl border px-3 text-xs transition-colors", style ? "border-accent bg-accent/15 text-ink" : "border-line text-ink-3")}
        >
          {style ? "✓ " : ""}
          {t("media.classicStyle")}
        </button>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={go}>
        <Wand2 size={17} /> {t("media.generate")}
      </Button>
      <p className="-mt-2 text-center text-xs text-ink-3">{t("media.slowHint")}</p>

      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2 text-sm", j.status === "failed" ? "border-bad/40 bg-bad/5" : "border-line bg-surface/60")}>
              {j.status === "running" ? <LoaderCircle size={16} className="shrink-0 animate-spin text-accent" /> : <X size={16} className="shrink-0 text-bad" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-ink">{j.prompt}</div>
                <div className={cn("text-xs", j.status === "failed" ? "text-bad" : "tnum text-ink-3")}>
                  {j.status === "running" ? t("media.elapsed", { s: Math.max(0, Math.round((now - j.startedAt) / 1000)) }) : jobErrorText(j.error!)}
                </div>
              </div>
              {j.status === "failed" && (
                <Button size="icon-sm" variant="ghost" onClick={() => retryJob(j)} aria-label={t("media.retry")}>
                  <RotateCcw size={15} />
                </Button>
              )}
              <Button size="icon-sm" variant="ghost" onClick={() => (j.status === "running" ? cancelJob(j.id) : dismissJob(j.id))} aria-label={t("common.cancel")}>
                <X size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RefThumb({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
  const t = useT();
  const url = useObjectUrl(blob);
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-line">
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button type="button" onClick={onRemove} className="hit absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white" aria-label={t("common.remove")}>
        <X size={12} />
      </button>
    </div>
  );
}

/* ---------------- upload / recent ---------------- */

async function uploadFile(file: File | undefined) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast({ content: i18n.t("portrait.failed"), tone: "bad" });
  cropNext(await saveImage({ blob: file, source: "upload" }));
}

function UploadPanel() {
  const t = useT();
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void uploadFile(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-ink-3 transition-colors",
        over ? "border-accent bg-accent/10 text-accent" : "border-line-strong hover:border-accent/60 hover:text-ink-2",
      )}
    >
      <ImageUp size={30} />
      <span className="text-sm">{t("media.pickFile")}</span>
      <span className="text-xs">{t("media.pickFileHint")}</span>
      <input type="file" accept="image/*" hidden onChange={(e) => (void uploadFile(e.target.files?.[0]), (e.target.value = ""))} />
    </label>
  );
}

function RecentPanel() {
  const t = useT();
  const jobs = useStudio((s) => s.jobs.length);
  const [items, setItems] = useState<StoredImage[] | null>(null);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    void db.images.orderBy("createdAt").reverse().toArray().then(setItems);
  }, [jobs, rev]);
  if (!items) return null;
  if (!items.length) return <p className="py-10 text-center text-sm text-ink-3">{t("media.noRecent")}</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((img) => (
        <RecentThumb key={img.id} img={img} onDelete={() => void db.images.delete(img.id).then(() => setRev((r) => r + 1))} />
      ))}
    </div>
  );
}

function RecentThumb({ img, onDelete }: { img: StoredImage; onDelete: () => void }) {
  const t = useT();
  const url = useObjectUrl(img.blob);
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-3">
      <button type="button" className="h-full w-full" onClick={() => cropNext(img.id)} title={img.prompt}>
        <img src={url} alt={img.prompt ?? ""} className="h-full w-full object-cover" loading="lazy" />
      </button>
      <button type="button" onClick={onDelete} className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-80 hover:opacity-100" aria-label={t("common.delete")}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

/* ---------------- crop ---------------- */

function CropFlow({ req, source, onBack }: { req: StudioRequest; source: Blob | string; onBack: () => void }) {
  const t = useT();
  const url = useObjectUrl(source);
  const steps = req.outputs.filter((o) => o.aspect);
  const [i, setI] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areas, setAreas] = useState<Record<string, Area>>({});
  const [busy, setBusy] = useState(false);
  const step = steps[i];

  const finish = async (all: Record<string, Area>) => {
    setBusy(true);
    try {
      const out: Record<string, string> = {};
      for (const o of req.outputs) out[o.key] = await encodeImage(source, { crop: all[o.key], maxEdge: o.maxEdge });
      req.onPick(out);
      finishStudio();
    } catch {
      toast({ content: t("portrait.failed"), tone: "bad" });
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!steps.length) void finish({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!step) return <LoaderCircle className="mx-auto my-16 animate-spin text-accent" />;
  // avatars start on the upper part of the picture, where the face usually is
  const onLoaded = (m: MediaSize) => {
    if (step.key !== "portrait") return;
    const sq = centreSquare(m.naturalWidth, m.naturalHeight);
    setCrop({ x: 0, y: (m.naturalHeight / 2 - (sq.y + sq.height / 2)) * (m.height / m.naturalHeight) });
  };

  const next = () => {
    if (i < steps.length - 1) {
      setI(i + 1);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } else void finish(areas);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <Button size="icon-sm" variant="ghost" onClick={i ? () => setI(i - 1) : onBack} aria-label={t("common.back")}>
          <ArrowLeft size={16} />
        </Button>
        <span className="flex-1">{step.label ?? t("media.crop")}</span>
        {steps.length > 1 && <span className="tnum text-xs text-ink-3">{`${i + 1} / ${steps.length}`}</span>}
      </div>
      {/* vaul would treat drags inside the cropper as "dismiss the sheet" */}
      <div data-vaul-no-drag className="relative h-[52dvh] max-h-[520px] overflow-hidden rounded-2xl bg-black">
        {url && (
          <Cropper
            key={step.key}
            image={url}
            crop={crop}
            zoom={zoom}
            aspect={step.aspect}
            cropShape={step.aspect === 1 && step.key === "portrait" ? "round" : "rect"}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onMediaLoaded={onLoaded}
            onCropComplete={(_, px) => setAreas((a) => ({ ...a, [step.key]: px }))}
          />
        )}
      </div>
      <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label={t("media.zoom")} />
      <Button variant="primary" size="lg" className="w-full" disabled={busy || !areas[step.key]} onClick={next}>
        {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />} {i < steps.length - 1 ? t("media.next") : t("media.use")}
      </Button>
    </div>
  );
}
