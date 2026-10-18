// Browser tests of the PCR page: one cycle stepped by hand, the exact piece appearing in cycle 3,
// a billion copies after 30 cycles and the plateau, the threshold cycle against the starting
// copies (one copy ten cycles after a thousand), the efficiency's slope, and primers that copy
// only their own target. Reduced motion shows every curve whole, so its frames are exact.
import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
/** Switches a toggle off by keyboard (its thumb covers the input). */
async function switchOff(page: Page, id: string) {
	const input = page.locator(`input[data-control="${id}"]`);
	await input.focus();
	await page.keyboard.press('Space');
	await expect(input).not.toBeChecked();
}
const pick = (page: Page, control: string, value: string) =>
	page.locator(`button[data-control="${control}"][data-value="${value}"]`).click();

test('one cycle, stage by stage: two strands become four', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./pcr-copying-dna/#cycle');
	await expect(stage(page)).toContainText('Warm · 72 °C');
	await expect(stage(page)).toContainText('4 strands: 2 double strands');
	await switchOff(page, 'auto');
	await range(page, 'stage').focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('Start · 72 °C');
	await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('Heat · 95 °C');
	await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('Cool · 55 °C');
});

test('the cycle goes round by itself', async ({ page }) => {
	await page.clock.install();
	await page.goto('./pcr-copying-dna/#cycle');
	await playUntil(page, stage(page), 'Heat · 95 °C', 10_000);
	await playUntil(page, stage(page), 'Cool · 55 °C', 10_000);
});

test('the piece exactly between the primers first appears in cycle 3', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./pcr-copying-dna/#strands');
	const exact = stage(page).getByText('exact', { exact: true });
	await range(page, 'cycles_s').fill('2');
	await expect(stage(page)).toContainText('After cycle 2: 4 double strands');
	await expect(exact).toHaveCount(0);
	await range(page, 'cycles_s').fill('3');
	await expect(stage(page)).toContainText('After cycle 3: 8 double strands');
	await expect(exact).toHaveCount(2);
	await range(page, 'cycles_s').fill('4');
	await expect(exact).toHaveCount(8);
});

test(
	'thirty cycles make a billion copies; then the primers run out',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('./pcr-copying-dna/#doubling');
		await expect(stage(page)).toContainText('cycle 30 · 1.07 billion copies');
		await switchOff(page, 'play_d');
		await range(page, 'cycle_d').fill('10');
		await expect(stage(page)).toContainText('cycle 10 · 1,024 copies');
		await range(page, 'cycle_d').focus();
		await page.keyboard.press('End');
		await expect(stage(page)).toContainText('cycle 45 · 5.97 million million copies');
		await expect(stage(page)).toContainText(/primers left\s*1%/);
	}
);

test('the doubling plays cycle by cycle', async ({ page }) => {
	await page.clock.install();
	await page.goto('./pcr-copying-dna/#doubling');
	await playUntil(page, stage(page), 'cycle 20 · 1.05 million copies', 15_000);
	await expect(range(page, 'cycle_d')).toBeDisabled();
});

test('different starts end at the same plateau', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./pcr-copying-dna/#plateau');
	await expect(stage(page)).toContainText('all three end at the same height');
});

test('one copy crosses the detection line ten cycles after a thousand', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./pcr-copying-dna/#threshold');
	await expect(stage(page)).toContainText('crossed the line at cycle 23.3 (Ct)');
	await expect(stage(page)).toContainText('10.0 cycles');
	await range(page, 'start_t').fill('0');
	await expect(stage(page)).toContainText('crossed the line at cycle 33.2 (Ct)');
	await range(page, 'start_t').fill('6');
	await expect(stage(page)).toContainText('crossed the line at cycle 13.3 (Ct)');
});

test('copying fewer strands each cycle widens the steps between dilutions', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./pcr-copying-dna/#standard');
	// exact doubling: log₂ 10 ≈ 3.32 cycles per tenfold
	await expect(stage(page)).toContainText('Ct 3.32 cycles sooner');
	// 90 %: log 10 / log 1.9 ≈ 3.59
	await pick(page, 'eff_s', '0.9');
	await expect(stage(page)).toContainText('Ct 3.59 cycles sooner');
});

test('the primers copy only the DNA they match', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./pcr-copying-dna/#primers');
	await expect(stage(page)).toContainText('N1 primers: the virus’s piece is copied');
	await expect(stage(page)).toContainText('72 letters copied');
	await pick(page, 'primers', 'rp');
	await expect(stage(page)).toContainText('RNase P primers: the human piece is copied');
	await expect(stage(page)).toContainText('65 letters copied');
	// no virus in the swab: the N1 tube stays dark, the human control still works
	await switchOff(page, 'virus');
	await expect(stage(page)).toContainText('the human piece is copied');
	await pick(page, 'primers', 'n1');
	await expect(stage(page)).toContainText('N1 primers: nothing to copy: the tube stays dark');
});
