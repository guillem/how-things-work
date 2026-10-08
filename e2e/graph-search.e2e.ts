import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const scrubber = (page: Page) => page.getByRole('slider', { name: 'Replay position' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(scrubber(page)).toBeAttached();
	await page.locator('input[type=range][data-control=pace]').fill('120');
}

test('breadth-first search wades through the mud: 15 steps, cost 39', async ({ page }) => {
	await open(page, '/graph-search/#mud');
	await expect(stage(page)).toContainText('Fewest steps: 15 steps · cost 39', { timeout: 15_000 });
	// …next to the cheapest route round the marsh.
	await expect(stage(page)).toContainText('Cheapest: 21 steps · cost 21');
});

test('Dijkstra’s algorithm goes round the marsh: cost 21', async ({ page }) => {
	await open(page, '/graph-search/#dijkstra');
	await expect(stage(page)).toContainText('Route found: 21 steps · cost 21', { timeout: 15_000 });
});

test('the replay scrubber steps one square at a time', async ({ page }) => {
	await open(page, '/graph-search/#bfs');
	await scrubber(page).focus();
	await page.keyboard.press('Home');
	await expect(page.locator('input[type=checkbox][data-control=play]')).not.toBeChecked();
	await expect(scrubber(page)).toHaveAttribute('aria-valuenow', '0');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expect(scrubber(page)).toHaveAttribute('aria-valuenow', '2');
	await expect(stage(page)).toContainText('2 squares visited');
	// Still on the same step: the keys belong to the scrubber.
	await expect(page).toHaveURL(/#bfs$/);
});

test('painting a wall with the keyboard changes the route', async ({ page }) => {
	await open(page, '/graph-search/#mud');
	await expect(stage(page)).toContainText('cost 39', { timeout: 15_000 });
	// The map cursor starts on the square right of S; Space paints a wall there.
	const editor = page.getByRole('button', { name: /^Map editor/ });
	await editor.focus();
	await expect(editor).toHaveAttribute('aria-label', /column 5, row 6: ground/);
	await page.keyboard.press('Space');
	await expect(editor).toHaveAttribute('aria-label', /column 5, row 6: wall/);
	await expect(stage(page)).toContainText('Fewest steps: 17 steps · cost 41', { timeout: 15_000 });
	await expect(page).toHaveURL(/#mud$/);
	// "Start again" restores the marsh.
	await page.locator('button[data-control=resetMap]').click();
	await expect(stage(page)).toContainText('Fewest steps: 15 steps · cost 39', { timeout: 15_000 });
});

test('S moves with the arrow keys', async ({ page }) => {
	await page.goto('/graph-search/#map');
	const start = page.getByRole('button', { name: /^Start \(S\)/ });
	await expect(start).toHaveAttribute('aria-label', /column 4, row 6/);
	await start.focus();
	await page.keyboard.press('ArrowUp');
	await expect(start).toHaveAttribute('aria-label', /column 4, row 5/);
	await expect(page).toHaveURL(/#map$/);
});

test.describe('reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });
	test('shows the finished search, and the scrubber still steps', async ({ page }) => {
		await page.goto('/graph-search/#dijkstra');
		await expect(stage(page)).toContainText('Route found: 21 steps · cost 21');
		await scrubber(page).focus();
		await page.keyboard.press('Home');
		await expect(scrubber(page)).toHaveAttribute('aria-valuenow', '0');
		await page.keyboard.press('ArrowRight');
		await expect(scrubber(page)).toHaveAttribute('aria-valuenow', '1');
	});
});
