import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('Coulomb: the force falls to a quarter at twice the distance', async ({ page }) => {
	await page.goto('/electromagnetism/#force');
	await expect(stage(page)).toContainText('8.99 µN');
	await expect(stage(page)).toContainText('10.0 cm');
	// Move the test charge 10 cm further away with the keyboard (0.5 cm per press).
	await page.getByRole('slider', { name: /Test charge/ }).focus();
	for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('20.0 cm');
	await expect(stage(page)).toContainText('2.25 µN');
	// Twice the charge, twice the force.
	await page.locator('input[type=range][data-control=charge]').fill('20');
	await expect(stage(page)).toContainText('4.49 µN');
});

test('charges can be added, flipped and removed', async ({ page }) => {
	await page.goto('/electromagnetism/#field');
	const charges = page.getByRole('slider', { name: /charge \d/ });
	await expect(charges).toHaveCount(2);
	await page.locator('button[data-control=addPlus]').click();
	await expect(charges).toHaveCount(3);
	await expect(page.getByRole('slider', { name: /^Positive charge 3/ })).toBeAttached();
	await page.getByRole('slider', { name: /charge 3/ }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('slider', { name: /^Negative charge 3/ })).toBeAttached();
	await page.keyboard.press('Delete');
	await expect(charges).toHaveCount(2);
});

test('a current turns the compasses; a still magnet induces nothing', async ({ page }) => {
	await page.goto('/electromagnetism/#wire');
	await expect(stage(page)).toContainText('50 µT');
	await page.locator('input[type=range][data-control=wireCurrent]').fill('10');
	await expect(stage(page)).toContainText('100 µT');

	await page.goto('/electromagnetism/#magnet');
	await page.locator('button[data-control=motion][data-value=hand]').click();
	await expect(stage(page)).toContainText('still: no current');
	await expect(stage(page)).toContainText('0.0 mA');

	await page.goto('/electromagnetism/#neighbour');
	await page.locator('input[type=range][data-control=acFreq]').fill('0');
	await expect(stage(page)).toContainText('steady 2 A');
	await expect(stage(page)).toContainText('0.0 µA');
	// Setting coil A's current by hand: once it is held still, nothing is induced.
	await page.locator('input[type=range][data-control=currentA]').fill('1.5');
	await expect(stage(page)).toContainText('you set it: 1.5 A');
	await expect(stage(page)).toContainText('1.50 A');
	await expect(stage(page)).toContainText('0.0 µA');
});
