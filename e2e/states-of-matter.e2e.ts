import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');

test('the phase diagram places water at 1 atm: ice, liquid, steam', async ({ page }) => {
	await page.goto('./states-of-matter/#water-diagram');
	const t = page.locator('input[type=range][data-control=waterT]');
	await t.fill('-10');
	await expect(stage(page)).toContainText(/water at −10 °C and 1 atm:\s*solid/);
	await t.fill('25');
	await expect(stage(page)).toContainText(/water at 25 °C and 1 atm:\s*liquid/);
	await t.fill('110');
	await expect(stage(page)).toContainText(/water at 110 °C and 1 atm:\s*gas/);
});

test('dry ice turns straight into gas at 1 atm', async ({ page }) => {
	await page.goto('./states-of-matter/#dryice');
	await expect(stage(page)).toContainText(/carbon dioxide at −100 °C and 1 atm:\s*solid/);
	await page.locator('input[type=range][data-control=dryT]').fill('-70');
	await expect(stage(page)).toContainText(/carbon dioxide at −70 °C and 1 atm:\s*gas/);
});

test('warming the ice melts the crystal in the box', async ({ page }) => {
	await page.clock.install();
	await page.goto('./states-of-matter/#melt');
	await expect(stage(page)).toContainText(/crystal pattern: [5-9]\d%/);
	await page.locator('input[type=range][data-control=meltT]').fill('20');
	await playUntil(page, stage(page), /crystal pattern: 1?\d%/, 20000);
});

test('switching the substance to water shows its hydrogen bonds', async ({ page }) => {
	await page.goto('./states-of-matter/#explore');
	await expect(stage(page)).toContainText('carbon dioxide (CO₂)');
	await page.locator('button[data-control=exploreSub][data-value=water]').click();
	await expect(stage(page)).toContainText('water (H₂O)');
	await expect(stage(page)).toContainText('hydrogen bonds per molecule');
});

// Phone readouts (as in phone-readouts.e2e.ts): on a narrow screen the readouts leave the
// drawing and are listed as text under the stage.
test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
	const readouts = (page: Page) => page.getByRole('group', { name: 'Readouts' });

	test('the box and the phase diagram are text under the stage and follow the temperature', async ({
		page
	}) => {
		await page.goto('./states-of-matter/#water-diagram');
		const panel = readouts(page);
		const t = page.locator('input[type=range][data-control=waterT]');
		await t.fill('-10');
		await expect(panel).toContainText(/water \(H₂O\)\s*−10 °C · 1 atm/);
		await expect(panel).toContainText(/State\s*solid/);
		await expect(panel).toContainText(/Hydrogen bonds per molecule\s*\d\.\d/);
		await expect(stage(page)).not.toContainText('hydrogen bonds per molecule');
		await t.fill('110');
		await expect(panel).toContainText(/State\s*gas/);
	});
});
