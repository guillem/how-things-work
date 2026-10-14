import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test.describe('finished frames (reduced motion)', () => {
	test.use({ reducedMotion: 'reduce' });

	test('more slow lanes shade the image faster than the fast core', async ({ page }) => {
		await open(page, './gpu/#race');
		await expect(stage(page)).toContainText('226× faster than the fast core');
		// One warp of 32 lanes is still about 7 times faster.
		await page.locator('input[type=range][data-control=lanes]').fill('5');
		await expect(stage(page)).toContainText('32 slow lanes');
		await expect(stage(page)).toContainText('7× faster than the fast core');
	});

	test('a matrix product keeps every lane busy', async ({ page }) => {
		await open(page, './gpu/#matmul');
		await expect(stage(page)).toContainText('4,096× faster than the fast core');
		await expect(stage(page)).toContainText('lanes kept busy: 100%');
	});

	test('a warp across the edge of the ball runs both sides of the branch', async ({ page }) => {
		await open(page, './gpu/#divergence');
		await expect(stage(page)).toContainText('25 ticks for all 32 pixels: both sides run');
		await page.locator('[data-control=warp][data-value=sky]').click();
		await expect(stage(page)).toContainText('11 ticks for all 32 pixels');
		await expect(stage(page)).toContainText('lanes doing work: 100%');
	});

	test('wide tiles lift a matrix product off the memory slope', async ({ page }) => {
		await open(page, './gpu/#tiles');
		await expect(stage(page)).not.toContainText('full arithmetic speed');
		await page.locator('input[type=range][data-control=tile]').fill('9');
		await expect(stage(page)).toContainText('full arithmetic speed');
		await expect(stage(page)).toContainText('82.6 TFLOP/s');
	});

	test('the serial share sets a ceiling on the speed-up', async ({ page }) => {
		await open(page, './gpu/#amdahl');
		await page.locator('input[type=range][data-control=workers]').fill('14');
		await expect(stage(page)).toContainText('ceiling: 1 ÷ 5% = 20×');
		await expect(stage(page)).toContainText('16,384 workers: 20× faster');
		await page.locator('input[type=range][data-control=serial]').fill('0');
		await expect(stage(page)).toContainText('no ceiling');
		await expect(stage(page)).toContainText('16,384 workers: 16,384× faster');
	});

	test('with much work in sequence the fast core wins, unless the two share', async ({ page }) => {
		await open(page, './gpu/#ceiling');
		await page.locator('input[type=range][data-control=serial]').fill('30');
		await expect(stage(page)).toContainText('The fast core wins');
		await page.locator('input[type=checkbox][data-control=hybrid]').check({ force: true });
		await expect(stage(page)).toContainText('The two together win');
	});
});

test('the lanes finish while the fast core has barely started', async ({ page }) => {
	await page.clock.install();
	await page.goto('./gpu/#race');
	await playUntil(page, stage(page), 'done in 623 ticks', 10_000);
	// The fast core is still on its first rows: under 5 % of the image.
	await expect(stage(page)).toContainText(/of 40,960 pixels \((0\.\d|[1-4])%\)/);
});
