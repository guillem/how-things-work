import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const picture = (page: Page) => page.getByRole('application', { name: /Mandelbrot set/ });

async function open(page: Page) {
	await page.goto('/chaos-fractals/#zoom');
	await expect(stage(page)).toContainText('magnification');
	await expect(stage(page)).toContainText('× 1');
}

test('choosing a place flies there and changes the magnification', async ({ page }) => {
	await open(page);
	await page.locator('button[data-control=place][data-value="seahorse"]').click();
	await expect(stage(page)).toContainText('× 320');
	await page.locator('button[data-control=place][data-value="minibrot"]').click();
	await expect(stage(page)).toContainText('× 80');
});

test('the keyboard pans and zooms the picture without changing the step', async ({ page }) => {
	await open(page);
	await picture(page).focus();
	await page.keyboard.press('+');
	await expect(stage(page)).toContainText('× 2');
	await page.keyboard.press('+');
	await expect(stage(page)).toContainText('× 4');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('-');
	await expect(stage(page)).toContainText('× 2');
	// The keys moved the picture; they did not change the step.
	await expect(page).toHaveURL(/#zoom$/);
	// The view is remembered across steps.
	await page.evaluate(() => (location.hash = '#mandelbrot'));
	await expect(stage(page)).toContainText('z → z² + c');
	await page.evaluate(() => (location.hash = '#zoom'));
	await expect(stage(page)).toContainText('× 2');
});
