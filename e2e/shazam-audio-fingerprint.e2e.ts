import { expect, test, type Page } from '@playwright/test';

// The recording's noise and cough are seeded, so every verdict here is deterministic.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const pick = (page: Page, control: string, value: string) =>
	page.locator(`button[data-control="${control}"][data-value="${value}"]`).click();
const slide = (page: Page, control: string, value: string) =>
	page.locator(`input[type=range][data-control="${control}"]`).fill(value);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('the recording is named by its spike, at the time it started', async ({ page }) => {
	await page.goto('./shazam-audio-fingerprint/#histogram');
	await expect(stage(page)).toContainText('Match');
	await expect(stage(page)).toContainText('The Long Field');
	await expect(stage(page)).toContainText('the recording started 4.29 s into it');
	// another tune, recorded from another place
	await pick(page, 'recTune', '9');
	await slide(page, 'start', '1.5');
	await expect(stage(page)).toContainText('the recording started 1.50 s into it');
	await expect(stage(page).locator('text', { hasText: 'Second Spring' }).first()).toBeVisible();
	await expect(stage(page)).toContainText('Match');
});

test('turning up the noise makes the spike disappear; a second is too short', async ({ page }) => {
	await page.goto('./shazam-audio-fingerprint/#noise');
	await expect(stage(page)).toContainText('Match');
	await slide(page, 'noise', '-15');
	await expect(stage(page)).toContainText('No clear match');
	await slide(page, 'noise', '10');
	await expect(stage(page)).toContainText('Match');
	await slide(page, 'seconds', '1');
	await expect(stage(page)).toContainText('No clear match');
});

test('a transposed copy, a cover and an unknown tune are not matched', async ({ page }) => {
	await page.goto('./shazam-audio-fingerprint/#limits');
	await expect(stage(page)).toContainText('the recording started');
	for (const v of ['higher1', 'higher2', 'cover', 'unknown']) {
		await pick(page, 'version', v);
		await expect(stage(page)).toContainText('No clear match');
	}
	await pick(page, 'version', 'original');
	await expect(stage(page)).toContainText('the recording started 4.29 s into it');
});

test('a fingerprint is two pitches and a gap packed into 22 bits', async ({ page }) => {
	await page.goto('./shazam-audio-fingerprint/#bits');
	await expect(stage(page)).toContainText('One fingerprint');
	await expect(stage(page)).toContainText('4,194,304 possible bit patterns');
	await expect(stage(page)).toContainText('first pitch:');
	await expect(stage(page)).toContainText('(6 bits)');
});

test('the peaks are a tiny fraction of the spectrogram, and the play button stays silent here', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('./shazam-audio-fingerprint/#peaks');
	await expect(stage(page)).toContainText(/\d+ peaks kept of 95,744 points \(0\.\d\d%\)/);
	await page.locator('button[data-control="play"]').click();
	await pick(page, 'tune', '0');
	await expect(stage(page)).toContainText('Harbour Lights');
	expect(errors).toEqual([]);
});
