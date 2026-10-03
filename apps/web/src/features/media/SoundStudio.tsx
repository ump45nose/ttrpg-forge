import { ArrowLeft, Check, FileAudio, LoaderCircle, Mic, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import { useT } from "../../app/i18n";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { toast } from "../../ui/Toast";
import { decodeAudio, makeClip, MAX_CLIP_SECONDS } from "./audio";
import { closeSoundStudio, useSoundStudio } from "./soundRequest";

interface Source {
  blob: Blob;
  name: string;
}

/** Pick an audio file or record one, choose the part to keep (≤ 6 s), get a small WAV back. */
export default function SoundStudio() {
  const t = useT();
  const req = useSoundStudio((s) => s.req);
  const open = useSoundStudio((s) => s.open);
  const [source, setSource] = useState<Source>();
  useEffect(() => setSource(undefined), [req]);
  if (!req) return null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeSoundStudio()} title={req.title ?? t("sound.studio")} width="md">
      {source ? (
        <Trim
          key={`${source.name}-${source.blob.size}`}
          source={source}
          onBack={() => setSource(undefined)}
          onDone={(data) => {
            req.onPick(data, source.name);
            useSoundStudio.setState({ req: null, open: false });
          }}
        />
      ) : (
        <Pick onPick={setSource} />
      )}
    </Sheet>
  );
}

const RECORD_LIMIT = 15;

function Pick({ onPick }: { onPick: (s: Source) => void }) {
  const t = useT();
  const [rec, setRec] = useState<{ r: MediaRecorder; started: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const chunks = useRef<Blob[]>([]);
  const elapsed = rec ? Math.floor((now - rec.started) / 1000) : 0;

  useEffect(() => {
    if (!rec) return;
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, [rec]);
  useEffect(() => {
    if (rec && elapsed >= RECORD_LIMIT) rec.r.stop();
  }, [rec, elapsed]);
  useEffect(() => () => rec?.r.state === "recording" ? rec.r.stop() : undefined, [rec]);

  const record = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRec(null);
        const blob = new Blob(chunks.current, { type: r.mimeType });
        if (blob.size) onPick({ blob, name: t("sound.recording") });
      };
      r.start();
      setNow(Date.now());
      setRec({ r, started: Date.now() });
    } catch {
      toast({ content: t("sound.micDenied"), tone: "bad" }, 5000);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-ink-3 transition-colors hover:border-accent/60 hover:text-ink-2">
        <FileAudio size={28} />
        <span className="text-sm">{t("sound.pickFile")}</span>
        <span className="text-xs">{t("sound.pickFileHint")}</span>
        <input
          type="file"
          accept="audio/*,video/mp4,video/webm"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onPick({ blob: f, name: f.name.replace(/\.[^.]+$/, "") });
          }}
        />
      </label>
      <button
        type="button"
        onClick={() => (rec ? rec.r.stop() : void record())}
        className={`flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors ${rec ? "border-bad bg-bad/10 text-bad" : "border-dashed border-line-strong text-ink-3 hover:border-accent/60 hover:text-ink-2"}`}
      >
        {rec ? <Square size={26} className="animate-pulse" /> : <Mic size={28} />}
        <span className="text-sm">{rec ? t("sound.stop") : t("sound.record")}</span>
        <span className="tnum text-xs">{rec ? `${elapsed} / ${RECORD_LIMIT} s` : t("sound.recordHint")}</span>
      </button>
    </div>
  );
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function Trim({ source, onBack, onDone }: { source: Source; onBack: () => void; onDone: (data: string) => void }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const region = useRef<Region | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const ws = WaveSurfer.create({ container: box.current, height: 96, waveColor: css("--ink-3") || "#888", progressColor: css("--accent") || "#c9a35a", cursorWidth: 1, normalize: true, barWidth: 2, barGap: 1, barRadius: 2 });
    const regions = ws.registerPlugin(RegionsPlugin.create());
    ws.on("decode", (duration) => {
      const r = regions.addRegion({ start: 0, end: Math.min(duration, MAX_CLIP_SECONDS), maxLength: MAX_CLIP_SECONDS, minLength: 0.1, drag: true, resize: true, color: "color-mix(in oklab, var(--accent) 22%, transparent)" });
      region.current = r;
      setRange([r.start, r.end]);
    });
    regions.on("region-updated", (r) => setRange([r.start, r.end]));
    ws.loadBlob(source.blob).catch(() => setFailed(true));
    return () => ws.destroy();
  }, [source]);

  const use = async () => {
    if (!range) return;
    setBusy(true);
    try {
      onDone(await makeClip(await decodeAudio(source.blob), range[0], range[1]));
    } catch {
      toast({ content: t("sound.unreadable"), tone: "bad" });
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label={t("common.back")}>
          <ArrowLeft size={16} />
        </Button>
        <span className="min-w-0 flex-1 truncate">{source.name}</span>
      </div>
      {failed ? (
        <p className="py-8 text-center text-sm text-bad">{t("sound.unreadable")}</p>
      ) : (
        <div data-vaul-no-drag className="rounded-2xl border border-line bg-surface/60 p-2">
          <div ref={box} />
        </div>
      )}
      <p className="text-xs text-ink-3">{t("sound.trimHint", { n: MAX_CLIP_SECONDS })}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={!range} onClick={() => region.current?.play(true)}>
          <Play size={16} /> {t("sound.preview")}
        </Button>
        {range && <span className="tnum text-xs text-ink-3">{t("sound.length", { s: (range[1] - range[0]).toFixed(1) })}</span>}
      </div>
      <Button variant="primary" size="lg" className="w-full" disabled={!range || busy} onClick={() => void use()}>
        {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />} {t("sound.use")}
      </Button>
    </div>
  );
}
