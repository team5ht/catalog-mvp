const { test, expect } = require('@playwright/test');

test('home route renders and loads materials', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('h1.page-title')).toHaveText('Каталог материалов');
  await expect(page.locator('#main-materials .material-card').first()).toBeVisible();
  await expect(page.locator('#materials-5ht .material-card').first()).toBeVisible();
});

test('catalog search and category filtering work', async ({ page }) => {
  await page.goto('/#/catalog');

  const cards = page.locator('#catalog-list .catalog-card');
  await expect(cards.first()).toBeVisible();
  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(1);

  await page.locator('#catalogSearchInput').fill('JavaScript');
  await expect(cards).toHaveCount(1);
  await expect(page.locator('#catalog-list .catalog-card__title-link').first()).toContainText('JavaScript');

  await page.locator('button.catalog-categories__button:has-text("Дизайн")').click();
  await expect(cards).toHaveCount(0);
  await expect(page.locator('#catalog-list .empty-state')).toBeVisible();
});

test('material guest CTA redirects to auth with redirect hash', async ({ page }) => {
  await page.goto('/#/material/1');

  const downloadButton = page.locator('#downloadBtn');
  await expect(downloadButton).toHaveText('Войти и скачать');
  await downloadButton.click();

  await expect(page).toHaveURL(/#\/auth\?redirect=%23%2Fmaterial%2F1/);
});

test('account route redirects guest to auth', async ({ page }) => {
  await page.goto('/#/account');
  await expect(page).toHaveURL(/#\/auth\?redirect=%23%2Faccount/);
});

test('forgot auth mode renders recovery form', async ({ page }) => {
  await page.goto('/#/auth?mode=forgot');
  await expect(page.locator('#authTitle')).toHaveText('Восстановление пароля');
  await expect(page.locator('#authRecoveryEmail')).toBeVisible();
});

test('unknown route redirects to home', async ({ page }) => {
  await page.goto('/#/unknown');
  await expect(page).toHaveURL(/#\//);
  await expect(page.locator('h1.page-title')).toHaveText('Каталог материалов');
});

test('bottom nav active state follows route', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('#nav-home')).toHaveClass(/bottom-nav__button--active/);

  await page.goto('/#/catalog');
  await expect(page.locator('#nav-catalog')).toHaveClass(/bottom-nav__button--active/);

  await page.goto('/#/auth');
  await expect(page.locator('#nav-account')).toHaveClass(/bottom-nav__button--active/);
});
