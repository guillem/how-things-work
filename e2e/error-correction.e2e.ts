import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('the failing checks locate a flipped bit, wherever it is', async ({ page }) => {
	await page.goto('/error-correction/#repair');
	await expect(stage(page)).toContainText('position 5');
	await expect(stage(page)).toContainText('same as the message: repaired');
	// move the error from bit 5 to bit 3
	await page.getByRole('switch', { name: 'Flip received bit 5' }).click();
	await page.getByRole('switch', { name: 'Flip received bit 3' }).press('Enter');
	await expect(stage(page)).toContainText('check 1 + check 2 → position 3');
	await expect(stage(page)).toContainText('repaired');
});

test('two flips are mistaken for one and give wrong data', async ({ page }) => {
	await page.goto('/error-correction/#two');
	await expect(stage(page)).toContainText('position 6');
	await expect(stage(page)).toContainText('three bits wrong');
});

test('without noise the whole message arrives intact on both lanes', async ({ page }) => {
	await page.goto('/error-correction/#compare');
	await expect(stage(page)).toContainText('At 5.0% noise');
	await page.locator('input[type=range][data-control="noise"]').fill('0');
	await expect(stage(page)).toContainText('47 of 47 letters intact · 0 flips repaired');
	await expect(stage(page).getByText('47 of 47 letters intact', { exact: true })).toBeVisible();
});
