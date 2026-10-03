import { useSettings } from "./settings";

/**
 * Small synthesised cues (WebAudio), so there are no sound files to download,
 * cache or license. Off unless the player turns sounds on.
 */
export type Cue = "roll" | "land" | "crit" | "fumble" | "heal" | "hurt";

let ctx: AudioContext | undefined;

function audio(): AudioContext | undefined {
  if (!useSettings.getState().sound) return undefined;
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

export function playCue(cue: Cue) {
  const a = audio();
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
