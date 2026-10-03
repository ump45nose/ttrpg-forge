import { expect, test } from "@playwright/test";
import { startFromSample, tab } from "./helpers";

const ac = async (page: import("@playwright/test").Page) => (await page.getByText(/^护甲$/).locator("..").innerText()).replace(/\D/g, "");

test("a shield without training: warned before equipping, and it adds no AC", async ({ page }) => {
  await startFromSample(page, "米拉·轻步"); // rogue: light armor only
  const before = await ac(page);
  await tab(page, "装备");
  await page.getByPlaceholder(/搜索物品/).fill("盾牌");
  await page.getByRole("button", { name: /^盾牌/ }).first().click();

  // first say no: nothing changes
  const row = page.locator("div.rounded-xl").filter({ hasText: /^盾牌/ }).last();
  await row.getByRole("button", { name: "穿戴", exact: true }).click();
  const ask = page.getByRole("alertdialog");
  await expect(ask).toContainText("未受训使用盾牌");
  await ask.getByRole("button", { name: "取消" }).click();
  await expect(row.getByRole("button", { name: "穿戴", exact: true })).toBeVisible();

  // then equip anyway: the shield is worn, flagged, and AC stays the same
  await row.getByRole("button", { name: "穿戴", exact: true }).click();
  await ask.getByRole("button", { name: "穿戴" }).click();
  const worn = page.locator("div.rounded-xl").filter({ hasText: "盾牌不提供 AC 加值" });
  await expect(worn).toBeVisible();
  expect(await ac(page)).toBe(before);
});

test("workshop: invalid JSON can't be saved, and the draft survives switching tabs", async ({ page }) => {
  await page.goto("/p/workshop");
  await page.getByRole("button", { name: /^法术 / }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("textbox").first().fill("霜之吐息");
  await editor.getByRole("tab", { name: "高级" }).click();
  const json = editor.locator("textarea");
  const broken = (await json.inputValue()).replace("\"霜之吐息\"", "\"霜之吐息\",,");
  await json.fill(broken);
  const save = editor.getByRole("button", { name: "保存", exact: true });
  await expect(save).toBeDisabled();
  await expect(editor.getByRole("alert")).toContainText("修正后才能保存");

  // the form says the JSON edits are pending; going back restores the exact text
  await editor.getByRole("tab", { name: "表单" }).click();
  await expect(editor.getByText(/未生效的修改/)).toBeVisible();
  await editor.getByRole("button", { name: "回到 JSON" }).click();
  await expect(json).toHaveValue(broken);

  // fixing it makes saving possible again
  await json.fill(broken.replace("\"霜之吐息\",,", "\"霜之吐息\""));
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("button", { name: /霜之吐息/ })).toBeVisible();
});

test("builder: a wizard with nothing prepared gets a reminder that jumps to the panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建角色" }).first().click();
  await page.getByPlaceholder(/莉拉/).fill("健忘法师");
  await page.getByRole("button", { name: "开始", exact: true }).click();
  const card = page.getByRole("button", { name: /^法师/ }).first();
  await card.click();
  await card.click();
  // step pills: the number is the step, open picks are a separate badge
  await expect(page.getByRole("button", { name: /^特性 · \d+ 项待选$/ })).toBeVisible();
  await page.getByText(/^确认$/).first().click();
  await page.getByRole("button", { name: /法师：尚未准备完法术/ }).click();
  await expect(page.getByRole("heading", { name: /已准备法术/ })).toBeInViewport();

  // the sheet says so too, and leads back to the same panel
  await page.goto(page.url().replace(/\/build.*$/, ""));
  await page.getByRole("button", { name: /法师：尚未准备完法术.*去准备/ }).click();
  await expect(page).toHaveURL(/step=choices/);
  await expect(page.getByRole("heading", { name: /已准备法术/ })).toBeInViewport();
});
