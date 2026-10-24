import { expect, test } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test('four square corners fill a floor, then the next tap starts again', async ({ page }) => {
	await page.goto('./shapes-that-tile/#square');
	const add = page.getByRole('button', { name: 'Add a tile around the corner' });
	await expect(add).toBeVisible();
	for (let i = 0; i < 3; i++) await add.click();
	await expect(page.locator('.stage')).toContainText('4 corners: one full turn');
	await expect(page.locator('.stage')).toContainText('No gaps or overlaps');
	await add.press('Enter');
	await expect(page.locator('.stage')).toContainText('1 corner: a gap remains');
});
test('a regular pentagon leaves a gap, then overlaps; choosing hexagons resets the experiment', async ({
	page
}) => {
	await page.goto('./shapes-that-tile/#pentagon');
	const add = page.getByRole('button', { name: 'Add a tile around the corner' });
	await add.click();
	await add.click();
	await expect(page.locator('.stage')).toContainText('3 corners: a gap remains');
	await add.click();
	await expect(page.locator('.stage')).toContainText('One tile too many: overlap');
	await page.locator('button[data-control=pentagon][data-value="6"]').click();
	await expect(page.locator('.stage')).toContainText('1 corner: a gap remains');
	await add.click();
	await add.click();
	await expect(page.locator('.stage')).toContainText('3 corners: one full turn');
});
test('a keyboard bend moves both matching edges and the slider', async ({ page }) => {
	await page.goto('./shapes-that-tile/#bend');
	const handle = page.getByRole('slider', { name: 'Bend the matching edges' });
	await handle.focus();
	await handle.press('Home');
	await expect(page.locator('input[data-control=bend]')).toHaveValue('-25');
	await expect(page.locator('.stage')).toContainText('still no gaps');
	await handle.press('End');
	await expect(page.locator('input[data-control=bend]')).toHaveValue('25');
});
