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
	await speed.fill('0.5');
	await expect(stage(page)).toContainText('non-oscillating instability: it falls');
	await speed.fill('2');
	await expect(stage(page)).toContainText('weave grows: it falls');
	await expect(stage(page)).toContainText('fall predicted');
	await speed.fill('8');
	await expect(stage(page)).toContainText('capsize: it slowly leans over');
});

test('band: the benchmark bicycle is self-stable from 4.29 to 6.02 m/s', async ({ page }) => {
	await open(page, './bicycle-stability/#band', 'self-stable from 4.29 to 6.02 m/s');
});

test('gyro: without the wheels’ spin the band is gone', async ({ page }) => {
	await open(page, './bicycle-stability/#gyro', 'self-stable from 4.29 to 6.02 m/s');
	await page.locator('input[type=checkbox][data-control=gyro]').uncheck();
	await expect(stage(page)).toContainText('no self-stable band found up to 15 m/s');
});

test('geometry: negative trail removes the band', async ({ page }) => {
	await open(page, './bicycle-stability/#geometry', 'trail 80 mm');
	await page.locator('input[type=range][data-control=trail]').fill('-0.02');
	await expect(stage(page)).toContainText('no self-stable band found');
});

test('skate: the two-mass-skate bicycle is self-stable from 2.84 m/s on', async ({ page }) => {
	await open(
		page,
		'./bicycle-stability/#skate',
		'self-stable from 2.84 m/s on (checked to 30 m/s)'
	);
	await page.locator('[data-control=bike][data-value=benchmark]').click();
	await expect(stage(page)).toContainText('self-stable from 4.29 to 6.02 m/s');
});

test('countersteer: a twist to the left ends in a right turn', async ({ page }) => {
	await open(page, './bicycle-stability/#countersteer', 'turning right');
	await expect(stage(page)).toContainText('handlebars twisted left');
	// A steady turn is not a fall, even at the slider's end.
	await page.locator('input[type=range][data-control=torque]').fill('-0.3');
	await expect(stage(page)).toContainText('turning right');
	await expect(stage(page)).not.toContainText('fall predicted');
});
