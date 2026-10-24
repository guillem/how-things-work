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
	await expect(page.locator('.stage')).toContainText('The red space is left uncovered');
	await add.click();
	await expect(page.locator('.stage')).toContainText('One tile too many: overlap');
	await expect(page.locator('.stage')).toContainText('Overlap: tap to start again');
	await page.locator('button[data-control=pentagon][data-value="6"]').click();
	await expect(page.locator('.stage')).toContainText('1 corner: a gap remains');
	await add.click();
	await add.click();
	await expect(page.locator('.stage')).toContainText('3 corners: one full turn');
});
test('six triangle corners close the turn and fill the floor', async ({ page }) => {
	await page.goto('./shapes-that-tile/#triangle');
	const add = page.getByRole('button', { name: 'Add a tile around the corner' });
	for (let i = 0; i < 4; i++) await add.click();
	await expect(page.locator('.stage')).toContainText('5 corners: a gap remains');
	await expect(page.locator('.stage')).toContainText('Keep adding corners');
	await add.click();
	await expect(page.locator('.stage')).toContainText('6 corners: one full turn');
	await expect(page.locator('.stage')).toContainText('No gaps or overlaps');
});
test('two octagon corners leave a hole and a third overlaps', async ({ page }) => {
	await page.goto('./shapes-that-tile/#octagon');
	const add = page.getByRole('button', { name: 'Add a tile around the corner' });
	await add.click();
	await expect(page.locator('.stage')).toContainText('2 corners: a gap remains');
	await expect(page.locator('.stage')).toContainText('The red space is left uncovered');
	await add.click();
	await expect(page.locator('.stage')).toContainText('One tile too many: overlap');
});
test('a keyboard bend flips the matching edges on the stage and moves the slider', async ({
	page
}) => {
	await page.goto('./shapes-that-tile/#bend');
	const handle = page.getByRole('slider', { name: 'Bend the matching edges' });
	await expect(page.locator('.stage')).toContainText('Bulge at the top, hollow below');
	await handle.focus();
	await handle.press('Home');
	await expect(page.locator('input[data-control=bend]')).toHaveValue('-25');
	await expect(page.locator('.stage')).toContainText('Hollow at the top, bulge below');
	await expect(handle).toHaveAttribute('aria-valuetext', /top half bent in/);
	await handle.press('End');
	await expect(page.locator('input[data-control=bend]')).toHaveValue('25');
	await expect(page.locator('.stage')).toContainText('Bulge at the top, hollow below');
});
test('dragging the bend handle left flips the bend, and the slider follows', async ({ page }) => {
	await page.goto('./shapes-that-tile/#bend');
	const handle = page.getByRole('slider', { name: 'Bend the matching edges' });
	await expect(page.locator('.stage')).toContainText('Bulge at the top, hollow below');
	const box = await handle.boundingBox();
	if (!box) throw new Error('the bend handle is not on screen');
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x - 40, y, { steps: 4 });
	await page.mouse.move(x - 120, y, { steps: 4 });
	await page.mouse.up();
	await expect(page.locator('input[data-control=bend]')).toHaveValue('-25');
	await expect(page.locator('.stage')).toContainText('Hollow at the top, bulge below');
});
