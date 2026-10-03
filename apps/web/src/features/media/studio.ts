import { ulid } from "ulid";
import { create } from "zustand";
import { db, type StoredImage } from "../../app/db";
import { i18n } from "../../app/i18n";
import { generateImage, ImageApiError, type ImageApiConfig, type ImageSize } from "../../app/imageApi";
import { toast } from "../../ui/Toast";
import { shrinkForUpload } from "./encode";

/** One picture the studio hands back. Without `aspect` the whole picture is kept (only downscaled). */
export interface StudioOutput {
  key: string;
  aspect?: number;
  maxEdge: number;
  /** Shown above the cropper when there are several crops. */
  label?: string;
}

export interface StudioRequest {
  title?: string;
  outputs: StudioOutput[];
  /** Default canvas for generation. */
  size: ImageSize;
  /** Composition hint added to the style prefix (head-and-shoulders, full figure…). */
  framing?: string;
  /** Text for "fill from character" (species, class, appearance). */
  describe?: string;
  /** Button text for `describe` (default: "fill from character"). */
  describeLabel?: string;
  /** Pictures offered as one-tap references (current portrait…). */
  refCandidates?: { label: string; src: string }[];
  /** Skip straight to cropping this picture. */
  initial?: Blob | string;
  tab?: "generate" | "upload" | "recent";
  /** Called with a data URL per output key. May run after the caller unmounted. */
  onPick(result: Record<string, string>): void;
}

export interface ImageJob {
  id: string;
  req: StudioRequest;
  prompt: string;
  startedAt: number;
  status: "running" | "failed";
  error?: { kind: ImageApiError["kind"]; message: string };
  /** What to send again on retry. */
  input: { prompt: string; size: ImageSize; refs: Blob[]; api: ImageApiConfig };
}

interface StudioState {
  req: StudioRequest | null;
  open: boolean;
  /** Picture (from `images`) to crop next. */
  pending?: string;
  jobs: ImageJob[];
}

export const useStudio = create<StudioState>()(() => ({ req: null, open: false, jobs: [] }));

export const openStudio = (req: StudioRequest) => useStudio.setState({ req, open: true, pending: undefined });
export const closeStudio = () => useStudio.setState({ open: false, pending: undefined });
/** The caller got its pictures: forget the request. */
export const finishStudio = () => useStudio.setState({ req: null, open: false, pending: undefined });
export const cropNext = (imageId: string) => useStudio.setState({ pending: imageId });

/** The style the art pack was painted in (tools/art/prompts.json), so player pictures sit well beside it. */
export const CLASSIC_STYLE =
  "Classic Dungeons & Dragons sourcebook illustration. Traditional fantasy oil painting, heroic realism, painterly visible brushwork, rich warm earth tones with dramatic chiaroscuro lighting, detailed believable armor, clothing and gear, grounded medieval fantasy, epic but serious mood. No text, no letters, no watermark, no border, no frame.";

export function composePrompt(subject: string, opts: { style: boolean; framing?: string; refs: number }): string {
  const parts = opts.style ? [CLASSIC_STYLE, opts.framing] : [];
  if (opts.refs) parts.push(`Use the reference image${opts.refs > 1 ? "s" : ""} for the character's likeness, face and details.`);
  parts.push(opts.style ? `Subject: ${subject.trim()}` : subject.trim());
  return parts.filter(Boolean).join("\n");
}

const KEEP = 40;

export async function saveImage(img: Omit<StoredImage, "id" | "createdAt">): Promise<string> {
  const id = ulid();
  await db.images.put({ ...img, id, createdAt: Date.now() });
  const extra = await db.images.orderBy("createdAt").reverse().offset(KEEP).primaryKeys();
  if (extra.length) await db.images.bulkDelete(extra);
  return id;
}

const controllers = new Map<string, AbortController>();
const TIMEOUT = 10 * 60 * 1000;

function errorText(e: { kind: ImageApiError["kind"]; message: string }): string {
  return i18n.t(`media.error.${e.kind}`, { detail: e.message });
}

/** Start generating in the background; closing the studio doesn't stop it. */
export async function startJob(req: StudioRequest, input: ImageJob["input"], display: string): Promise<void> {
  const id = ulid();
  const job: ImageJob = { id, req, prompt: display, startedAt: Date.now(), status: "running", input };
  useStudio.setState((s) => ({ jobs: [...s.jobs.filter((j) => j.status === "running" || j.req === req), job] }));
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const refs = await Promise.all(input.refs.map((r) => shrinkForUpload(r)));
    const blob = await generateImage(input.api, { prompt: input.prompt, size: input.size, refs }, { signal: ctrl.signal });
    const imageId = await saveImage({ blob, prompt: display, source: "ai" });
    useStudio.setState((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
    const s = useStudio.getState();
    if (s.req === req && s.open) {
      if (!s.pending) cropNext(imageId);
    } else if (s.req === req) {
      toast({ content: i18n.t("media.ready"), tone: "good", action: { label: i18n.t("media.view"), run: () => useStudio.setState({ open: true, pending: imageId }) } }, 12000);
    } else {
      toast({ content: i18n.t("media.readyRecent"), tone: "good" }, 6000);
    }
  } catch (e) {
    if (ctrl.signal.aborted && !controllers.has(id)) return; // cancelled by the player
    const err = e instanceof ImageApiError ? { kind: e.kind, message: e.message } : { kind: "bad" as const, message: (e as Error).message };
    useStudio.setState((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: "failed", error: err } : j)) }));
    if (!useStudio.getState().open) toast({ content: errorText(err), tone: "bad" }, 8000);
  } finally {
    clearTimeout(timer);
    controllers.delete(id);
  }
}

export function cancelJob(id: string) {
  const ctrl = controllers.get(id);
  controllers.delete(id);
  ctrl?.abort();
  dismissJob(id);
}

export const dismissJob = (id: string) => useStudio.setState((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));

export function retryJob(job: ImageJob) {
  dismissJob(job.id);
  void startJob(job.req, job.input, job.prompt);
}

export { errorText as jobErrorText };
