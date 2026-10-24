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
	// The text's room-temperature limit for salt: 1.8 spoonfuls, less than two.
	await expect(stage(page)).toContainText('Limit now: 36 g · 1.8 spoonfuls');
	await page.locator('input[data-control="warm"]').fill('80');
	await expect(stage(page)).toContainText('320 g dissolved');
	await expect(stage(page)).toContainText('0 g in grains on the bottom');
	await expect(stage(page)).toContainText('38 g dissolved');
	await expect(stage(page)).toContainText('Limit now: 363 g · 18.2 spoonfuls');
	await expect(stage(page)).toContainText('Limit now: 38 g · 1.9 spoonfuls');
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
	await expect(page.getByText('Limit now: 363 g (18.2 spoonfuls).', { exact: true })).toBeVisible();
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

test('the add button stops at twenty spoonfuls', async ({ page }) => {
	await open(page, 'spoon');
	const add = page.getByRole('button', { name: 'Tip in another spoonful' });
	for (let i = 0; i < 20; i++) await add.click();
	await expect(stage(page)).toContainText('400 g added');
	await expect(add).toBeDisabled();
});

test('the dissolved sugar adds its weight to the glass', async ({ page }) => {
	await open(page, 'particles');
	await expect(stage(page)).toContainText('20 g added · everything in it weighs 120 g');
});

test('half the water dried away: fewer water dots, grains back on the bottom', async ({ page }) => {
	await open(page, 'dry');
	const waterDots = stage(page).locator('.water-dots circle');
	await expect(waterDots).toHaveCount(56);
	await expect(stage(page).getByText('0 g in grains on the bottom', { exact: true })).toHaveCount(
		1
	);
	await page.locator('input[data-control="dry"]').fill('50');
	await expect(waterDots).toHaveCount(28);
	await expect(stage(page)).toContainText('98 g in grains on the bottom');
	await expect(stage(page)).toContainText('182 g in grains on the bottom');
	await expect(stage(page)).toContainText('200 g added · everything in it weighs 250 g');
});
