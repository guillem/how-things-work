import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** Reduced motion: each step shows its finished picture, at the moment it is about. */
async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('the tank is about two thirds full at bedtime and you feel a bit tired at 21:00', async ({
	page
}) => {
	await open(page, './why-you-get-sleepy/#sleepy', 'At bedtime the tank is 62 % full');
	await expect(stage(page)).toContainText('Day 2 · 21:00');
	await expect(stage(page)).toContainText('A bit tired');
});

test('left alone, you sleep from about 23:00 to 7:30', async ({ page }) => {
	await open(page, './why-you-get-sleepy/#clock', 'Left alone: asleep at 23:05, awake at 7:30');
	await expect(stage(page)).toContainText('sleep line');
	await expect(stage(page)).toContainText('waking line');
});

test('bedtime: to bed at 20:00 you lie awake; at 1:00 you sleep at once', async ({ page }) => {
	await open(page, './why-you-get-sleepy/#bedtime', 'In bed at 22:30, asleep at 22:50');
	const bed = page.locator('input[type=range][data-control=bedtime]');
	await bed.fill('20');
	await expect(stage(page)).toContainText('In bed at 20:00, asleep at 22:50: 2 h 50 lying awake');
	await expect(stage(page)).toContainText('in bed, still awake');
	await bed.fill('25');
	await expect(stage(page)).toContainText('In bed at 1:00: asleep at once');
	await expect(stage(page)).toContainText('Tank when the alarm rings: 17 % (usually 9 %)');
});

test('alarm: at 5:00 the tank is fuller in the morning; at 10:00 you wake by yourself', async ({
	page
}) => {
	await open(page, './why-you-get-sleepy/#alarm', 'The alarm rings at 7:00');
	const alarm = page.locator('input[type=range][data-control=wake]');
	await alarm.fill('5');
	await expect(stage(page)).toContainText('Tank when you get up: 14 % (usually 9 %)');
	await alarm.fill('10');
	await expect(stage(page)).toContainText('You wake by yourself at 7:30, before the alarm');
});

test('all-nighter: the tank overflows and the afternoon brings a second wind', async ({ page }) => {
	await open(page, './why-you-get-sleepy/#all-nighter', 'Turn on the all-nighter');
	await page.locator('[data-control=skip]').check();
	await expect(stage(page)).toContainText('Day 3 at 22:30: tank 90 % full (usually 61 %)');
	await expect(stage(page)).toContainText(
		'Can hardly keep your eyes open at 8:00, very sleepy at 16:00'
	);
});

test('nap: a 90-minute nap puts tonight’s sleep over two hours later', async ({ page }) => {
	await open(page, './why-you-get-sleepy/#nap', 'No nap: asleep at 22:50');
	const nap = page.locator('input[type=range][data-control=nap]');
	await nap.fill('20');
	await expect(stage(page)).toContainText('After the nap: asleep at 23:30 that night');
	await nap.fill('90');
	await expect(stage(page)).toContainText('After the nap: asleep at 1:10 that night');
	await expect(stage(page)).toContainText('2 h 20 later than without it');
});

test('night: five rounds, the deep sleep in the first ones', async ({ page }) => {
	await open(page, './why-you-get-sleepy/#night', '5 rounds in 8 h 10 of sleep');
	await expect(stage(page)).toContainText('deep sleep: 44 min in the first round, 1 in the last');
	await expect(stage(page)).toContainText('dreaming');
});
