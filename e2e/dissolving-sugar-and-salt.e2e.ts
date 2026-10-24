import { expect, test, type Page } from '@playwright/test';
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
async function open(page: Page, step: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`./dissolving-sugar-and-salt/#${step}`);
	await expect(stage(page)).toBeVisible();
}

test('weighed spoonfuls dissolve until salt reaches its measured limit', async ({ page }) => {
	await open(page, 'spoon');
	const add = page.getByRole('button', { name: 'Tip in another spoonful' });
	await add.click();
	await expect(stage(page).getByText('20 g dissolved', { exact: true })).toHaveCount(2);
	await add.click();
	await expect(stage(page)).toContainText('36 g dissolved');
	await expect(stage(page)).toContainText('4 g in grains on the bottom');
	await expect(stage(page)).toContainText('40 g dissolved');
});

test('warming sixteen spoonfuls dissolves all the sugar but barely any more salt', async ({
	page
}) => {
	await open(page, 'warm');
	await expect(stage(page)).toContainText('204 g dissolved');
	await expect(stage(page)).toContainText('36 g dissolved');
	await page.locator('input[data-control="warm"]').fill('80');
	await expect(stage(page)).toContainText('320 g dissolved');
	await expect(stage(page)).toContainText('0 g in grains on the bottom');
	await expect(stage(page)).toContainText('38 g dissolved');
	await expect(stage(page)).toContainText('Limit now: 363 g · about 18 spoonfuls');
	await expect(stage(page)).toContainText('Limit now: 38 g · about 2 spoonfuls');
});

test('cooling makes sugar crystals and evaporation recovers all added solid', async ({ page }) => {
	await open(page, 'cool');
	await page.locator('input[data-control="cool"]').fill('0');
	await expect(stage(page)).toContainText('141 g in grains on the bottom');
	await open(page, 'dry');
	await page.locator('input[data-control="dry"]').fill('100');
	await expect(stage(page).getByText('0 g dissolved', { exact: true })).toHaveCount(2);
	await expect(stage(page).getByText('200 g in grains on the bottom', { exact: true })).toHaveCount(
		2
	);
});

test('phone readouts explain both glasses and remaining water', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, 'warm');
	await page.locator('input[data-control="warm"]').fill('80');
	await expect(page.getByText('320 g dissolved · 0 g in grains', { exact: true })).toBeVisible();
	await expect(page.getByText('38 g dissolved · 282 g in grains', { exact: true })).toBeVisible();
	await expect(
		page.getByText('Limit now: 363 g (about 18 spoonfuls).', { exact: true })
	).toBeVisible();
});

test('below saturation the caption does not claim a balance with leftover grains', async ({
	page
}) => {
	await open(page, 'full');
	await page.locator('input[data-control="spoons"]').fill('1');
	await expect(stage(page)).toContainText('Below the limit, every grain dissolves');
	await expect(stage(page).getByText('0 g in grains on the bottom', { exact: true })).toHaveCount(
		2
	);
});
