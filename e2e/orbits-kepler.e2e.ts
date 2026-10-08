import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('launched slower than circular speed, the planet goes round an ellipse', async ({ page }) => {
	await open(page, '/orbits-kepler/#launch');
	await expect(stage(page)).toContainText('Your launch');
	await page.locator('input[type=range][data-control=speed]').fill('0.8');
	await expect(stage(page)).toContainText(/Path\s*ellipse/);
	await expect(stage(page)).toContainText('23.8 km/s');
	await expect(stage(page)).not.toContainText('escape (');
});

test('launched above the escape speed, the planet escapes on a hyperbola', async ({ page }) => {
	await open(page, '/orbits-kepler/#launch');
	await page.locator('input[type=range][data-control=speed]').fill('1.6');
	await expect(stage(page)).toContainText(/Path\s*escape \(hyperbola\)/);
	await expect(stage(page)).toContainText('never comes back');
});
