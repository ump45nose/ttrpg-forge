import { expect, test } from "@playwright/test";
import { startFromSample, tab } from "./helpers";

test("a point-buy house rule lets a score go past 15", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "17", exact: true }).click();
  await expect(page.getByText("村规已启用")).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "新建角色" }).first().click();
  await page.getByPlaceholder(/莉拉/).fill("购点测试");
  await page.getByRole("button", { name: "开始", exact: true }).click();
  await page.goto(page.url().replace(/\?.*$/, "") + "?step=abilities");
  await page.getByRole("tab", { name: "购点" }).click();
  const str = page.locator(".card").filter({ hasText: "力量" }).first();
  for (let i = 0; i < 9; i++) await str.getByRole("button", { name: "增加" }).click();
  await expect(str).toContainText("基础 17");
  await expect(page.getByText("剩余 12 点")).toBeVisible();
});

test("weapon mastery picks say what each property does", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await page.goto(page.url() + "/build?step=choices");
  const block = page.locator("section.card").filter({ has: page.getByRole("heading", { name: "武器精通" }) }).first();
  // folded: the picks with their property, and what those properties do
  await expect(block.getByRole("button", { name: /· / }).first()).toBeVisible();
  await expect(block.locator("dl dt").first()).toBeVisible();
  // opened: weapons grouped under each property with its rule text
  await block.getByRole("button", { name: /^更改/ }).click();
  await expect(block.getByText("削弱", { exact: true })).toBeVisible();
});

test("the shop: buying takes the coins, and one undo puts both back", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await tab(page, "装备");
  const gp = async () => Number((await page.getByRole("button", { name: /金币/ }).first().innerText()).match(/(\d+)\s*金币/)![1]);
  const before = await gp();
  await page.getByRole("button", { name: "商店" }).click();
  const shop = page.getByRole("dialog");
  await shop.getByPlaceholder("搜索要买的物品…").fill("绳");
  await shop.getByRole("button", { name: /绳/ }).first().click();
  await shop.getByRole("textbox", { name: "成交价" }).fill("2");
  await shop.getByRole("tab", { name: "金币" }).click();
  await shop.getByRole("button", { name: "买入 · 2 金币" }).click();
  await expect(shop).toBeHidden();
  await expect.poll(gp).toBe(before - 2);
  await page.getByRole("status").getByRole("button", { name: "撤销" }).click();
  await expect.poll(gp).toBe(before);
});

test("shops have everyday goods by kind, and a random stock that can be restocked", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await tab(page, "装备");
  await page.getByRole("button", { name: "商店" }).click();
  const shop = page.getByRole("dialog");
  await shop.getByRole("tab", { name: "铁匠铺" }).click();
  const random = shop.locator("section").filter({ hasText: "今日随机货品" });
  await expect(random.locator("button").filter({ hasText: /金币|银币|铜币/ }).first()).toBeVisible();
  await random.getByRole("button", { name: "重新进货" }).click();
  await expect(random.locator("button").filter({ hasText: /金币|银币|铜币/ }).first()).toBeVisible();
  // tapping an everyday good puts it on the counter at its list price
  await shop.getByRole("button", { name: /^匕首/ }).click();
  await expect(shop.getByRole("button", { name: "买入 · 2 金币" })).toBeEnabled();
});
