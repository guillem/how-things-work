import { expect, test, type Page } from '@playwright/test';

// The radar-sonar explainer: what a visitor sees when targets move, when a plate is tilted, when
// the pulse is lengthened or shortened, when a chirp replaces it, when a car turns across the
// beam, when noise drowns the range-Doppler map, and when the water warms. Reduced motion shows
// each sweep complete; the noise is seeded. The model tests check the physics itself.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`).click();
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.]+)`).exec(text);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'an echo’s delay is the round trip: a target moved out to 14.5 km answers after 96.7 µs',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./radar-sonar/#echo');
		await expect(stage(page)).toContainText('A: 4.0 km');
		await expect(stage(page)).toContainText('A · 26.7 µs');
		await range(page, 'rA').press('End');
		await expect(stage(page)).toContainText('A: 14.5 km');
		await expect(stage(page)).toContainText('A · 96.7 µs');
	}
);

test('a plate square to the radar echoes brightly; tilted, its echo goes elsewhere', async ({
	page
}) => {
	await page.goto('./radar-sonar/#fade');
	const face = await read(page, 'B ·');
	await choose(page, 'shape', 'tilt');
	await expect(stage(page)).toContainText('σ ≈ 1.0 m²');
	expect(face - (await read(page, 'B ·'))).toBeGreaterThan(30);
});

test('a long plain pulse blurs two targets into one; a short one separates them', async ({
	page
}) => {
	await page.goto('./radar-sonar/#resolution');
	await expect(stage(page)).toContainText('echoes over the threshold: 2');
	await range(page, 'tau').press('End');
	await expect(stage(page)).toContainText('resolution c ÷ (2B) ≈ 3.0 km');
	await expect(stage(page)).toContainText('echoes over the threshold: 1');
	await range(page, 'tau').press('Home');
	await expect(stage(page)).toContainText('resolution c ÷ (2B) ≈ 30 m');
	await expect(stage(page)).toContainText('echoes over the threshold: 2');
});

test('small targets: a short pulse loses them in the noise, a long one blurs them', async ({
	page
}) => {
	await page.goto('./radar-sonar/#energy');
	await range(page, 'tau').press('Home');
	await expect(stage(page)).toContainText('echoes over the threshold: none');
	await range(page, 'tau').press('End');
	await expect(stage(page)).toContainText('echoes over the threshold: 1');
});

test('a chirp and its matched filter give both: two sharp echoes 22 dB up', async ({ page }) => {
	await page.goto('./radar-sonar/#chirp');
	await expect(stage(page)).toContainText('resolution c ÷ (2B) ≈ 30 m');
	await expect(stage(page)).toContainText('22 dB above the noise');
	await expect(stage(page)).toContainText('echoes over the threshold: 2');
	await choose(page, 'wave', 'plain');
	await expect(stage(page)).toContainText('echoes over the threshold: 1');
});

test('the Doppler shift follows the radial speed only', async ({ page }) => {
	await page.goto('./radar-sonar/#doppler');
	await expect(stage(page)).toContainText('= 2.00 kHz');
	await range(page, 'heading').fill('90');
	await expect(stage(page)).toContainText('= 0.00 kHz');
	await expect(stage(page)).toContainText('radial: v cos 90° = 0.0 m/s');
});

test('the range-Doppler map finds all three targets until noise drowns them', async ({ page }) => {
	await page.goto('./radar-sonar/#noise');
	await expect(stage(page)).toContainText('found 3 of 3');
	await expect(stage(page)).toContainText('boat: 7.1 km');
	await range(page, 'noise').fill('20');
	await expect(stage(page)).toContainText('found 2 of 3');
	await range(page, 'noise').press('End');
	await expect(stage(page)).toContainText('found 0 of 3');
});

test('under water the echo takes seconds, and high pitches are absorbed', async ({ page }) => {
	await page.goto('./radar-sonar/#sonar');
	await expect(stage(page)).toContainText('echo back after 13.4 s');
	await range(page, 'temp').press('End');
	await expect(stage(page)).toContainText('echo back after 12.9 s');
	const low = await read(page, 'over the 20 km round trip:');
	expect(low).toBeLessThan(10);
	await range(page, 'freq').press('End');
	await expect(stage(page)).toContainText('681 dB lost to absorption');
});
