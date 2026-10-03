import { describe, expect, it } from "vitest";
import { addressProblem, buildImageRequest, generateImage, ImageApiError, listImageModels, readImageResponse, sniffImageType } from "./imageApi";

const cfg = { base: "https://gw.test/v1/", key: "sk-test", model: "gpt-image-2" };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("image API client", () => {
  it("uses generations with JSON when there are no references", async () => {
    const { url, init } = buildImageRequest(cfg, { prompt: "a dwarf", size: "1024x1536" });
    expect(url).toBe("https://gw.test/v1/images/generations");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init.body as string)).toEqual({ model: "gpt-image-2", prompt: "a dwarf", size: "1024x1536", n: 1 });
  });

  it("uses edits with one image[] part per reference", () => {
    const refs = [new Blob([PNG], { type: "image/png" }), new Blob([PNG], { type: "image/webp" })];
    const { url, init } = buildImageRequest(cfg, { prompt: "same face", size: "1024x1024", refs });
    expect(url).toBe("https://gw.test/v1/images/edits");
    const fd = init.body as FormData;
    expect(fd.getAll("image[]")).toHaveLength(2);
    expect((fd.getAll("image[]")[1] as File).name).toBe("ref-2.webp");
    expect(fd.get("model")).toBe("gpt-image-2");
    // multipart: the browser must set the boundary itself
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("sends no Authorization header without a key", () => {
    const { init } = buildImageRequest({ ...cfg, key: " " }, { prompt: "x", size: "1024x1024" });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("reads b64_json and url responses", async () => {
    const a = await readImageResponse(json({ data: [{ b64_json: b64(PNG) }] }));
    expect(a.type).toBe("image/png");
    expect(new Uint8Array(await a.arrayBuffer())).toEqual(PNG);
    const fake = (async () => new Response(new Blob([PNG], { type: "image/png" }))) as unknown as typeof fetch;
    const b = await readImageResponse(json({ data: [{ url: "https://cdn.test/x.png" }] }), fake);
    expect(b.size).toBe(PNG.length);
  });

  it("sniffs jpeg and webp", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBP"))).toBe("image/webp");
  });

  it("retries a gateway timeout once, then maps errors", async () => {
    let calls = 0;
    const flaky = (async () => (++calls === 1 ? new Response("timeout", { status: 524 }) : json({ data: [{ b64_json: b64(PNG) }] }))) as unknown as typeof fetch;
    await generateImage(cfg, { prompt: "x", size: "1024x1024" }, { fetch: flaky, retryDelay: 0 });
    expect(calls).toBe(2);

    const denied = (async () => json({ error: { message: "invalid token" } }, 401)) as unknown as typeof fetch;
    const err = await generateImage(cfg, { prompt: "x", size: "1024x1024" }, { fetch: denied, retryDelay: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImageApiError);
    expect((err as ImageApiError).kind).toBe("auth");
    expect((err as ImageApiError).message).toBe("invalid token");

    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(((await generateImage(cfg, { prompt: "x", size: "1024x1024" }, { fetch: offline }).catch((e: unknown) => e)) as ImageApiError).kind).toBe("network");
  });

  it("lists only image models", async () => {
    const f = (async () => json({ data: [{ id: "gpt-5.5" }, { id: "gpt-image-2" }, { id: "codex-gpt-image-2" }] })) as unknown as typeof fetch;
    expect(await listImageModels(cfg, f)).toEqual(["codex-gpt-image-2", "gpt-image-2"]);
  });
});

describe("image API connections", () => {
  it("strips keys from backups and keeps this device's keys on restore", async () => {
    const { useSettings, portableSettings, keepLocalKey, activeConnection } = await import("./settings");
    const a = { id: "a", name: "OpenAI", base: "https://api.openai.com/v1", key: "sk-mine", model: "gpt-image-1" };
    const b = { id: "b", name: "Home", base: "https://gw.test/v1", key: "sk-home", model: "gpt-image-2" };
    useSettings.getState().set({ imageConnections: [a, b], imageConnectionId: "b" });
    expect(activeConnection(useSettings.getState())?.name).toBe("Home");
    const out = portableSettings(useSettings.getState());
    expect(JSON.stringify(out)).not.toContain("sk-");
    expect(out).not.toHaveProperty("set");
    const back = keepLocalKey({ imageConnections: [{ ...b, key: "" }, { id: "c", name: "New", base: "https://x.test", key: "", model: "m" }] }, useSettings.getState());
    expect(back.imageConnections!.map((c) => c.key)).toEqual(["sk-home", ""]);
  });

  it("falls back to the first connection", async () => {
    const { activeConnection } = await import("./settings");
    expect(activeConnection({ imageConnections: [], imageConnectionId: undefined })).toBeUndefined();
    expect(activeConnection({ imageConnections: [{ id: "x", name: "x", base: "", key: "", model: "" }], imageConnectionId: "gone" })?.id).toBe("x");
  });

  it("explains addresses the browser can't use", () => {
    expect(addressProblem("", "https:")).toBe("empty");
    expect(addressProblem("/ai/v1", "https:")).toBe("invalid");
    expect(addressProblem("ftp://x", "https:")).toBe("invalid");
    expect(addressProblem("http://192.168.31.201:3000/v1", "https:")).toBe("insecure");
    expect(addressProblem("http://192.168.31.201:3000/v1", "http:")).toBeUndefined();
    expect(addressProblem("http://localhost:8080/v1", "https:")).toBeUndefined();
    expect(addressProblem("https://api.openai.com/v1", "https:")).toBeUndefined();
  });
});
