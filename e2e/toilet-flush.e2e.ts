import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** Opens a step on its reduced-motion frame: the moment of the flush that the step is about. */
async function open(page: Page, url: string, text: string | RegExp) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('toilet: the bowl rests level with the hump; a jug of water only spills over', async ({
	page
}) => {
	await open(page, './toilet-flush/#toilet', 'still: level with the top of the bend');
	await expect(stage(page)).toContainText('down the drain: nothing');
	await page.getByRole('button', { name: 'Pour it in' }).click();
	await expect(stage(page)).toContainText('water spills over the hump');
	await expect(stage(page)).toContainText('down the drain: a trickle');
	await expect(stage(page)).toContainText('a jug of water poured in');
});

test('flush: the tank fills the bend and the bowl siphons at about 3 litres a second', async ({
	page
}) => {
	await open(page, './toilet-flush/#flush', 'the bend is full: the bowl drains itself');
	await expect(stage(page)).toContainText('down the drain: about 3 litres a second');
	await expect(stage(page)).toContainText('the bend: full of water from end to end');
});

test('siphon: gravity on the long side, the air pressing on the bowl', async ({ page }) => {
	await open(page, './toilet-flush/#siphon', 'the bend is full: the bowl drains itself');
	await expect(stage(page)).toContainText('gravity pulls');
	await expect(stage(page)).toContainText('the air presses on the bowl’s water');
});

test('bucket: poured in 2 seconds it siphons; poured in 15 it only spills over', async ({
	page
}) => {
	await open(page, './toilet-flush/#bucket', 'the bend is full: the bowl drains itself');
	await expect(stage(page)).toContainText('bucket: 6 litres in 2 seconds');
	await page.locator('input[type=range][data-control=pour]').fill('15');
	await expect(stage(page)).toContainText('bucket: 6 litres in 15 seconds');
	await expect(stage(page)).toContainText('water spills over the hump');
	await expect(stage(page)).toContainText('down the drain: a trickle');
	await expect(stage(page)).not.toContainText('drains itself');
});

test('washdown: the wide bend never fills; the rush pushes the water over the top', async ({
	page
}) => {
	await open(page, './toilet-flush/#washdown', 'bowl: siphonic: a narrow bend');
	await page.locator('input[type=checkbox][data-control=washdown]').check();
	await expect(stage(page)).toContainText('bowl: washdown: a wide bend');
	await expect(stage(page)).toContainText('water spills over the hump');
	await expect(stage(page)).toContainText(/down the drain: about 2 litres a second/);
});

test('refill: the float rises and shuts the valve; held down, the tank overflows', async ({
	page
}) => {
	await open(page, './toilet-flush/#refill', 'fill valve: open: water comes in');
	await expect(stage(page)).toContainText('the bowl fills back up');
	await page.locator('input[type=checkbox][data-control=hold]').check();
	await expect(stage(page)).toContainText('fill valve: held open: the float is down');
	await expect(stage(page)).toContainText('the tank overflows into the bowl');
});
