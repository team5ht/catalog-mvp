const { test, expect } = require('@playwright/test');

async function expectCoverImageDimensions(imageLocator) {
  await expect(imageLocator).toHaveAttribute('width', '480');
  await expect(imageLocator).toHaveAttribute('height', '640');
}

async function expectCoverContainerRatio(containerLocator) {
  const ratio = await containerLocator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width / rect.height;
  });
  expect(ratio).toBeCloseTo(0.75, 2);
}

test('home route renders and loads materials', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('h1.page-title')).toHaveText('Каталог материалов');

  const heroImage = page.locator('#homeHeroImage img.home-banner__img');
  await expect(heroImage).toBeVisible();
  await expect(heroImage).toHaveAttribute('fetchpriority', 'high');
  await expect(heroImage).toHaveAttribute('width', '1280');
  await expect(heroImage).toHaveAttribute('height', '480');

  await expect(page.locator('#main-materials .material-card').first()).toBeVisible();
  const homeCoverContainer = page.locator('#main-materials .material-card__cover').first();
  const homeCoverImage = homeCoverContainer.locator('img');
  await expect(homeCoverImage).toBeVisible();
  await expectCoverImageDimensions(homeCoverImage);
  await expectCoverContainerRatio(homeCoverContainer);
  await expect(page.locator('#materials-5ht .material-card').first()).toBeVisible();

  const hasInlineHomeCoverBackground = await page
    .locator('#main-materials .material-card__cover')
    .first()
    .evaluate((element) => String(element.getAttribute('style') || '').includes('background-image'));
  expect(hasInlineHomeCoverBackground).toBeFalsy();
});

test('catalog search and category filtering work', async ({ page }) => {
  await page.goto('/#/catalog');

  const cards = page.locator('#catalog-list .catalog-card');
  await expect(cards.first()).toBeVisible();
  const catalogCoverContainer = page.locator('#catalog-list .catalog-card__cover').first();
  const catalogCoverImage = catalogCoverContainer.locator('img');
  await expect(catalogCoverImage).toBeVisible();
  await expectCoverImageDimensions(catalogCoverImage);
  await expectCoverContainerRatio(catalogCoverContainer);

  const hasInlineCatalogCoverBackground = await page
    .locator('#catalog-list .catalog-card__cover')
    .first()
    .evaluate((element) => String(element.getAttribute('style') || '').includes('background-image'));
  expect(hasInlineCatalogCoverBackground).toBeFalsy();

  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(1);

  await page.locator('#catalogSearchInput').fill('JavaScript');
  await expect(cards).toHaveCount(1);
  await expect(page.locator('#catalog-list .catalog-card__title-link').first()).toContainText('JavaScript');

  await page.locator('button.catalog-categories__button:has-text("Книга")').click();
  await expect(cards).toHaveCount(0);
  await expect(page.locator('#catalog-list .empty-state')).toBeVisible();
});

test('material guest CTA redirects to auth with redirect hash', async ({ page }) => {
  await page.goto('/#/material/1');

  const materialCoverContainer = page.locator('#materialCover');
  const materialCoverImage = materialCoverContainer.locator('img.material-page__cover-img');
  await expect(materialCoverImage).toBeVisible();
  await expectCoverImageDimensions(materialCoverImage);
  await expectCoverContainerRatio(materialCoverContainer);
  const hasInlineMaterialBackground = await page
    .locator('#materialCover')
    .evaluate((element) => String(element.getAttribute('style') || '').includes('background-image'));
  expect(hasInlineMaterialBackground).toBeFalsy();

  const description = page.locator('#materialDescription');
  await expect(description.locator('p').first()).toContainText('Поведенческая активация - доказательный психотерапевтический протокол лечения депрессии.');
  await expect(description.locator('ul')).toHaveCount(1);
  const descriptionListItems = description.locator('ul > li');
  await expect(descriptionListItems).toHaveCount(7);
  await expect(descriptionListItems.first()).toHaveText('Психообразовательный блок');

  const downloadButton = page.locator('#downloadBtn');
  await expect(downloadButton).toHaveText('Войти и скачать');
  await downloadButton.click();

  await expect(page).toHaveURL(/#\/auth\?redirect=%23%2Fmaterial%2F1/);
});

test('material with plain description renders single paragraph', async ({ page }) => {
  await page.goto('/#/material/2');

  const description = page.locator('#materialDescription');
  await expect(description.locator('ul')).toHaveCount(0);
  await expect(description.locator('p')).toHaveCount(1);
  await expect(description.locator('p').first()).toContainText('Изучите принципы создания удобных и красивых интерфейсов.');
});

test('account route redirects guest to auth', async ({ page }) => {
  await page.goto('/#/account');
  await expect(page).toHaveURL(/#\/auth\?redirect=%23%2Faccount/);
});

test('forgot auth mode renders OTP recovery stepper', async ({ page }) => {
  await page.goto('/#/auth?mode=forgot');
  await expect(page.locator('#authTitle')).toHaveText('Восстановление пароля');
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 1 из 3');
  await expect(page.locator('#authRecoveryEmail')).toBeVisible();
});

test('legacy recovery mode redirects to forgot OTP flow', async ({ page }) => {
  await page.goto('/#/auth?mode=recovery');
  await expect(page).toHaveURL(/#\/auth\?.*mode=forgot/);
  await expect(page.locator('#authStatus')).toContainText('Ссылки восстановления отключены');
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
