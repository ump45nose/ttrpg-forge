import { expect, test } from "@playwright/test";
import { startFromSample, tab } from "./helpers";

test("an attack spells out what to roll: ability, proficiency, Bless — and what to add on a hit", async ({ page }) => {
  await startFromSample(page, "米拉·轻步");
  await page.getByRole("button", { name: "祝福术", exact: true }).click();
  await page.getByRole("button", { name: /^短剑/ }).first().click();
  const dialog = page.getByRole("dialog");
  const formula = dialog.getByLabel("掷骰算式").first();
  await expect(formula).toContainText("敏捷调整值");
  await expect(formula).toContainText("熟练加值");
  const bless = formula.getByRole("button", { name: /祝福术/ });
  await expect(bless).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByText("= 1d20 + 1d4 + 5")).toBeVisible();
  // switched off, its die leaves the sum
  await bless.click();
  await expect(dialog.getByText("= 1d20 + 5")).toBeVisible();
  await expect(dialog.getByText("命中后还能追加")).toBeVisible();
  await expect(dialog.getByText("偷袭", { exact: true })).toBeVisible();
});

test("a skill shows its breakdown first; the app rolls only when asked", async ({ page }) => {
  await startFromSample(page, "米拉·轻步");
  await tab(page, "角色卡");
  await page.getByRole("button", { name: /隐匿/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("隐匿检定")).toBeVisible();
  await expect(dialog.getByText("专精")).toBeVisible();
  await expect(dialog.getByText(/^= 1d20 \+ \d+$/)).toBeVisible();
  await dialog.getByRole("button", { name: "App 代掷" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".z-\\[55\\]").getByText(/1d20/).first()).toBeVisible();
});
