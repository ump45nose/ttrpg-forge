/**
 * Player sound clips: any audio file or recording is cut to a short range, mixed
 * to mono, resampled and stored as a small 16-bit WAV data URL (plays everywhere,
 * iOS included; about 44 KB per second).
 */
export const MAX_CLIP_SECONDS = 6;
export const CLIP_RATE = 22050;

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const str = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

/** Scale so the loudest sample sits at `peak` (quiet recordings become audible, loud ones don't clip). */
export function normalize(x: Float32Array, peak = 0.89): Float32Array {
  let max = 0;
  for (const s of x) max = Math.max(max, Math.abs(s));
  if (max < 1e-4) return x;
  const k = peak / max;
  return x.map((s) => s * k);
}

/** A few milliseconds of fade at both ends, so cut points don't click. */
export function fadeEdges(x: Float32Array, rate: number, ms = 8): Float32Array {
  const n = Math.min(Math.floor((rate * ms) / 1000), Math.floor(x.length / 2));
  const y = x.slice();
  for (let i = 0; i < n; i++) {
    const g = i / n;
    y[i]! *= g;
    y[y.length - 1 - i]! *= g;
  }
  return y;
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

export async function decodeAudio(src: Blob): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  return ctx.decodeAudioData(await src.arrayBuffer());
}

/** Cut [start, end) seconds out of a decoded sound and turn it into a stored clip. */
export async function makeClip(buf: AudioBuffer, start: number, end: number): Promise<string> {
  const from = Math.max(0, Math.min(start, buf.duration));
  const dur = Math.max(0.05, Math.min(end, buf.duration, from + MAX_CLIP_SECONDS) - from);
  // the offline context mixes down to mono and resamples for us
  const ctx = new OfflineAudioContext(1, Math.ceil(dur * CLIP_RATE), CLIP_RATE);
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.connect(ctx.destination);
  node.start(0, from, dur);
  const mono = (await ctx.startRendering()).getChannelData(0);
  return bytesToDataUrl(encodeWav(fadeEdges(normalize(mono), CLIP_RATE), CLIP_RATE), "audio/wav");
}

/** Rough size of a data URL in KB, for the UI. */
export const clipKb = (dataUrl: string) => Math.round((dataUrl.length * 3) / 4 / 1024);
