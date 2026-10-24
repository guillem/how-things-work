import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
async function open(page: Page, step: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`./flocking-birds/#${step}`);
	await expect(stage(page)).toContainText('100 birds · no leader');
}

test('matching neighbours changes a milling group into a flock', async ({ page }) => {
	await open(page, 'direction');
	await expect(stage(page)).toContainText('Mostly the same way');
	await page.locator('input[data-control=alignment]').uncheck();
	await expect(stage(page)).toContainText('Same way · off');
	await expect(stage(page)).toContainText('Many different directions');
});

test('turning spacing off produces crowded clumps', async ({ page }) => {
	await open(page, 'space');
	await expect(stage(page)).toContainText('0 very close pairs');
	await page.locator('input[data-control=spacing]').uncheck();
	await expect(stage(page)).toContainText('Space · off');
	await expect(stage(page)).toContainText('288 very close pairs');
});

test('without gathering the neighbours are farther apart', async ({ page }) => {
	await open(page, 'together');
	await expect(stage(page)).toContainText('Nearest bird: about 1.5 bird lengths away (on average)');
	await page.locator('input[data-control=cohesion]').uncheck();
	await expect(stage(page)).toContainText('Nearest bird: about 2 bird lengths away (on average)');
});

test('a passing hawk adds a local danger without changing bird count', async ({ page }) => {
	await open(page, 'hawk');
	await expect(stage(page)).not.toContainText('Nearby birds turn away');
	await page.locator('input[data-control=hawk]').check();
	await expect(stage(page)).toContainText('Nearby birds turn away from the hawk');
	await expect(stage(page).getByText('hawk', { exact: true })).toBeVisible();
});

test('following another bird changes the watched neighbourhood', async ({ page }) => {
	await open(page, 'follow');
	const ring = stage(page).locator('circle[stroke-width="2.5"]');
	const x = await ring.getAttribute('cx');
	await page.getByRole('button', { name: 'Follow another bird', exact: true }).click();
	await expect(ring).not.toHaveAttribute('cx', x!);
});

test('after the hawk passes, the animated flock regains a shared direction', async ({ page }) => {
	await page.clock.install();
	await page.goto('./flocking-birds/#hawk');
	await expect(stage(page)).toContainText('100 birds · no leader');
	await page.locator('input[data-control=hawk]').check();
	await page.clock.runFor(10_000);
	await expect(stage(page)).toContainText('Nearby birds turn away from the hawk');
	await page.clock.runFor(16_000);
	await expect(stage(page)).toContainText('The hawk has passed · neighbours gather again');
	await expect(stage(page)).toContainText('Mostly the same way');
	await expect(stage(page).getByText('hawk', { exact: true })).toHaveCount(0);
});
