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

	test('binary byte: the hex reading is text under the stage and follows Add 1', async ({
		page
	}) => {
		await page.goto('./binary/#place');
		const panel = readouts(page);
		await expect(panel).toContainText(/Bit values\s*128 64 32 16 8 4 2 1/);
		await expect(panel).toContainText(/Hexadecimal\s*41/);
		await expect(drawing(page)).not.toContainText('in hexadecimal');
		await page.locator('button[data-control=plus1]').click();
		await expect(panel).toContainText(/Hexadecimal\s*42/);
	});

	test('binary adder: the column sum and the overflow verdict are text and follow the numbers', async ({
		page
	}) => {
		await page.goto('./binary/#add');
		const panel = readouts(page);
		await expect(panel).toContainText('carries');
		await expect(panel).toContainText(/Now\s*45 \+ 27 = 72/);
		await expect(drawing(page)).not.toContainText('four cases');
		await range(page, 'a').fill('50');
		await expect(panel).toContainText(/Now\s*50 \+ 27 = 77/);
		await page.goto('./binary/#overflow');
		await expect(panel).toContainText(
			/200 \+ 100 = 300\s*300 doesn't fit in 8 bits → 300 − 256 = 44/
		);
		await range(page, 'oa').fill('100');
		await expect(panel).toContainText('200 fits in 8 bits');
	});

	test('graph-search grid: the search counts and the route are text and follow the estimate', async ({
		page
	}) => {
		await page.goto('./graph-search/#estimate');
		const panel = readouts(page);
		await expect(panel).toContainText(/A\*\s*46 squares visited/);
		await expect(panel).toContainText(/Route found\s*21 steps · cost 21/);
		await expect(drawing(page)).not.toContainText('squares visited');
		await range(page, 'estimate').fill('5');
		await expect(panel).toContainText(/A\* · estimate × 5\s*\d+ squares visited/);
	});

	test('graph-search race: each search’s count and the takeaway are text', async ({ page }) => {
		await page.goto('./graph-search/#compare');
		const panel = readouts(page);
		await expect(panel).toContainText(/1 · Breadth-first.*\s*\d+ visited/);
		await expect(panel).toContainText(/3 · A\*\s*\d+ visited\s*cost \d+ · \d+ steps · cheapest/);
		await expect(panel).toContainText(/In short\s*A\* looked at \d+ squares/);
		await expect(drawing(page)).not.toContainText('Squares visited before reaching the goal');
	});

	test('graph-search roads: the route and the towns looked at are text and follow the method', async ({
		page
	}) => {
		await page.goto('./graph-search/#roads');
		const panel = readouts(page);
		await expect(panel).toContainText(/Shortest route\s*Ashford → .* = \d+ km/);
		await expect(panel).toContainText(/Towns looked at\s*Dijkstra: 9/);
		await expect(drawing(page)).not.toContainText('looked at');
		await page.locator('button[data-control=roadAlgo][data-value=astar]').click();
		await expect(panel).toContainText(/Towns looked at\s*A\*: 7/);
	});

	test("newton's laws carts: the acceleration is text and follows the mass", async ({ page }) => {
		await page.goto('./newtons-laws/#force');
		const panel = readouts(page);
		await expect(panel).toContainText('a = F ÷ m = 6 ÷ 2 = 3 m/s²');
		await expect(panel).toContainText(/Speed\s*3\.0 m\/s/);
		await expect(drawing(page)).not.toContainText('a = F ÷ m');
		await range(page, 'mass').fill('3');
		await expect(panel).toContainText('a = F ÷ m = 6 ÷ 3 = 2 m/s²');
	});

	test("newton's laws projectile: the range is text and follows the speed", async ({ page }) => {
		await page.goto('./newtons-laws/#projectile');
		const panel = readouts(page);
		await expect(panel).toContainText(/Range\s*33\.0 m/);
		await expect(panel).toContainText(/Horizontal speed\s*12\.7 m\/s/);
		await expect(drawing(page)).not.toContainText('Launched at');
		await range(page, 'speed').fill('9');
		await expect(panel).toContainText(/Range\s*8\.3 m/);
	});

	test("newton's laws track: the energies are text and follow friction", async ({ page }) => {
		await page.goto('./newtons-laws/#heat');
		const panel = readouts(page);
		await expect(panel).toContainText(/Total\s*98 J/);
		await expect(panel).toContainText(/Heat\s*[1-9]\d* J/);
		await expect(drawing(page)).not.toContainText('never changes');
		await range(page, 'mu').fill('0');
		await expect(panel).toContainText(/Heat\s*0 J/);
		await expect(panel).toContainText(/Total\s*98 J/);
	});

	test('orbits cannon: the outcome is text and follows the firing speed', async ({ page }) => {
		await page.goto('./orbits-kepler/#cannon');
		const panel = readouts(page);
		await expect(panel).toContainText(/Firing speed\s*5\.0 km\/s/);
		await expect(panel).toContainText(/The ball\s*lands after/);
		await expect(drawing(page)).not.toContainText('Firing speed');
		await range(page, 'cannonSpeed').fill('12');
		await expect(panel).toContainText(/The ball\s*escapes/);
	});

	test('orbits first law: the focal distances are text and follow the speed', async ({ page }) => {
		await page.goto('./orbits-kepler/#first');
		const panel = readouts(page);
		await expect(panel).toContainText(/Aphelion\s*1\.00 AU/);
		await expect(panel).toContainText('Distances to the two foci');
		await expect(drawing(page)).not.toContainText('perihelion');
		await range(page, 'ellipseSpeed').fill('1');
		await expect(panel).toContainText(/Path\s*circle/);
	});

	test('orbits third law: T² and a³ are text and follow the speed', async ({ page }) => {
		await page.goto('./orbits-kepler/#third');
		const panel = readouts(page);
		await expect(panel).toContainText(/T² and a³\s*0\.337 = 0\.337/);
		await expect(drawing(page)).not.toContainText('Your orbit');
		await range(page, 'ellipseSpeed').fill('1');
		await expect(panel).toContainText('a = 1.00 AU, T = 365 days');
	});

	test('oscillations spring: the natural frequency is text and follows the mass', async ({
		page
	}) => {
		await page.goto('./oscillations-resonance/#spring');
		const panel = readouts(page);
		await expect(panel).toContainText(/Natural frequency\s*0\.99 Hz/);
		await expect(drawing(page)).not.toContainText('natural frequency');
		await range(page, 'mass').fill('4');
		await expect(panel).toContainText(/Natural frequency\s*0\.50 Hz/);
	});

	test('oscillations pendulum: the period is text and follows the length', async ({ page }) => {
		await page.goto('./oscillations-resonance/#pendulum');
		const panel = readouts(page);
		await expect(panel).toContainText(/Small swings\s*2\.01 s/);
		await expect(drawing(page)).not.toContainText('small swings');
		await range(page, 'length').fill('4');
		await expect(panel).toContainText(/Small swings\s*4\.01 s/);
	});

	test('oscillations driven: the push and the swing are text and follow the push', async ({
		page
	}) => {
		await page.goto('./oscillations-resonance/#push');
		const panel = readouts(page);
		await expect(panel).toContainText(/Push\s*0\.60 Hz/);
		await expect(panel).toContainText(/The mass moves\s*\d+\.\d× your hand/);
		await expect(drawing(page)).not.toContainText('your hand');
		await range(page, 'pushFreq').fill('1.2');
		await expect(panel).toContainText(/Push\s*1\.20 Hz/);
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

	test('central limit theorem board: the board size is text and follows the rows', async ({
		page
	}) => {
		await page.goto('./central-limit-theorem/#why');
		const panel = readouts(page);
		await expect(panel).toContainText(/Balls dropped\s*2,000/);
		await expect(panel).toContainText(/12 rows → 13 bins/);
		await expect(panel).toContainText(/end bin: 1 of 4,096/);
		await expect(drawing(page)).not.toContainText('balls dropped');
		await range(page, 'rows').fill('4');
		await expect(panel).toContainText(/4 rows → 5 bins/);
		await expect(panel).toContainText(/end bin: 1 of 16/);
	});

	test('central limit theorem means: σ/√n is text and follows the sample size', async ({
		page
	}) => {
		await page.goto('./central-limit-theorem/#clt');
		const panel = readouts(page);
		await expect(panel).toContainText(/Starting distribution\s*Two humps/);
		await expect(panel).toContainText('0.394/√30 = 0.072');
		await expect(drawing(page)).not.toContainText('samples taken');
		await range(page, '"sampleSize:clt"').fill('10');
		await expect(panel).toContainText('0.394/√10 = 0.125');
	});

	test('bayes: the share of positives who are ill is text and follows the prevalence', async ({
		page
	}) => {
		await page.goto('./bayes-theorem/#sliders');
		const panel = readouts(page);
		await expect(panel).toContainText(/Positives who are ill\s*9 of 98/);
		await expect(panel).toContainText(/Exact, from Bayes’ theorem\s*9\.2%/);
		await expect(panel).toContainText('false positive 89');
		await expect(drawing(page)).not.toContainText('positives are ill');
		await range(page, 'prevalence').fill('0.3');
		await expect(panel).toContainText(/Exact, from Bayes’ theorem\s*81\.1%/);
		await expect(panel).toContainText('30% ill');
	});

	test('unit circle: cos θ and sin θ are text and follow the angle', async ({ page }) => {
		await page.goto('./unit-circle/#coordinates');
		const panel = readouts(page);
		await expect(panel).toContainText(/Angle\s*θ = 30°/);
		await expect(panel).toContainText(/cos θ\s*√3\/2 ≈ 0\.87/);
		await expect(drawing(page)).not.toContainText('(0.87, 0.50)');
		await range(page, 'angle').fill('60');
		await expect(panel).toContainText(/cos θ\s*½ ≈ 0\.50/);
		await expect(panel).toContainText(/sin θ\s*√3\/2 ≈ 0\.87/);
	});

	test('unit circle radians: the arc length is text and follows the angle', async ({ page }) => {
		await page.goto('./unit-circle/#radians');
		const panel = readouts(page);
		await expect(panel).toContainText(/The arc\s*≈ 0\.52 radii long/);
		await expect(panel).toContainText(/The rule\s*180° = π radians/);
		await expect(drawing(page)).not.toContainText('radii long');
		await range(page, 'angle').fill('90');
		await expect(panel).toContainText(/≈ 1\.57 radii long/);
	});

	test('unit circle waves: amplitude and frequency are text and follow the sliders', async ({
		page
	}) => {
		await page.goto('./unit-circle/#oscillation');
		const panel = readouts(page);
		await expect(panel).toContainText(/Amplitude\s*A = 1\.00/);
		await expect(panel).toContainText(/Frequency\s*f = 0\.25 Hz/);
		await expect(drawing(page)).not.toContainText('frequency f');
		await range(page, 'amplitude').fill('0.5');
		await expect(panel).toContainText(/Amplitude\s*A = 0\.50/);
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
