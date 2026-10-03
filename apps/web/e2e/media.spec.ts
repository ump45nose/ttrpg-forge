import { expect, test, type Page } from "@playwright/test";
import { startFromSample } from "./helpers";

/** A real PNG drawn by the browser (a figure on a gradient), as base64. */
async function paintPng(page: Page, w = 1024, h = 1536): Promise<string> {
  return page.evaluate(
    ({ w, h }) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d")!;
      const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#7a3b1d");
      g.addColorStop(1, "#1d2a4a");
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = "#e8c38a";
      x.beginPath();
      x.arc(w / 2, h * 0.28, w * 0.18, 0, 7);
      x.fill();
      return c.toDataURL("image/png").split(",")[1];
    },
    { w, h },
  );
}

/** Stand-in for the image gateway: records which endpoint was hit and answers with a picture. */
async function fakeImageApi(page: Page) {
  const b64 = await paintPng(page);
  const calls: string[] = [];
  await page.route("https://gw.test/v1/images/**", async (route) => {
    calls.push(new URL(route.request().url()).pathname);
    await route.fulfill({ json: { data: [{ b64_json: b64 }] } });
  });
  return calls;
}

test("generate a character picture from the sheet, with a reference, and crop the avatar", async ({ page }) => {
  // a connection already set up in Settings
  await page.addInitScript(() =>
    localStorage.setItem(
      "forge.settings",
      JSON.stringify({ version: 2, state: { imageConnections: [{ id: "t", name: "测试网关", base: "https://gw.test/v1", key: "sk-test", model: "gpt-image-2" }], imageConnectionId: "t" } }),
    ),
  );
  await startFromSample(page, "米拉·轻步");
  const calls = await fakeImageApi(page);
  const ref = Buffer.from(await paintPng(page, 512, 512), "base64");

  await page.getByRole("button", { name: "角色形象" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "AI 生成" }).click();
  const studio = page.getByRole("dialog").filter({ hasText: "描述画面" });
  await expect(studio.getByText("测试网关 · gpt-image-2")).toBeVisible();
  await studio.getByRole("button", { name: "从角色填充" }).click();
  await expect(studio.getByRole("textbox")).toHaveValue(/半身人/);
  await studio.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: ref });
  await studio.getByRole("button", { name: "生成", exact: true }).click();

  // the result goes straight to cropping the avatar
  await page.getByRole("button", { name: "使用这张" }).click();
  expect(calls).toEqual(["/v1/images/edits"]);
  await expect(page.getByRole("dialog").filter({ hasText: "描述画面" })).toHaveCount(0);

  // back in the looks sheet: the avatar and the full picture are both the new image
  const looks = page.getByRole("dialog", { name: "角色形象" });
  await expect(looks.locator('img[src^="data:image/"]')).toHaveCount(2);
  await expect(looks.getByRole("button", { name: "裁剪头像" })).toBeVisible();
});

test("a Workshop spell gets an uploaded picture that shows in the list", async ({ page }) => {
  await page.goto("/p/workshop");
  const png = Buffer.from(await paintPng(page, 800, 600), "base64");
  await page.getByRole("button", { name: /^法术 / }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("textbox").first().fill("烈焰之鞭");
  await editor.getByRole("button", { name: "上传图片" }).click();
  await page.locator('label:has-text("选择图片或拍照") input[type="file"]').setInputFiles({ name: "whip.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "使用这张" }).click();
  await expect(editor.locator("img").first()).toHaveAttribute("src", /^data:image/);
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  const row = page.locator("div").filter({ has: page.getByRole("button", { name: /烈焰之鞭/ }) }).last();
  await expect(row.locator("img").first()).toHaveAttribute("src", /^data:image/);
});

test("image connections: add one, switch, and keys never go into a backup", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "新建连接" }).click();
  // (the test server is plain http, so the "https page blocks http" case is covered by unit tests)
  await page.getByPlaceholder("https://api.openai.com/v1").fill("api.example.com/v1");
  await expect(page.getByText("地址需要以 https:// 开头").first()).toBeVisible();
  await page.getByPlaceholder("https://api.openai.com/v1").fill("https://gw.test/v1");
  await page.getByPlaceholder("sk-…").fill("sk-e2e-secret");
  await page.route("https://gw.test/v1/models", (r) => r.fulfill({ json: { data: [{ id: "gpt-5.5" }, { id: "gpt-image-2" }] } }));
  await page.getByRole("button", { name: "连接", exact: true }).click();
  await expect(page.getByText("已连接 · 1 个图像模型")).toBeVisible();
  await page.getByRole("button", { name: "新建连接" }).click();
  await expect(page.getByText("连接 2", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /备份/ }).first().click();
  const text = (await import("node:fs")).readFileSync((await (await download).path())!, "utf8");
  expect(text).not.toContain("sk-e2e-secret");
  const saved = JSON.parse(text).settings.imageConnections;
  expect(saved.map((c: { base: string; model: string }) => [c.base, c.model])).toEqual([
    ["https://gw.test/v1", "gpt-image-2"],
    ["", "gpt-image-1"],
  ]);
});

/** A short rising chirp as a WAV file, built in the browser. */
async function chirpWav(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const rate = 22050;
    const n = rate;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF");
    v.setUint32(4, 36 + n * 2, true);
    w(8, "WAVE");
    w(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    w(36, "data");
    v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin((i / rate) * 2 * Math.PI * (440 + i / 50)) * 9000), true);
    let bin = "";
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  });
  return Buffer.from(b64, "base64");
}

test("replace the crit sound with your own clip; it goes into backups", async ({ page }) => {
  await page.goto("/p/workshop");
  const wav = await chirpWav(page);
  const row = page.locator("div.rounded-xl").filter({ hasText: /^大成功/ });
  await row.getByRole("button", { name: "添加音效" }).click();
  await page.locator('label:has-text("选择音频文件") input[type="file"]').setInputFiles({ name: "战吼.wav", mimeType: "audio/wav", buffer: wav });
  await expect(page.getByText("1.0 秒")).toBeVisible();
  await page.getByRole("button", { name: "使用这段" }).click();
  await expect(row.getByText("战吼")).toBeVisible();

  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /备份/ }).first().click();
  const backup = JSON.parse((await import("node:fs")).readFileSync((await (await download).path())!, "utf8"));
  expect(backup.sounds).toHaveLength(1);
  expect(backup.sounds[0].cue).toBe("crit");
  expect(backup.sounds[0].data).toMatch(/^data:audio\/wav;base64,UklGR/);
});
