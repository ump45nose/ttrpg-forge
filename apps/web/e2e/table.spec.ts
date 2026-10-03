import { expect, test } from "@playwright/test";
import { hp, startFromSample, tab, takeDamage } from "./helpers";

test("new player: pregens on an empty library, tips dismiss for good", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("还没有冒险者")).toBeVisible();
  for (const n of ["布伦·铁誓", "米拉·轻步", "达格娜·炉石", "艾拉瑞·星语"]) await expect(page.getByRole("button", { name: new RegExp(n) })).toBeVisible();
  await startFromSample(page, "米拉·轻步");
  await expect(page.getByText("跑团时这样用")).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).first().click();
  await page.reload();
  await expect(page.getByRole("button", { name: /^生命 / })).toBeVisible();
  await expect(page.getByText("跑团时这样用")).toBeHidden();
});

test("combat: attack spends the action, damage, new turn, undo", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await page.getByRole("button", { name: "开始战斗" }).click();
  await page.getByRole("button", { name: /巨剑/ }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: /^使用/ }).click();
  await expect(sheet).toBeHidden();
  // the Action is spent: attacks move to "used this turn"
  await expect(page.getByText("本回合已使用")).toBeVisible();

  const [, max] = await hp(page);
  await takeDamage(page, 9);
  expect(await hp(page)).toEqual([max - 9, max]);

  await page.getByRole("button", { name: "新回合" }).click();
  await expect(page.getByText("本回合已使用")).toBeHidden();

  await page.getByRole("button", { name: "撤销" }).first().click(); // undo the new turn
  await expect(page.getByText("本回合已使用")).toBeVisible();
  await page.getByRole("button", { name: "撤销" }).first().click(); // undo the damage
  expect(await hp(page)).toEqual([max, max]);
});

test("double tap on confirm spends once", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await page.getByRole("button", { name: /巨剑/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /^使用/ }).dblclick();
  await tab(page, "日志");
  await expect(page.getByRole("listitem").filter({ hasText: /^巨剑/ })).toHaveCount(1);
});

test("gear: loot a potion, drink it, undo restores everything", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  await takeDamage(page, 12);
  const before = await hp(page);
  await tab(page, "装备");
  await page.getByPlaceholder(/搜索物品/).fill("治疗");
  await page.getByRole("button", { name: /^治疗药水/ }).first().click();
  await page.getByRole("button", { name: "使用", exact: true }).click();
  await page.getByRole("button", { name: /自己用/ }).click();
  await expect.poll(async () => (await hp(page))[0]).toBeGreaterThan(before[0]);
  await expect(page.getByRole("button", { name: "使用", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "撤销", exact: true }).last().click(); // toast undo
  await expect.poll(() => hp(page)).toEqual(before);
  await expect(page.getByRole("button", { name: "使用", exact: true })).toBeVisible();
});

test("rests: short rest spends a hit die, long rest heals fully", async ({ page }) => {
  await startFromSample(page, "达格娜·炉石");
  const [, max] = await hp(page);
  await takeDamage(page, 15);
  await tab(page, "资源");
  await page.getByRole("button", { name: "短休", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /消耗生命骰/ }).first().click();
  await dialog.getByRole("button", { name: /^(完成|结束|短休)/ }).last().click();
  await expect.poll(async () => (await hp(page))[0]).toBeGreaterThan(max - 15);
  await page.getByRole("button", { name: "长休", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^(完成|结束|长休)/ }).last().click();
  await expect.poll(() => hp(page)).toEqual([max, max]);
});

test("level up from the sheet", async ({ page }) => {
  await startFromSample(page, "布伦·铁誓");
  const [, max] = await hp(page);
  await page.getByRole("button", { name: "升级" }).click();
  await page.getByRole("button", { name: /取平均值/ }).click();
  await expect(page.getByText("本级获得")).toBeVisible();
  await page.getByRole("button", { name: "成为 4 级" }).click();
  await expect(page.getByText(/勇士 4/)).toBeVisible();
  expect((await hp(page))[1]).toBeGreaterThan(max);
});

test("offline: the installed app opens and records without network", async ({ page, context }) => {
  await startFromSample(page, "米拉·轻步");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.reload();
  await takeDamage(page, 3);
  await page.goto("/");
  await expect(page.getByText("米拉·轻步")).toBeVisible();
});

test("export → delete → import gives the same character", async ({ page }) => {
  await startFromSample(page, "艾拉瑞·星语");
  await takeDamage(page, 4);
  const before = await hp(page);
  const ac = await page.getByText(/^护甲$/).locator("..").innerText();
  await page.goto("/");
  const card = page.getByText("艾拉瑞·星语").locator("xpath=ancestor::*[contains(@class,'card') or self::article][1]");
  await card.getByRole("button", { name: /更多|more/i }).or(page.getByRole("button", { name: /更多/ })).first().click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /导出/ }).click()]);
  const file = await download.path();
  await page.getByRole("button", { name: /更多/ }).first().click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("menuitem", { name: /删除/ }).click();
  await expect(page.getByText("还没有冒险者")).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles(file!);
  await page.getByText("艾拉瑞·星语").first().click();
  await expect.poll(() => hp(page)).toEqual(before);
  expect(await page.getByText(/^护甲$/).locator("..").innerText()).toBe(ac);
});

test("builder: a new level 3 fighter reaches the subclass choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建角色" }).first().click();
  await page.getByPlaceholder(/莉拉/).fill("测试战士");
  await page.getByRole("button", { name: "开始", exact: true }).click();
  await expect(page).toHaveURL(/\/build/);
  await page.getByRole("button", { name: /^战士/ }).first().click();
  await page.getByText(/^特性$/).first().click();
  await expect(page.getByText(/子职/).first()).toBeVisible();
});

test("playtest feedback: noted in the log, collected in settings", async ({ page }) => {
  await startFromSample(page, "米拉·轻步");
  await tab(page, "日志");
  await page.getByRole("button", { name: "记一笔反馈" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("偷袭按钮不好找");
  await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("偷袭按钮不好找")).toBeVisible();
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出试玩反馈（1 条）" }).click()]);
  const md = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
  expect(md).toContain("偷袭按钮不好找");
  expect(md).toContain("米拉·轻步");
});
