import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('lamp: 1 m from the toy and 2 m to the wall, the shadow is three times as tall', async ({
	page
}) => {
	await open(page, './shadows-and-pinholes/#lamp', 'the shadow is 3.0 times as tall as the toy');
	await page.locator('input[type=range][data-control=lamp]').fill('0.2');
	await expect(stage(page)).toContainText('the shadow is 2.0 times as tall as the toy');
});

test('the lamp can be dragged with the keyboard, and the shadow follows', async ({ page }) => {
	await open(page, './shadows-and-pinholes/#lamp', '3.0 times');
	const lamp = page.getByRole('slider', { name: 'Lamp position' });
	await lamp.focus();
	for (let i = 0; i < 4; i++) await lamp.press('ArrowRight');
	await expect(page.locator('input[type=range][data-control=lamp]')).toHaveValue('1.4');
	await expect(stage(page)).toContainText('the shadow is 3.5 times as tall as the toy');
});

test('soft: a wider lamp, a wider soft edge', async ({ page }) => {
	await open(page, './shadows-and-pinholes/#soft', 'soft edge about 50 cm wide');
	await page.locator('input[type=range][data-control=size]').fill('0');
	await expect(stage(page)).toContainText('tiny bulb: a sharp edge');
});

test('two: a second lamp, a second shadow', async ({ page }) => {
	await open(page, './shadows-and-pinholes/#two', 'two lamps: two shadows');
	await page.locator('input[type=checkbox][data-control=second]').uncheck();
	await expect(stage(page)).toContainText('one lamp: one shadow');
});

test('pinhole: a bigger hole, a brighter and blurrier picture', async ({ page }) => {
	await open(page, './shadows-and-pinholes/#pinhole', 'an upside-down picture, 6 cm tall');
	await page.locator('input[type=range][data-control=hole]').fill('4');
	await expect(stage(page)).toContainText('16 times as bright as a 1 mm hole');
});

test('nothrown: no lamp, no shadow', async ({ page }) => {
	await open(page, './shadows-and-pinholes/#nothrown', 'times as tall');
	await page.locator('input[type=checkbox][data-control=on]').uncheck();
	await expect(stage(page)).toContainText('Lamp off');
});
