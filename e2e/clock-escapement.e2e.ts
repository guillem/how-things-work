import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** Opens a step on its reduced-motion frame: the clock run for 2.5 seconds. */
async function open(page: Page, url: string, text: string | RegExp) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('clock: a seconds pendulum ticks in step with the stopwatch', async ({ page }) => {
	await open(page, './clock-escapement/#clock', '2 seconds');
	await expect(stage(page)).toContainText('2 ticks');
	await expect(stage(page)).toContainText('the weight:');
	await expect(stage(page)).toContainText('the pendulum:');
});

test('runaway: without the anchor the wheel races; with it, one turn a minute', async ({
	page
}) => {
	await open(page, './clock-escapement/#runaway', /escape wheel: about \d+ turns a second/);
	await expect(stage(page)).toContainText('hands: racing, an hour every 3 seconds');
	await expect(stage(page)).toContainText('0 ticks');
	await page.locator('input[type=checkbox][data-control=anchor]').check();
	await expect(stage(page)).toContainText('escape wheel: one turn a minute, step by step');
	await expect(stage(page)).toContainText('hands: telling the time');
	await expect(stage(page)).toContainText('2 ticks');
});

test('catch: the tooth is let go at the bottom of the swing, caught again in slow motion', async ({
	page
}) => {
	await open(page, './clock-escapement/#catch', 'let go: the tooth slides off, pushing the pallet');
	await page.locator('input[type=checkbox][data-control=slow]').check();
	// Ten times slower: a quarter of a second in, the pendulum hasn't reached the bottom yet.
	await expect(stage(page)).toContainText('caught: the wheel stands still');
	await expect(stage(page)).toContainText('0 seconds');
	await expect(stage(page)).toContainText('slow motion: 10 times slower');
});

test('push: without the weight nothing ticks, though the pendulum swings on', async ({ page }) => {
	await open(
		page,
		'./clock-escapement/#push',
		'each tick, a tiny push keeps the pendulum swinging'
	);
	await page.locator('input[type=checkbox][data-control=unhook]').check();
	await expect(stage(page)).toContainText('no weight: no ticks, the hands stand still');
	await expect(stage(page)).toContainText('the pendulum swings on, slowly dying away');
	await expect(stage(page)).toContainText('0 ticks');
});

test('length: a pendulum a quarter as long ticks twice as fast', async ({ page }) => {
	await open(page, './clock-escapement/#length', '60 ticks a minute');
	await expect(stage(page)).toContainText('in step with the stopwatch');
	await expect(stage(page)).toContainText('right to within seconds a day');
	await page.locator('input[type=range][data-control=length]').fill('25');
	await expect(stage(page)).toContainText('120 ticks a minute');
	await expect(stage(page)).toContainText('2.0 times as fast as the stopwatch');
	await expect(stage(page)).toContainText('5 ticks');
	await expect(stage(page)).toContainText('2 seconds');
});

test('weight: four times the weight, twice the swing, and the clock a little slower', async ({
	page
}) => {
	await open(page, './clock-escapement/#weight', 'swing: 2.5° each side');
	await page.locator('input[type=range][data-control=weight]').fill('12');
	await expect(stage(page)).toContainText('swing: 5.0° each side');
	await expect(stage(page)).toContainText('still 60 ticks a minute');
	await expect(stage(page)).toContainText('loses 31 seconds a day against 3 kg');
});
