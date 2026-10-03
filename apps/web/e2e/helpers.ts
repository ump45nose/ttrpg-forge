import { expect, type Page } from "@playwright/test";

/** Fresh device: start from a pregen and land on its sheet. */
export async function startFromSample(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/\/c\/[0-9A-Z]+$/);
  await expect(page.getByRole("button", { name: /^生命 \d+\/\d+$/ })).toBeVisible();
}

/** "生命 21/28" → [21, 28]. */
export async function hp(page: Page): Promise<[number, number]> {
  const label = await page.getByRole("button", { name: /^生命 \d+\/\d+$/ }).getAttribute("aria-label");
  const m = /(\d+)\/(\d+)/.exec(label ?? "")!;
  return [Number(m[1]), Number(m[2])];
}

export async function takeDamage(page: Page, n: number) {
  await page.getByRole("button", { name: /^生命 / }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "数值" }).fill(String(n));
  await dialog.getByRole("button", { name: `伤害 ${n}`, exact: true }).click();
  await expect(dialog).toBeHidden();
}

export const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true }).click();
