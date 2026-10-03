/**
 * Minimal client for an OpenAI-compatible images API: text-to-image through
 * `/images/generations`, or with reference pictures through `/images/edits`.
 * Like SillyTavern, each player sets up their own connections (address, key,
 * model); the browser calls the address directly and the key never leaves the device.
 */
export interface ImageApiConfig {
  base: string;
  key: string;
  model: string;
}

/** A saved connection the player can switch to. */
export interface ImageConnection extends ImageApiConfig {
  id: string;
  name: string;
}

export type AddressProblem = "empty" | "invalid" | "insecure";

/**
 * Why the browser can't use this address: it must be an absolute http(s) URL,
 * and an HTTPS page may not call plain http (except on this machine).
 */
export function addressProblem(base: string, pageProtocol = typeof location !== "undefined" ? location.protocol : "https:"): AddressProblem | undefined {
  const v = base.trim();
  if (!v) return "empty";
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return "invalid";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "invalid";
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.hostname.endsWith(".localhost");
  if (pageProtocol === "https:" && url.protocol === "http:" && !local) return "insecure";
  return undefined;
}

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export interface ImageRequest {
  prompt: string;
  size: ImageSize;
  /** Reference pictures: the result keeps their subject (face, outfit…). */
  refs?: Blob[];
}

export type ImageErrorKind = "auth" | "busy" | "server" | "network" | "timeout" | "bad";

export class ImageApiError extends Error {
  constructor(
    readonly kind: ImageErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const trim = (base: string) => base.replace(/\/+$/, "");
const auth = (key: string): Record<string, string> => (key.trim() ? { Authorization: `Bearer ${key.trim()}` } : {});

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function buildImageRequest(cfg: ImageApiConfig, req: ImageRequest): { url: string; init: RequestInit } {
  if (req.refs?.length) {
    const fd = new FormData();
    fd.append("model", cfg.model);
    fd.append("prompt", req.prompt);
    fd.append("size", req.size);
    fd.append("n", "1");
    req.refs.forEach((b, i) => fd.append("image[]", b, `ref-${i + 1}.${EXT[b.type] ?? "png"}`));
    return { url: `${trim(cfg.base)}/images/edits`, init: { method: "POST", headers: auth(cfg.key), body: fd } };
  }
  return {
    url: `${trim(cfg.base)}/images/generations`,
    init: {
      method: "POST",
      headers: { ...auth(cfg.key), "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, prompt: req.prompt, size: req.size, n: 1 }),
    },
  };
}

/** Image type from the first bytes (the API does not say which format b64_json is). */
export function sniffImageType(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  return "image/png";
}

function errorFor(status: number, detail: string): ImageApiError {
  if (status === 401 || status === 403) return new ImageApiError("auth", detail, status);
  if (status === 429) return new ImageApiError("busy", detail, status);
  if (status >= 500) return new ImageApiError("server", detail, status);
  return new ImageApiError("bad", detail, status);
}

async function detailOf(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    const m = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message);
    if (m) return m;
  } catch {
    /* not JSON */
  }
  return text.slice(0, 200) || `HTTP ${res.status}`;
}

/** The first image of an images API response, as a Blob. */
export async function readImageResponse(res: Response, fetchImpl: typeof fetch = fetch): Promise<Blob> {
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = json.data?.[0];
  if (item?.b64_json) {
    const bin = atob(item.b64_json);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: sniffImageType(bytes) });
  }
  if (item?.url) {
    const r = await fetchImpl(item.url);
    if (!r.ok) throw errorFor(r.status, `HTTP ${r.status}`);
    return r.blob();
  }
  throw new ImageApiError("bad", "no image in response");
}

const RETRY = new Set([502, 503, 504, 520, 522, 524]);

/**
 * Generate one picture. Gateways time out now and then on large images
 * (502/503/524): those are retried once before giving up.
 */
export async function generateImage(cfg: ImageApiConfig, req: ImageRequest, opts: { signal?: AbortSignal; fetch?: typeof fetch; retryDelay?: number } = {}): Promise<Blob> {
  const fetchImpl = opts.fetch ?? fetch;
  for (let attempt = 0; ; attempt++) {
    const { url, init } = buildImageRequest(cfg, req);
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, signal: opts.signal });
    } catch (e) {
      if ((e as Error).name === "AbortError" || (e as Error).name === "TimeoutError") throw new ImageApiError("timeout", (e as Error).message);
      throw new ImageApiError("network", (e as Error).message);
    }
    if (res.ok) return readImageResponse(res, fetchImpl);
    const err = errorFor(res.status, await detailOf(res));
    if (attempt === 0 && RETRY.has(res.status)) {
      await new Promise((r) => setTimeout(r, opts.retryDelay ?? 4000));
      continue;
    }
    throw err;
  }
}

/** Image models the gateway offers (also a cheap check that address and key work). */
export async function listImageModels(cfg: ImageApiConfig, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  let res: Response;
  try {
    res = await fetchImpl(`${trim(cfg.base)}/models`, { headers: auth(cfg.key) });
  } catch (e) {
    throw new ImageApiError("network", (e as Error).message);
  }
  if (!res.ok) throw errorFor(res.status, await detailOf(res));
  const json = (await res.json()) as { data?: { id: string }[] };
  return (json.data ?? []).map((m) => m.id).filter((id) => /image|dall-?e/i.test(id)).sort();
}
