import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('flat: on a flat sea the ship only shrinks, even 30 km out', async ({ page }) => {
	await open(page, './earth-is-a-ball/#flat', 'ship 8 km out');
	await expect(stage(page)).toContainText('hidden behind the sea: nothing: it only looks smaller');
	await page.getByRole('slider', { name: 'The ship' }).press('End');
	await expect(stage(page)).toContainText('ship 30 km out');
	await expect(stage(page)).toContainText('nothing: it only looks smaller');
});

test('round: the hull sinks first, then the sails, then the whole ship', async ({ page }) => {
	await open(page, './earth-is-a-ball/#round', 'ship 8 km out');
	await expect(stage(page)).toContainText('the bottom 1 m of the hull');
	const distance = page.locator('input[type=range][data-control=distance]');
	await distance.fill('3');
	await expect(stage(page)).toContainText('hidden behind the sea: nothing yet');
	await distance.fill('16');
	await expect(stage(page)).toContainText('the hull and the bottom 1 m of the sails');
	await distance.fill('30');
	await expect(stage(page)).toContainText('the whole ship is behind the sea');
});

test('binoculars: the sails get bigger but the hull stays behind the sea', async ({ page }) => {
	await open(page, './earth-is-a-ball/#binoculars', 'ship 16 km out');
	await page.locator('input[type=checkbox][data-control=binoculars]').check();
	await expect(stage(page)).toContainText('Through the binoculars (7 times bigger)');
	await expect(stage(page)).toContainText('the hull and the bottom 1 m of the sails');
});

test('cliff: climbing about 30 m brings the whole ship back', async ({ page }) => {
	await open(page, './earth-is-a-ball/#cliff', 'ship 20 km out');
	await expect(stage(page)).toContainText('the hull and the bottom 9 m of the sails');
	await page.locator('input[type=range][data-control=cliff]').fill('32');
	await expect(stage(page)).toContainText('hidden behind the sea: nothing');
	await expect(stage(page)).not.toContainText('of the sails');
});

test('walk and drop: down is towards the middle, even at the bottom of the picture', async ({
	page
}) => {
	await open(page, './earth-is-a-ball/#walk', 'standing at the right side of the picture');
	await expect(stage(page)).toContainText('feet point towards the middle');
	await page.locator('input[type=range][data-control=walk]').fill('180');
	await expect(stage(page)).toContainText('standing at the bottom of the picture');
	await page.goto('./earth-is-a-ball/#drop');
	await expect(stage(page)).toContainText('the ball falls towards the middle');
	await expect(stage(page)).toContainText('2 m in 0.6 seconds');
	await expect(stage(page)).toContainText('standing at the bottom of the picture');
});
