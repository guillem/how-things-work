import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('paint: clicking a square brings it to life; Step moves to the next picture', async ({
	page
}) => {
	await open(page, './life-on-a-grid/#paint', 'picture 1 · 12 squares alive');
	const grid = page.getByRole('button', { name: /Paint squares/ });
	await grid.click({ position: { x: 10, y: 10 } });
	await expect(stage(page)).toContainText('picture 1 · 13 squares alive');
	await page.getByRole('button', { name: 'Step', exact: true }).click();
	await expect(stage(page)).toContainText('picture 2');
});

test('paint by keyboard: Enter switches the square under the cursor', async ({ page }) => {
	await open(page, './life-on-a-grid/#paint', '12 squares alive');
	const grid = page.getByRole('button', { name: /Paint squares/ });
	await grid.focus();
	await grid.press('Enter');
	await expect(stage(page)).toContainText('13 squares alive');
});

test('rules: the squares about to die and to be born are counted', async ({ page }) => {
	await open(page, './life-on-a-grid/#rules', '4 about to die (red) · 4 about to be born (green)');
});

test('together: updating one square at a time breaks the shapes', async ({ page }) => {
	await open(page, './life-on-a-grid/#together', 'all squares at once');
	await page.locator('input[type=checkbox][data-control=onebyone]').check();
	await expect(stage(page)).toContainText('one square at a time: the shapes break');
});

test('rule: the birth number can be changed', async ({ page }) => {
	await open(page, './life-on-a-grid/#rule', 'birth needs 3 neighbours (Conway’s rule)');
	await page.locator('input[type=range][data-control=birth]').fill('2');
	await expect(stage(page)).toContainText('birth needs 2 neighbours');
});

test('press play: the reader’s own painting runs, and pausing holds the picture', async ({
	page
}) => {
	await open(page, './life-on-a-grid/#paint', '12 squares alive');
	await page.getByRole('button', { name: /Paint squares/ }).click({ position: { x: 10, y: 10 } });
	await expect(stage(page)).toContainText('13 squares alive');
	await page.getByRole('button', { name: 'Next step' }).click();
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#yours$/);
	// With reduced motion the frozen frame shows picture 8 of the painting.
	await expect(stage(page)).toContainText('picture 8');
	await page.locator('input[type=checkbox][data-control=play]').uncheck();
	await expect(stage(page)).toContainText('picture 8');
});
