import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('counting arrangements: C(N, k) microstates and the chance of all on the left', async ({
	page
}) => {
	await page.goto('/entropy/#spread');
	await expect(stage(page)).toContainText('microstates for each macrostate, C(40, k)');
	await expect(stage(page)).toContainText('every arrangement: 2⁴⁰ = 1.1 × 10¹²');
	await page.locator('input[type=range][data-control=particles]').fill('4');
	await expect(stage(page)).toContainText('chance of all on the left: 1 in 16');
});

test('sharing energy: the even split is the peak, ten million times the start', async ({
	page
}) => {
	await page.goto('/entropy/#share');
	await expect(stage(page)).toContainText('the peak has 2.4 × 10⁷ times as many');
	await page.locator('input[type=range][data-control=share]').fill('50');
	await expect(stage(page)).toContainText('this is the most likely share');
	// Keyboard on the draggable handle moves the share too.
	const handle = page.getByRole('slider', { name: 'Share of the energy on the left' });
	await handle.focus();
	await page.keyboard.press('End');
	await expect(page.locator('input[type=range][data-control=share]')).toHaveValue('100');
});

test('reversing every velocity runs the film backward', async ({ page }) => {
	await page.goto('/entropy/#backward');
	await expect(stage(page)).toContainText('▶ forward in time');
	await page.waitForTimeout(2500); // let the wall lift
	await page.locator('button[data-control=reverse]').click();
	// Backward until it is back at the start, about 1.5 s later.
	await expect(stage(page)).toContainText(/every velocity reversed|back at the start/, {
		timeout: 3000
	});
});
