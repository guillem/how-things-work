import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test.describe('settled pictures', () => {
	// Reduced motion draws the chain's steady state for the current settings.
	test.use({ reducedMotion: 'reduce' });

	test('without oxygen every carrier fills up and the chain stops', async ({ page }) => {
		await open(page, './respiration-atp/#oxygen');
		await expect(stage(page)).toContainText('100% of normal');
		await page.locator('input[data-control=oxygen]').setChecked(false, { force: true });
		await expect(stage(page)).toContainText('every carrier is loaded, the chain has stopped');
		await expect(stage(page)).not.toContainText(/[1-9]\d*% of normal/);
		// NAD pool, ubiquinone and cytochrome c all fully reduced.
		await expect(stage(page).locator('text', { hasText: /^100%$/ })).toHaveCount(3);
	});

	test('blocking ATP synthase slows the chain; an uncoupler speeds it up', async ({ page }) => {
		await open(page, './respiration-atp/#gradient');
		await page.locator('input[data-control=synthase]').setChecked(false, { force: true });
		await expect(stage(page)).toContainText('protons pile up and the chain slows');
		await expect(stage(page)).toContainText(/oxygen used\s*[0-9]% of normal/);
		await page.locator('input[data-control=synthase]').setChecked(true, { force: true });
		await page.locator('input[data-control=uncoupler]').setChecked(true, { force: true });
		await expect(stage(page)).toContainText(/oxygen used\s*(1[5-9]\d|2\d\d)% of normal/);
		await expect(stage(page)).toContainText(/ATP made\s*0% of normal/);
	});

	test('one glucose yields 30–32 ATP; old textbooks said 36–38', async ({ page }) => {
		await open(page, './respiration-atp/#yield');
		await expect(stage(page)).toContainText('32 ATP');
		await page.locator('[data-control=shuttle][data-value=glycerol]').click();
		await expect(stage(page)).toContainText('30 ATP');
		await page.locator('[data-control=count][data-value=classic]').click();
		await expect(stage(page)).toContainText('36 ATP');
	});

	test('a bigger rotor ring needs more protons per ATP', async ({ page }) => {
		await open(page, './respiration-atp/#rotor');
		await expect(stage(page)).toContainText('8 subunits');
		await expect(stage(page)).toContainText('2.7 (≈ 3.7 with transport)');
		await page.locator('[data-control=ring][data-value=spinach]').click();
		await expect(stage(page)).toContainText('14 subunits');
		await expect(stage(page)).toContainText('4.7 (≈ 5.7 with transport)');
	});

	test('FADH₂ skips complex I and drives 6 protons instead of 10', async ({ page }) => {
		await open(page, './respiration-atp/#staircase');
		await expect(stage(page)).toContainText('stored in 10 protons');
		await page.locator('[data-control=source][data-value=fadh2]').click();
		await expect(stage(page)).toContainText('stored in 6 protons');
		await expect(stage(page)).toContainText('complex II');
	});

	test('without oxygen the whole cell gets only 2 ATP per glucose', async ({ page }) => {
		await open(page, './respiration-atp/#summary');
		await expect(stage(page)).toContainText('30–32');
		await page.locator('input[data-control=oxygen-cell]').setChecked(false, { force: true });
		await expect(stage(page)).toContainText('glycolysis only');
	});
});

test('taking the oxygen away backs the chain up as it runs', async ({ page }) => {
	await page.clock.install();
	await open(page, './respiration-atp/#oxygen');
	// Stop the clock so the animation only moves when the test plays it.
	await page.clock.pauseAt(Date.now() + 2000);
	await page.locator('input[data-control=oxygen]').setChecked(false, { force: true });
	// At first the electrons are still flowing: the backup takes time.
	await expect(stage(page)).toContainText('electrons pile up from complex IV backwards');
	await playUntil(page, stage(page), 'every carrier is loaded', 20000);
	await expect(stage(page)).toContainText(/oxygen used\s*0% of normal/);
});
