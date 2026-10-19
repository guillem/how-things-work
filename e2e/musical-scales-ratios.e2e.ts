import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const pick = (page: Page, control: string, value: string) =>
	page.locator(`button[data-control="${control}"][data-value="${value}"]`).click();
const slide = (page: Page, control: string, value: string) =>
	page.locator(`input[type=range][data-control="${control}"]`).fill(value);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('pressing keys on the stage picks the pair; a fifth nearly repeats every two cycles', async ({
	page
}) => {
	await page.goto('./musical-scales-ratios/#line-up');
	await expect(stage(page)).toContainText('octave');
	await expect(stage(page)).toContainText('1 cycle of C4');
	// a new key replaces the one pressed longer ago: C4 first, then C5
	await page.getByRole('button', { name: 'G4 key' }).click();
	await expect(stage(page)).toContainText('perfect fourth');
	await page.getByRole('button', { name: 'C4 key' }).click();
	await expect(stage(page)).toContainText('perfect fifth');
	await expect(page.locator('input[data-control="keyB"]')).toHaveValue('0');
	// pressing a held key keeps it: C4 then A4 makes C4–A4, not A4–G4
	await page.getByRole('button', { name: 'C4 key' }).click();
	await page.getByRole('button', { name: 'A4 key' }).click();
	await expect(stage(page)).toContainText('major sixth');
	await page.getByRole('button', { name: 'G4 key' }).click();
	await page.getByRole('button', { name: 'C4 key' }).click();
	// on a piano it is 2 cents short of 3 : 2 and only nearly repeats
	await expect(stage(page)).toContainText('1.4983');
	await expect(stage(page)).toContainText('nearly repeats');
	await expect(stage(page)).toContainText('2 cycles of C4');
	// tuned pure, it repeats exactly
	await pick(page, 'tuning', 'pure');
	await expect(stage(page)).toContainText('3 : 2');
	await expect(stage(page)).toContainText('The sum repeats every');
	await expect(stage(page)).toContainText('and 3 of G4');
	// keyboard access: Tab to a key and press Enter
	await page.getByRole('button', { name: 'E4 key' }).press('Enter');
	await expect(stage(page)).toContainText('major third');
	await expect(stage(page)).toContainText('5 : 4');
});

test('neighbouring keys beat 15.6 times a second; the piano’s major third about 10', async ({
	page
}) => {
	await page.goto('./musical-scales-ratios/#rough');
	await slide(page, 'keyA', '0');
	await slide(page, 'keyB', '1');
	await expect(stage(page)).toContainText('minor second');
	await expect(stage(page)).toContainText('15.6 per second');
	// a major third of sine tones does not beat; with harmonics, the 5th of C and 4th of E do
	await slide(page, 'keyB', '4');
	await expect(stage(page)).toContainText('none slower than 40 a second');
	await pick(page, 'timbre', 'rich');
	await expect(stage(page)).toContainText('10.4 per second');
	await expect(stage(page)).toContainText('harmonic 5 of C4 against 4 of E4');
	await pick(page, 'tuning', 'pure');
	await expect(stage(page)).toContainText('none slower than 40 a second');
});

test('the roughness curve dips at simple ratios only when the notes have harmonics', async ({
	page
}) => {
	await page.goto('./musical-scales-ratios/#curve');
	await expect(stage(page)).toContainText('702 cents above C4');
	for (const r of ['6:5', '5:4', '4:3', '3:2', '5:3', '2:1'])
		await expect(stage(page)).toContainText(r);
	await pick(page, 'curveTimbre', 'sine');
	await expect(stage(page)).not.toContainText('3:2');
	await expect(stage(page)).toContainText('two sine tones');
	// the marker is a slider too
	await page.getByRole('slider', { name: 'Upper note, in cents above C4' }).press('End');
	await expect(stage(page)).toContainText('1250 cents above C4');
	await expect(page.locator('input[data-control="interval"]')).toHaveValue('1250');
});

test('stacking twelve pure fifths overshoots by the Pythagorean comma', async ({ page }) => {
	await page.goto('./musical-scales-ratios/#fifths');
	await expect(stage(page)).toContainText('+23.5 cents');
	await expect(stage(page)).toContainText('the Pythagorean comma');
	await slide(page, 'stack', '7');
	await expect(stage(page)).toContainText('C♯');
	await expect(stage(page)).toContainText('+13.7 cents');
});

test('the divider: how far each ladder misses the pure fifth and third', async ({ page }) => {
	await page.goto('./musical-scales-ratios/#divide');
	await expect(stage(page)).toContainText('−2.0 cents');
	await expect(stage(page)).toContainText('+13.7 cents');
	await slide(page, 'divisions', '31');
	await expect(stage(page)).toContainText('−5.2 cents');
	await expect(stage(page)).toContainText('+0.8 cents');
	await slide(page, 'divisions', '53');
	await expect(stage(page)).toContainText('−0.1 cents');
	await expect(stage(page)).toContainText('−1.4 cents');
	await page.goto('./musical-scales-ratios/#twelve');
	await expect(stage(page)).toContainText('12: the first within 2 cents');
});

test('the equal-tempered chord shimmers, the pure one does not', async ({ page }) => {
	await page.goto('./musical-scales-ratios/#chord');
	await expect(stage(page)).toContainText('10.4 beats a second');
	await expect(stage(page)).toContainText('17.8 a second');
	await page.locator('button[data-control="playPure"]').click();
	await expect(page.locator('button[data-control="tuning"][data-value="pure"]')).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(stage(page)).toContainText('no beats');
	await page.locator('button[data-control="playEqual"]').click();
	await expect(stage(page)).toContainText('10.4 beats a second');
});
