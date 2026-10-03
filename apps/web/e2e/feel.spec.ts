import { expect, test, type Page } from "@playwright/test";
import { startFromSample, takeDamage } from "./helpers";

/** A one-finger horizontal swipe across the middle of an element. */
async function swipe(page: Page, selector: string, dx: number) {
  await page.evaluate(
    ({ selector, dx }) => {
      // the panel that is leaving can still be in the DOM for a moment: use the newest one
      const el = [...document.querySelectorAll(selector)].at(-1)!;
      const r = el.getBoundingClientRect();
      const y = r.top + Math.min(r.height / 2, 120);
      const x0 = r.left + r.width / 2 - dx / 2;
      const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [touch(x0)], changedTouches: [touch(x0)] }));
      el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [touch(x0 + dx)] }));
    },
    { selector, dx },
  );
}

test("dice tumble before the result lands, and a tap skips it", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await page.getByRole("button", { name: "骰子", exact: true }).click();
  await page.getByRole("button", { name: "d20", exact: true }).click();
  const tray = page.locator(".z-\\[55\\]");
  await expect(tray.getByText("点击跳过")).toBeVisible();
  // the tray is still springing in: don't wait for it to be "stable", that's the point
  await tray.getByText("点击跳过").click({ force: true });
  await expect(tray.getByText("点击跳过")).toBeHidden();
  await expect(tray.getByText(/1d20 · \[\d+\]/)).toBeVisible();
});

test("swipe left / right switches sheet tabs", async ({ page }) => {
  await startFromSample(page, "米拉·轻步");
  await expect(page.getByRole("tab", { name: "动作", exact: true })).toHaveAttribute("aria-selected", "true");
  await swipe(page, ".touch-pan-y", -160);
  await expect(page.getByRole("tab", { name: "装备", exact: true })).toHaveAttribute("aria-selected", "true");
  // let the old panel finish leaving before swiping the new one
  await expect(page.locator(".touch-pan-y")).toHaveCount(1);
  await page.waitForTimeout(250);
  await swipe(page, ".touch-pan-y", 160);
  await expect(page.getByRole("tab", { name: "动作", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("dropping to 0 HP shows the down banner", async ({ page }) => {
  await startFromSample(page, "达格娜·炉石");
  await takeDamage(page, 99);
  await expect(page.getByText("倒地！")).toBeVisible();
  await expect(page.getByText("倒地！")).toBeHidden();
});

test("art: class picker shows paintings; a portrait can be uploaded", async ({ page }) => {
  await startFromSample(page, "艾拉瑞·星语");
  await page.getByRole("button", { name: "编辑构筑" }).click();
  await page.goto(page.url().replace(/\?.*$/, "") + "?step=class");
  const painting = page.locator('img[src*="/art/class/wizard"]').first();
  await expect(painting).toBeVisible();
  await expect.poll(() => painting.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  await page.goto(page.url().replace(/\?.*$/, "") + "?step=details");
  const png = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 60;
      c.height = 40;
      const g = c.getContext("2d")!;
      g.fillStyle = "#c33";
      g.fillRect(0, 0, 60, 40);
      return c.toDataURL("image/png").split(",")[1]!;
    }),
    "base64",
  );
  await page.getByRole("button", { name: "上传图片" }).click();
  await page.locator('label:has-text("选择图片或拍照") input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "使用这张" }).click();
  await expect(page.locator('img[src^="data:image/"]').first()).toBeVisible();
});
