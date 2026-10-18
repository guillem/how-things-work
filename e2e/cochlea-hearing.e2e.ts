import { expect, test, type Page } from '@playwright/test';

// The cochlea explainer: what a visitor sees when they move a tone along the membrane, switch
// the outer hair cells off, raise the level, kill the outer hair cells near the 5 kHz place and
// listen through an implant. Reduced motion freezes the wave; the numbers come from the model,
// which the model tests check against measurements.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = text.match(
		new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(-?[\\d.]+)`)
	);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	"a tone's wave peaks at its place on Greenwood's map, high tones near the base",
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./cochlea-hearing/#wave');
		await expect(stage(page)).toContainText('a tone of 1.00 kHz at 20 dB SPL');
		expect(
			Math.abs((await read(page, 'peak at')) - (await read(page, "Greenwood's map:")))
		).toBeLessThan(0.5);
		await range(page, 'pitch').fill('7');
		await expect(stage(page)).toContainText('a tone of 16.0 kHz');
		const peak = await read(page, 'peak at');
		expect(peak).toBeLessThan(3);
		expect(Math.abs(peak - (await read(page, "Greenwood's map:")))).toBeLessThan(0.5);
	}
);

test('the map step marks the place of the chosen frequency', async ({ page }) => {
	await page.goto('./cochlea-hearing/#map');
	await expect(stage(page)).toContainText('1.00 kHz · 21.0 mm');
	await range(page, 'pitch').fill('0');
	await expect(stage(page)).toContainText('125 Hz · 31.4 mm');
});

test('a vowel shows its formants; two close tones make one bump', async ({ page }) => {
	await page.goto('./cochlea-hearing/#mix');
	await page.locator('[data-control=sound][data-value=ee]').click();
	await expect(stage(page)).toContainText('F1 270 Hz');
	await expect(stage(page)).toContainText('F2 2.29 kHz');
	await page.locator('[data-control=sound][data-value=close]').click();
	await expect(stage(page)).toContainText('two close tones');
	const peak = await read(page, 'largest motion at');
	expect(peak).toBeGreaterThan(20);
	expect(peak).toBeLessThan(21.5);
});

test('without the outer hair cells the peak is lower and nearer the base', async ({ page }) => {
	await page.goto('./cochlea-hearing/#amplifier');
	await expect(stage(page)).toContainText('amplifier on');
	const on = await read(page, 'peak');
	const onAt = await read(page, `peak ${on.toFixed(0)} dB at`);
	await page.locator('input[data-control=ohc]').setChecked(false, { force: true });
	await expect(stage(page)).toContainText('amplifier off');
	const off = await read(page, 'peak');
	const offAt = await read(page, `peak ${off.toFixed(0)} dB at`);
	expect(on - off).toBeGreaterThan(20);
	expect(onAt - offAt).toBeGreaterThan(2);
});

test('the live peak grows compressively and meets the passive one at 110 dB', async ({ page }) => {
	await page.goto('./cochlea-hearing/#level');
	await expect(stage(page)).toContainText('at 40 dB SPL');
	const slope = await read(page, 'live growth from 40 to 80 dB SPL:');
	expect(slope).toBeGreaterThan(0.2);
	expect(slope).toBeLessThan(0.6);
	await range(page, 'level').fill('110');
	await expect(stage(page)).toContainText('at 110 dB SPL');
	const live = await read(page, 'peak');
	await page.locator('input[data-control=ohc]').setChecked(false, { force: true });
	await expect(stage(page)).toContainText('amplifier off');
	expect(Math.abs((await read(page, 'peak')) - live)).toBeLessThanOrEqual(1);
});

test('losing the outer hair cells near 5 kHz notches the audiogram at 4 kHz', async ({ page }) => {
	await page.goto('./cochlea-hearing/#notch');
	const notch = await read(page, '4 kHz:');
	expect(notch).toBeGreaterThan(15);
	await range(page, 'loss').fill('0');
	await expect(stage(page)).toContainText('around the 5 kHz place: 0 %');
	expect(Math.abs(await read(page, '4 kHz:'))).toBeLessThan(1);
});

test('the damaged ear misses soft tones but matches the healthy one when loud', async ({
	page
}) => {
	await page.goto('./cochlea-hearing/#loud');
	await range(page, 'level').fill('15');
	await expect(stage(page)).toContainText('at 15 dB SPL');
	expect(await read(page, 'healthy')).toBeGreaterThan(0);
	expect(await read(page, 'damaged')).toBeLessThan(0);
	await range(page, 'level').fill('100');
	await expect(stage(page)).toContainText('at 100 dB SPL');
	expect(
		Math.abs((await read(page, 'healthy')) - (await read(page, 'damaged')))
	).toBeLessThanOrEqual(1);
});

test('the implant maps bands to electrodes; one channel carries everything', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('./cochlea-hearing/#implant');
	await expect(stage(page)).toContainText('through an implant with 8 channels');
	await expect(stage(page)).toContainText('carries 200 Hz–359 Hz');
	await range(page, 'channels').fill('1');
	await expect(stage(page)).toContainText('one electrode');
	await expect(stage(page)).toContainText('from 200 Hz to 7.00 kHz');
	await page.locator('[data-control=vowel][data-value=oo]').click();
	await expect(stage(page)).toContainText('formants: 300 Hz, 870 Hz, 2.24 kHz');
	// the sound buttons work (silent under automation)
	await page.locator('[data-control=playVowel]').click();
	await page.locator('[data-control=playImplant]').click();
	expect(errors).toEqual([]);
});
