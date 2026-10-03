import type { SoundCue } from "@forge/plugin-api";
import { create } from "zustand";
import { db } from "./db";
import { host } from "./host";
import { useSettings } from "./settings";

/**
 * Feedback cues. By default small synthesised sounds (WebAudio), so there is
 * nothing to download, cache or license; the player can replace any of them with
 * their own clip (Workshop), and sound-pack plugins can too. Off unless sounds are on.
 */
export type Cue = SoundCue;
export const CUES: Cue[] = ["roll", "land", "crit", "fumble", "heal", "hurt"];

/** The player's replacements (Dexie `sounds`), mirrored here so playing stays synchronous. */
export const useCueSounds = create<{ cues: Partial<Record<Cue, { data: string; name?: string }>> }>()(() => ({ cues: {} }));

export async function loadCueSounds() {
  const rows = await db.sounds.toArray();
  useCueSounds.setState({ cues: Object.fromEntries(rows.map((r) => [r.cue, { data: r.data, name: r.name }])) });
}

export async function setCueSound(cue: Cue, clip: { data: string; name?: string } | null) {
  if (clip) await db.sounds.put({ cue, ...clip, updatedAt: Date.now() });
  else await db.sounds.delete(cue);
  await loadCueSounds();
}

/** What a cue plays: the player's clip, else the last sound pack's, else the synthesised default. */
export function cueSource(cue: Cue, own = useCueSounds.getState().cues, packs = host.get("sounds")): string | undefined {
  if (own[cue]) return own[cue]!.data;
  for (let i = packs.length - 1; i >= 0; i--) if (packs[i]!.cues[cue]) return packs[i]!.cues[cue];
  return undefined;
}

let ctx: AudioContext | undefined;

function audio(force = false): AudioContext | undefined {
  if (!force && !useSettings.getState().sound) return undefined;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

function tone(a: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "sine", gain = 0.15, slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** A short burst of band-passed noise: one die hitting the table. */
function click(a: AudioContext, at: number, gain = 0.35, freq = 2200) {
  const len = Math.floor(a.sampleRate * 0.03);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(a.destination);
  src.start(at);
}

const decoded = new Map<string, Promise<AudioBuffer>>();

/** Play a clip (data URL or URL). `force` plays even with sounds off (previews in the editor). */
export async function playClip(src: string, opts: { force?: boolean } = {}): Promise<void> {
  const a = audio(opts.force);
  if (!a) return;
  (window as { __forgeSoundLog?: string[] }).__forgeSoundLog?.push(src.slice(0, 48));
  try {
    let buf = decoded.get(src);
    if (!buf) {
      buf = fetch(src)
        .then((r) => r.arrayBuffer())
        .then((b) => a.decodeAudioData(b));
      decoded.set(src, buf);
      buf.catch(() => decoded.delete(src));
    }
    const node = a.createBufferSource();
    node.buffer = await buf;
    node.connect(a.destination);
    node.start();
  } catch {
    /* unplayable clip: stay quiet */
  }
}

export function playCue(cue: Cue, opts: { force?: boolean; synth?: boolean } = {}) {
  const own = opts.synth ? undefined : cueSource(cue);
  if (own) return void playClip(own, opts);
  const a = audio(opts.force);
  if (!a) return;
  const t = a.currentTime + 0.01;
  switch (cue) {
    case "roll":
      // a handful of decelerating clacks
      for (let i = 0, at = t; i < 7; i++, at += 0.045 + i * 0.018) click(a, at, 0.32 - i * 0.03, 1800 + Math.random() * 1400);
      break;
    case "land":
      click(a, t, 0.4, 1400);
      tone(a, 520, t, 0.12, "triangle", 0.05);
      break;
    case "crit":
      [523, 659, 784, 1047].forEach((f, i) => tone(a, f, t + i * 0.07, 0.35, "triangle", 0.12));
      break;
    case "fumble":
      tone(a, 220, t, 0.5, "sawtooth", 0.06, 90);
      break;
    case "heal":
      [660, 880, 1320].forEach((f, i) => tone(a, f, t + i * 0.09, 0.5, "sine", 0.07));
      break;
    case "hurt":
      tone(a, 140, t, 0.22, "square", 0.05, 70);
      break;
  }
}
