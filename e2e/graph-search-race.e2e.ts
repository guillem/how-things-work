import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const readout = (page: Page, name: string) => page.locator(`.stage [data-readout=${name}]`);

// Reduced motion: both scenes show their finished frame at once.
test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('the race shows a route cost for each of the three methods', async ({ page }) => {
	await page.goto('/graph-search/#compare');
	await expect(stage(page)).toContainText('Breadth-first');
	await expect(readout(page, 'route')).toHaveCount(3);
	await expect(readout(page, 'cost')).toHaveCount(3);
	for (const cost of await readout(page, 'cost').allTextContents())
		expect(cost).toMatch(/^cost \d+$/);
});

test('switching the road method changes the towns looked at', async ({ page }) => {
	await page.goto('/graph-search/#roads');
	await expect(readout(page, 'looked')).toHaveText('Dijkstra looked at 9 towns');
	await expect(readout(page, 'both')).toHaveText('towns looked at: 9 (Dijkstra) / 7 (A*)');
	await page.locator('button[data-control=roadAlgo][data-value=astar]').click();
	await expect(readout(page, 'looked')).toHaveText('A* looked at 7 towns');
	await expect(stage(page)).toContainText('= 473 km');
});
