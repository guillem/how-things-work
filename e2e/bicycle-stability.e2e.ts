import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('speeds: it recovers at 5 m/s, falls at 2 m/s and slowly capsizes at 8 m/s', async ({
	page
}) => {
	await open(page, './bicycle-stability/#speeds', 'self-stable: it recovers');
	const speed = page.locator('input[type=range][data-control=speed]');
	await speed.fill('2');
	await expect(stage(page)).toContainText('weave grows: it falls');
	await expect(stage(page)).toContainText('fallen over');
	await speed.fill('8');
	await expect(stage(page)).toContainText('capsize: it slowly leans over');
});

test('band: the benchmark bicycle is self-stable from 4.29 to 6.02 m/s', async ({ page }) => {
	await open(page, './bicycle-stability/#band', 'self-stable from 4.29 to 6.02 m/s');
});

test('gyro: without the wheels’ spin the band is gone', async ({ page }) => {
	await open(page, './bicycle-stability/#gyro', 'self-stable from 4.29 to 6.02 m/s');
	await page.locator('input[type=checkbox][data-control=gyro]').uncheck();
	await expect(stage(page)).toContainText('no self-stable speed up to 15 m/s');
});

test('geometry: negative trail removes the band', async ({ page }) => {
	await open(page, './bicycle-stability/#geometry', 'trail 80 mm');
	await page.locator('input[type=range][data-control=trail]').fill('-0.02');
	await expect(stage(page)).toContainText('no self-stable speed');
});

test('skate: the two-mass-skate bicycle is self-stable above 2.84 m/s', async ({ page }) => {
	await open(page, './bicycle-stability/#skate', 'self-stable above 2.84 m/s');
	await page.locator('[data-control=bike][data-value=benchmark]').click();
	await expect(stage(page)).toContainText('self-stable from 4.29 to 6.02 m/s');
});

test('countersteer: a twist to the left ends in a right turn', async ({ page }) => {
	await open(page, './bicycle-stability/#countersteer', 'turning right');
	await expect(stage(page)).toContainText('handlebars twisted left');
});
