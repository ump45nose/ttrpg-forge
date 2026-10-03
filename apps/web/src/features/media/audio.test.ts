import { describe, expect, it } from "vitest";
import { bytesToDataUrl, encodeWav, fadeEdges, normalize } from "./audio";

describe("sound clips", () => {
  it("encodes 16-bit mono WAV", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]), 22050);
    const v = new DataView(wav.buffer);
    const tag = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(wav.length).toBe(44 + 8);
    expect(v.getUint32(4, true)).toBe(wav.length - 8);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(22050);
    expect(v.getUint16(34, true)).toBe(16);
    expect([v.getInt16(46, true), v.getInt16(48, true), v.getInt16(50, true)]).toEqual([32767, -32768, 16383]);
  });

  it("normalizes to the peak and leaves silence alone", () => {
    const y = normalize(new Float32Array([0.1, -0.2]), 0.8);
    expect(y[1]).toBeCloseTo(-0.8);
    expect(y[0]).toBeCloseTo(0.4);
    const quiet = new Float32Array([0, 0]);
    expect(normalize(quiet)).toBe(quiet);
  });

  it("fades both ends", () => {
    const y = fadeEdges(new Float32Array(100).fill(1), 1000, 10);
    expect(y[0]).toBe(0);
    expect(y[99]).toBe(0);
    expect(y[50]).toBe(1);
  });

  it("makes a data URL", () => {
    expect(bytesToDataUrl(new Uint8Array([104, 105]), "audio/wav")).toBe("data:audio/wav;base64,aGk=");
  });
});
