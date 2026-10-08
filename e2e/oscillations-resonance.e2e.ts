import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('the natural frequency halves when the mass is four times larger', async ({ page }) => {
	await page.goto('/oscillations-resonance/#spring');
	await expect(stage(page)).toContainText('natural frequency');
	await expect(stage(page)).toContainText('0.99 Hz');
	await page.locator('input[type=range][data-control=mass]').fill('4');
	await expect(stage(page)).toContainText('0.50 Hz');
	await expect(stage(page)).toContainText('4.00 kg');
});

test('the resonance curve peaks at the natural frequency', async ({ page }) => {
	await page.goto('/oscillations-resonance/#curve');
	await expect(stage(page)).toContainText('steady swing against push frequency');
	await expect(stage(page)).toContainText('peak at 0.99 Hz');
	// More friction lowers the peak and moves it a little below f₀.
	await page.locator('input[type=range][data-control=damping]').fill('3');
	await expect(stage(page)).toContainText('peak at 0.93 Hz');
});
