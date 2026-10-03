import { expect, test } from "@playwright/test";
import { startFromSample, tab } from "./helpers";

test("deleting a character can be undone from the toast", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await page.goto("/");
  // the saved character's card (an empty library offers the same pregen again, so not by name)
  const card = page.getByText("3 级 · 人类 · 战士", { exact: true });
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "更多" }).first().click();
  await page.getByRole("menuitem", { name: "删除" }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole("status").getByRole("button", { name: "撤销" }).click();
  await expect(card).toBeVisible();
  // and it really is back on the device
  await page.reload();
  await expect(card).toBeVisible();
});

test("a pool bigger than 12 (Lay on Hands) can still be spent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建角色" }).first().click();
  await page.getByPlaceholder(/莉拉/).fill("圣疗测试");
  await page.getByRole("button", { name: "开始", exact: true }).click();
  const card = page.getByRole("button", { name: /^圣武士/ }).first();
  await card.click();
  await card.click();
  // still has open picks, but the library menu opens the sheet directly
  await page.goto("/");
  await page.getByRole("button", { name: "更多" }).first().click();
  await page.getByRole("menuitem", { name: "打开角色卡" }).click();
  await tab(page, "资源");
  const row = page.locator("div").filter({ has: page.getByText(/^圣疗/) }).filter({ has: page.getByRole("button", { name: "消耗一次" }) }).last();
  await expect(row).toContainText("15 / 15");
  await row.getByRole("button", { name: "消耗一次" }).click();
  await expect(row).toContainText("14 / 15");
});

test("closing the level-up sheet after the level is in keeps the level", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await page.getByRole("button", { name: "升级" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /取平均值/ }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "撤销升级" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/勇士 4$/).first()).toBeVisible();
  await expect(page.getByRole("status")).toContainText("4 级");
});

test("an unknown address shows a way back instead of a blank page", async ({ page }) => {
  await page.goto("/nowhere/at/all");
  await expect(page.getByRole("heading", { name: "这里什么都没有" })).toBeVisible();
  await page.getByRole("button", { name: "回到角色库" }).click();
  await expect(page).toHaveURL(/\/$/);
});
