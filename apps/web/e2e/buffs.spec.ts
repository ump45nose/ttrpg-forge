import { expect, test } from "@playwright/test";
import { startFromSample, tab } from "./helpers";

test("quick buffs: class suggestions switch on and off, and can be configured", async ({ page }) => {
  await startFromSample(page, "达格娜·炉石");
  const bless = page.getByRole("button", { name: "祝福术", exact: true });
  await expect(page.getByRole("button", { name: "虔诚护盾", exact: true })).toBeVisible();
  await expect(bless).toHaveAttribute("aria-pressed", "false");
  await bless.click();
  await expect(bless).toHaveAttribute("aria-pressed", "true");
  await bless.click();
  await expect(bless).toHaveAttribute("aria-pressed", "false");

  // add Mage Armor and mark it persistent: it survives a long rest
  await page.getByRole("button", { name: "设置快捷增益" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^法师护甲/ }).click();
  const row = dialog.locator("div.bg-surface\\/50").filter({ hasText: "法师护甲" });
  await row.getByText("常驻", { exact: true }).click();
  await page.keyboard.press("Escape");
  const armor = page.getByRole("button", { name: /^法师护甲/ });
  await armor.click();
  await expect(armor).toHaveAttribute("aria-pressed", "true");
  await bless.click();
  await tab(page, "资源");
  await page.getByRole("button", { name: "长休", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^(完成|结束|长休)/ }).last().click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(armor).toHaveAttribute("aria-pressed", "true");
  await expect(bless).toHaveAttribute("aria-pressed", "false");
});

test("level-up offers the maximum, and a real die's result can be tapped", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  const hpOf = async () => Number(/\/(\d+)/.exec((await page.getByRole("button", { name: /^生命 / }).getAttribute("aria-label")) ?? "")![1]);
  const before = await hpOf();
  await page.getByRole("button", { name: "升级" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("用实体骰？掷一个 d10")).toBeVisible();
  await dialog.getByRole("button", { name: /^取最大值/ }).click();
  await dialog.getByRole("button", { name: /^成为 4 级/ }).click();
  await expect(dialog).toBeHidden();
  // fighter d10 + Con
  await expect.poll(hpOf).toBeGreaterThanOrEqual(before + 10);
});

test("building at level 3: hit points can be average, maximum, or typed-in rolls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建角色" }).first().click();
  await page.getByPlaceholder(/莉拉/).fill("生命测试");
  await page.getByRole("button", { name: "开始", exact: true }).click();
  await page.goto(page.url().replace(/\?.*$/, "") + "?step=class");
  await page.getByRole("button", { name: /^战士/ }).first().click();
  await page.getByRole("button", { name: "战士 选择" }).click();
  // new characters start at level 3 (the subclass level); the picker shows from level 2
  await expect(page.getByText(/^3 级$/).first()).toBeVisible();
  const total = page.getByText(/^上限 \d+$/);
  const n = async () => Number((await total.innerText()).replace(/\D/g, ""));
  const avg = await n();
  await page.getByRole("tab", { name: "最大值" }).click();
  await expect.poll(n).toBe(avg + 8); // two levels at 10 instead of 6
  await page.getByRole("tab", { name: "掷骰" }).click();
  await page.getByRole("textbox", { name: "2 级的生命骰" }).fill("9");
  await page.getByRole("textbox", { name: "3 级的生命骰" }).fill("1");
  await expect.poll(n).toBe(avg + 3 - 5);
  await page.getByRole("tab", { name: "平均值" }).click();
  await expect.poll(n).toBe(avg);
});
