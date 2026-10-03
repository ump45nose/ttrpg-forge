import { expect, test } from '@playwright/test';
import { hp, takeDamage } from './helpers';

const base = process.env.VITE_BASE_PATH || '/ttrpg-forge/';
const app = (route = '/') => `${base}#${route}`;

test('Pages: manifest, icons, scoped worker and real PHB pack', async ({ page, request }) => {
  const response = await page.goto(app('/settings'));
  expect(response?.status()).toBe(200);
  await expect(page.getByText(/phb-2024 · v/)).toBeVisible();
  const manifest = await (await request.get(`${base}manifest.webmanifest`)).json();
  expect(manifest.scope).toBe(base);
  expect(manifest.start_url).toBe(app());
  for (const icon of manifest.icons) {
    expect((await request.get(new URL(icon.src, `http://127.0.0.1:4181${base}`))).ok()).toBe(true);
  }
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe(base);
  expect((await request.get(`${base}settings`)).status()).toBe(404); // server has no hidden rewrite
  await page.goto(app());
  await expect(page.locator(`img[src="${base}icon.svg"]`)).toBeVisible();
});

test('Pages: character deep link reload, builder, back and forward', async ({ page }) => {
  await page.goto(app());
  await page.getByRole('button', { name: /布伦·铁誓/ }).click();
  await expect(page).toHaveURL(/#\/c\/[0-9A-Z]+$/);
  const character = page.url();
  await takeDamage(page, 3);
  const before = await hp(page);
  await page.reload();
  expect(await hp(page)).toEqual(before);
  await page.getByRole('button', { name: '编辑构筑' }).click();
  await expect(page).toHaveURL(/#\/c\/[0-9A-Z]+\/build/);
  await page.getByText(/^职业$/).first().click();
  await page.reload();
  await expect(page.getByRole('button', { name: /^战士/ }).first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(character);
  await expect(page.getByRole('button', { name: /^生命 / })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/build/);
});

test('Pages: offline PHB, lazy pages and previously viewed art survive reload', async ({ page, context }) => {
  await page.goto(app());
  await page.getByRole('button', { name: /米拉·轻步/ }).click();
  await expect(page.getByRole('button', { name: /^生命 / })).toBeVisible();
  const picture = page.locator('img[src*="/art/"]').first();
  await expect(picture).toBeVisible();
  await expect.poll(() => picture.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(async () => page.evaluate(async () => {
    const cache = await caches.open(`forge${location.pathname}art`);
    return (await cache.keys()).some((r) => r.url.includes('/art/'));
  })).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await takeDamage(page, 2);
  await page.goto(app('/settings'));
  await expect(page.getByText(/phb-2024 · v/)).toBeVisible();
  await page.goto(app('/p/workshop'));
  await expect(page.getByRole('button', { name: /^法术 / })).toBeVisible();
  await page.goto(app());
  await page.getByText('米拉·轻步').first().click();
  await page.getByRole('button', { name: '编辑构筑' }).click();
  await expect(page).toHaveURL(/\/build/);
  await page.getByText(/^职业$/).first().click();
  await expect(page.getByRole('button', { name: /^游荡者/ }).first()).toBeVisible();
});
