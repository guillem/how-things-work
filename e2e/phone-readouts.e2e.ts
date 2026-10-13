// Phone readouts (<Readout>, src/lib/explainer/readouts.svelte.ts): on screens
// ≤ 640 px a converted scene's readouts leave the drawing, where they would be
// ~5 px tall, and are listed as text under the stage. Wider screens keep them
// on the stage.
import { expect, test, type Page } from '@playwright/test';

const readouts = (page: Page) => page.getByRole('group', { name: 'Readouts' });
const drawing = (page: Page) => page.locator('.stage svg');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });

	test('epidemics: the peak readouts are text under the stage and follow R₀', async ({ page }) => {
		await page.goto('./epidemics/#peak');
		const panel = readouts(page);
		await expect(panel).toContainText('Effective R now');
		await expect(panel).toContainText(/Day\s*\d+/);
		await expect(panel).toContainText(/1\/R₀\s*33%/);
		await expect(drawing(page)).not.toContainText('Effective R');
		await expect(drawing(page)).not.toContainText(/Day \d+/);
		// Below the stage, not over it.
		const stageBox = (await page.locator('.stage').boundingBox())!;
		const panelBox = (await panel.boundingBox())!;
		expect(panelBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);

		await range(page, 'r0').fill('2');
		await expect(panel).toContainText(/1\/R₀\s*50%/);
	});

	test('photosynthesis: the lumen pH is text under the stage and follows the light', async ({
		page
	}) => {
		await page.goto('./photosynthesis/#atp');
		const panel = readouts(page);
		await expect(panel).toContainText(/Thylakoid lumen\s*pH ≈ 6\.2/);
		await expect(panel).toContainText(/Stroma\s*pH ≈ 8/);
		await expect(panel).toContainText('ATP synthase');
		await expect(drawing(page)).not.toContainText('pH ≈');

		await range(page, 'light').fill('0');
		await expect(panel).toContainText(/Thylakoid lumen\s*pH ≈ 8\.0/);
	});

	test('epidemics crowd: the counts are text under the stage and follow vaccination', async ({
		page
	}) => {
		await page.goto('./epidemics/#vaccination');
		const panel = readouts(page);
		await expect(panel).toContainText(/Susceptible\s*\d+/);
		await expect(panel).toContainText('Each case now infects');
		await expect(drawing(page)).not.toContainText('Each case now infects');
		await range(page, 'vaccinated').fill('50');
		await expect(panel).toContainText(/Vaccinated\s*150/);
	});

	test('epidemics tree: R₀ and the generations are text and follow R₀', async ({ page }) => {
		await page.goto('./epidemics/#r0');
		const panel = readouts(page);
		await expect(panel).toContainText(/Each case infects\s*R₀ = 3\.0/);
		await expect(drawing(page)).not.toContainText('Each case infects');
		await range(page, 'r0').fill('2');
		await expect(panel).toContainText(/R₀ = 2\.0/);
		await expect(panel).toContainText('1 → 2 → 4');
	});

	test('epidemics runs: the share that died out is text and follows R₀', async ({ page }) => {
		await page.goto('./epidemics/#chance');
		const panel = readouts(page);
		await expect(panel).toContainText(/Died out early\s*\d+ of 40/);
		await expect(panel).toContainText('1 in 3 = 33%');
		await expect(drawing(page)).not.toContainText('Died out early');
		await range(page, 'r0').fill('2');
		await expect(panel).toContainText('1 in 2 = 50%');
	});

	test('epidemics threshold: the threshold is text and follows R₀', async ({ page }) => {
		await page.goto('./epidemics/#threshold');
		const panel = readouts(page);
		await expect(panel).toContainText(/Threshold for R₀ = 3\.0\s*67% immune/);
		await expect(drawing(page)).not.toContainText('% immune');
		await range(page, 'r0').fill('2');
		await expect(panel).toContainText(/Threshold for R₀ = 2\.0\s*50% immune/);
	});

	test('photosynthesis leaf: long part names become numbered keys under the stage', async ({
		page
	}) => {
		await page.goto('./photosynthesis/#chloroplast');
		const panel = readouts(page);
		await expect(panel).toContainText('outer membrane');
		await expect(panel).toContainText('stroma: the Calvin cycle runs here');
		await expect(drawing(page)).not.toContainText('outer membrane');
	});

	test('photosynthesis spectrum: the wavelength readout is text and follows the slider', async ({
		page
	}) => {
		await page.goto('./photosynthesis/#pigments');
		const panel = readouts(page);
		await expect(panel).toContainText(/Light\s*550 nm · green/);
		await expect(panel).toContainText(/Whole leaf absorbs\s*\d+%/);
		await expect(drawing(page)).not.toContainText('eV per photon');
		await range(page, 'wavelength').fill('660');
		await expect(panel).toContainText(/Light\s*660 nm/);
	});

	test('photosynthesis Z-scheme: the counters and the photon budget are text', async ({ page }) => {
		await page.goto('./photosynthesis/#zscheme');
		const panel = readouts(page);
		await expect(panel).toContainText(/Photons absorbed\s*\d+/);
		await expect(panel).toContainText(/Per O₂\s*at least 8 photons/);
		await expect(drawing(page)).not.toContainText('photons absorbed');
	});

	test('photosynthesis Calvin cycle: the stage of the cycle follows the step', async ({ page }) => {
		await page.goto('./photosynthesis/#rubisco');
		const panel = readouts(page);
		await expect(panel).toContainText('RuBP + CO₂ → unstable 6C → 2 × 3-PGA');
		await expect(panel).toContainText('Carbon bookkeeping');
		await expect(drawing(page)).not.toContainText('Carbon bookkeeping');
		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/#reduction$/);
		await expect(panel).toContainText('3-PGA + ATP + NADPH → G3P');
		await expect(panel).not.toContainText('unstable 6C');
	});

	test('photosynthesis summary: the caption is text and follows the light', async ({ page }) => {
		await page.goto('./photosynthesis/#summary');
		const panel = readouts(page);
		await expect(panel).toContainText('6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂');
		await expect(drawing(page)).not.toContainText('6 CO₂ + 6 H₂O');
		await range(page, 'light').fill('0');
		await expect(panel).toContainText('the Calvin cycle stalls');
	});

	test('photosynthesis rate: the limiting factor is text and follows CO₂', async ({ page }) => {
		await page.goto('./photosynthesis/#limits');
		const panel = readouts(page);
		await expect(panel).toContainText(/O₂ released\s*[\d.]+ µmol/);
		await expect(panel).toContainText(/What sets the pace\s*Limited by/);
		await expect(drawing(page)).not.toContainText('What sets the pace');
		await range(page, 'co2').fill('50');
		await expect(panel).toContainText('loses carbon');
	});

	test('sorting bars: the counters are text under the stage and follow the starting order', async ({
		page
	}) => {
		await page.goto('./sorting/#bubble');
		const panel = readouts(page);
		await expect(panel).toContainText(/Comparisons\s*120/);
		await expect(panel).toContainText('in final place');
		await expect(drawing(page)).not.toContainText('comparisons');
		// Bubble sort stops after one walk without a swap: n − 1 comparisons on sorted bars.
		await page.getByRole('radio', { name: 'Sorted', exact: true }).click();
		await expect(panel).toContainText(/Comparisons\s*15\b/);
	});

	test('sorting race: the lane counts and places are text and follow the starting order', async ({
		page
	}) => {
		await page.goto('./sorting/#race');
		const panel = readouts(page);
		await expect(panel).toContainText(/Tick\s*all finished after \d+/);
		await expect(panel).toContainText(/Merge sort\s*\d+ comparisons · 1st/);
		await expect(drawing(page)).not.toContainText('comparisons');
		// Insertion sort on sorted bars: one comparison per bar after the first.
		await page.getByRole('radio', { name: 'Sorted', exact: true }).click();
		await expect(panel).toContainText(/Insertion sort\s*15 comparisons/);
	});

	test('sorting growth: the counts at 1,000 items are text and follow the starting order', async ({
		page
	}) => {
		await page.goto('./sorting/#growth');
		const panel = readouts(page);
		await expect(panel).toContainText(/At 1,000 items the slow pair needs\s*\d+ to \d+ times/);
		await expect(drawing(page)).not.toContainText('slow pair');
		await page.getByRole('radio', { name: 'Sorted', exact: true }).click();
		await expect(panel).toContainText(/Bubble = insertion\s*999 each/);
		// The same scene's later steps list their own readouts.
		await page.goto('./sorting/#machine');
		await expect(panel).toContainText(/Merge sort wins beyond\s*about [\d,]+ items/);
		await page.getByRole('radio', { name: '×1', exact: true }).click();
		await expect(panel).toContainText('merge sort is never slower');
	});

	test('keyboard step changes update the list', async ({ page }) => {
		await page.goto('./epidemics/#peak');
		await expect(readouts(page)).toContainText('Effective R now');
		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/#overshoot$/);
		await expect(readouts(page)).toContainText(/Peak\s*day \d+/);
		await expect(readouts(page)).not.toContainText('Effective R now');
		// Another scene replaces the list with its own.
		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/#chance$/);
		await expect(readouts(page)).toContainText('Died out early');
		await expect(readouts(page)).not.toContainText('Peak');
	});
});

test.describe('on a wide screen', () => {
	test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

	test('the readouts stay on the stage and there is no list', async ({ page }) => {
		await page.goto('./epidemics/#peak');
		await expect(drawing(page)).toContainText(/Day \d+/);
		await expect(drawing(page)).toContainText(/R = \d\.\d\d now: cases/);
		await page.goto('./photosynthesis/#atp');
		await expect(drawing(page)).toContainText('thylakoid lumen · pH ≈ 6.2');
		await expect(readouts(page)).toHaveCount(0);
	});
});
