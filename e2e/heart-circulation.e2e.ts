import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('a faster heart pumps less per beat but more per minute', async ({ page }) => {
	await page.goto('/heart-circulation/#rate');
	await expect(stage(page)).toContainText('cardiac output');
	await expect(stage(page)).toContainText('75 mL');
	await expect(stage(page)).toContainText('5.6 L/min');
	await page.locator('input[type=range][data-control=hr]').fill('150');
	await expect(stage(page)).toContainText('47 mL');
	await expect(stage(page)).toContainText('7.1 L/min');
});

test('narrower arteries raise the blood pressure', async ({ page }) => {
	await page.goto('/heart-circulation/#narrow');
	await expect(stage(page)).toContainText('×1.52');
	await page.locator('input[type=range][data-control=width]').fill('100');
	await expect(stage(page)).toContainText('×1.00');
	await expect(stage(page)).toContainText('123/78');
});

test('a leaking valve sends blood backwards', async ({ page }) => {
	await page.goto('/heart-circulation/#leak');
	await expect(stage(page)).toContainText('leaks back');
	await expect(stage(page)).toContainText('51 mL');
	await page.locator('input[type=range][data-control=leak]').fill('0');
	await expect(stage(page)).toContainText('0 mL');
});

test('the two pumps in series send out the same volume', async ({ page }) => {
	await page.goto('/heart-circulation/#loop');
	await expect(stage(page)).toContainText('right pump → lungs');
	await expect(stage(page).getByText('75 mL')).toHaveCount(2);
});
