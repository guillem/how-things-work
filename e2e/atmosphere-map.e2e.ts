import { expect, test, type Page } from '@playwright/test';

const centres = (page: Page) => page.getByRole('slider', { name: /pressure centre/ });
const lows = (page: Page) => page.getByRole('slider', { name: /^Low pressure centre/ });
const action = (page: Page, id: string) => page.locator(`.action button[data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(centres(page).first()).toBeAttached();
}

test('adding a low puts a new low-pressure marker on the map', async ({ page }) => {
	await open(page, '/atmosphere-weather/#pressure');
	await expect(lows(page)).toHaveCount(1);
	await expect(centres(page)).toHaveCount(2);
	await action(page, 'addLow').click();
	await expect(lows(page)).toHaveCount(2);
	await expect(centres(page)).toHaveCount(3);
	await expect(lows(page).nth(1)).toHaveAttribute('aria-label', /^Low pressure centre, \d+ hPa$/);
});

test('clearing the map removes every system, and the map is kept per step', async ({ page }) => {
	await open(page, '/atmosphere-weather/#pressure');
	await action(page, 'clearMap').click();
	await expect(centres(page)).toHaveCount(0);
	await expect(page.locator('.stage svg')).toContainText('An empty map');
	// The fronts step has its own map, with its default low.
	await page.evaluate(() => (location.hash = '#fronts'));
	await expect(lows(page)).toHaveCount(1);
	await page.evaluate(() => (location.hash = '#pressure'));
	await expect(centres(page)).toHaveCount(0);
});
