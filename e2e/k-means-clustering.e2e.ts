import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('species: three groups match the species for 96 penguins in 100, and k changes it', async ({
	page
}) => {
	await open(page, './k-means-clustering/#species', '96 in 100 named right');
	await expect(stage(page)).not.toContainText('Chinstrap');
	await page.locator('input[type=checkbox][data-control=species]').check();
	await expect(stage(page)).toContainText('Chinstrap');
	await page.locator('input[type=range][data-control=k]').fill('2');
	await expect(stage(page)).toContainText('k = 2');
	await expect(stage(page)).toContainText('80 in 100 named right');
	// The shapes belong to this step: back on the first one the species are hidden again.
	await page.goto('./k-means-clustering/#penguins');
	await expect(stage(page)).toContainText('species hidden');
	await expect(stage(page)).not.toContainText('Chinstrap');
});

test('starts: four centres end differently from different starts, three always agree', async ({
	page
}) => {
	await open(page, './k-means-clustering/#starts', 'different endings from 6 starts');
	await expect(stage(page)).toContainText('best');
	await page.locator('input[type=range][data-control=kstarts]').fill('3');
	await expect(stage(page)).toContainText('all 6 starts end the same');
});

test('rings: two centres cut both rings in two', async ({ page }) => {
	await open(page, './k-means-clustering/#rings', 'both rings cut in two');
});

test('your own points: a click adds a point, and clearing removes them all', async ({ page }) => {
	await open(page, './k-means-clustering/#yours', '52 points');
	const plot = page.getByRole('button', { name: /Add a point/ });
	await plot.click({ position: { x: 40, y: 40 } });
	await expect(stage(page)).toContainText('53 points');
	await plot.press('Enter');
	await expect(stage(page)).toContainText('54 points');
	await page.getByRole('button', { name: 'Clear the points' }).click();
	await expect(stage(page)).toContainText('0 points');
	await expect(stage(page)).toContainText('Too few distinct points for this many centres');
});
