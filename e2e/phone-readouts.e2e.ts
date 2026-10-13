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

	test('primes sieve: the factorisation is text under the stage and follows the number', async ({
		page
	}) => {
		await page.goto('./primes-modular-arithmetic/#primes');
		const panel = readouts(page);
		await expect(panel).toContainText(/Number\s*60 = 2² × 3 × 5/);
		await expect(panel).toContainText(/Divisor pairs\s*12 divisors/);
		await expect(drawing(page)).not.toContainText('in pairs that multiply');
		await range(page, 'pick').fill('13');
		await expect(panel).toContainText(/Number\s*13 is prime/);
	});

	test('primes clock: the sum mod m is text under the stage and follows the hours added', async ({
		page
	}) => {
		await page.goto('./primes-modular-arithmetic/#clock');
		const panel = readouts(page);
		await expect(panel).toContainText('9 + 5 ≡ 2 (mod 12)');
		await expect(drawing(page)).not.toContainText('(mod 12)');
		await range(page, 'addB').fill('10');
		await expect(panel).toContainText('9 + 10 ≡ 7 (mod 12)');
	});

	test('primes power: the fast power is text under the stage and follows the exponent', async ({
		page
	}) => {
		await page.goto('./primes-modular-arithmetic/#fast');
		const panel = readouts(page);
		await expect(panel).toContainText('2⁷⁷ ≡ 61 (mod 101)');
		await expect(drawing(page)).not.toContainText('square-and-multiply');
		await range(page, 'exponent').fill('1');
		await expect(panel).toContainText('2¹ ≡ 2 (mod 101)');
	});

	test('complex plane: the parts of z are text under the stage and follow the slider', async ({
		page
	}) => {
		await page.goto('./complex-numbers/#plane');
		const panel = readouts(page);
		await expect(panel).toContainText(/Real part\s*a = 2/);
		await expect(panel).toContainText('(2 + i) + (1 + 2i) = 3 + 3i');
		await expect(drawing(page)).not.toContainText('Adding works part by part');
		await range(page, 'zRe').fill('-1');
		await expect(panel).toContainText(/Real part\s*a = −1/);
	});

	test('complex product: lengths and angles are text under the stage and follow w', async ({
		page
	}) => {
		await page.goto('./complex-numbers/#multiply');
		const panel = readouts(page);
		await expect(panel).toContainText(/Lengths multiply\s*\|zw\| = 1\.40 × 1\.25 = 1\.75/);
		await expect(panel).toContainText(/Angles add\s*20° \+ 45° = 65°/);
		await expect(drawing(page)).not.toContainText('lengths multiply');
		await range(page, 'wAng').fill('90');
		await expect(panel).toContainText('20° + 90° = 110°');
	});

	test('complex Euler: cos θ and sin θ are text under the stage and follow θ', async ({ page }) => {
		await page.goto('./complex-numbers/#euler');
		const panel = readouts(page);
		await expect(panel).toContainText(/Angle\s*θ = 60° = π\/3 rad/);
		await expect(panel).toContainText(/cos θ\s*0\.50/);
		await expect(drawing(page)).not.toContainText('real part');
		await range(page, 'theta').fill('90');
		await expect(panel).toContainText(/cos θ\s*0\.00/);
		await expect(panel).toContainText(/sin θ\s*1\.00/);
	});

	test('error correction channel: letters intact are text and follow the noise', async ({
		page
	}) => {
		await page.goto('./error-correction/#compare');
		const panel = readouts(page);
		await expect(panel).toContainText(/Without coding\s*\d+ of 47 letters intact/);
		await expect(panel).toContainText('at 5.0% noise');
		await expect(drawing(page)).not.toContainText('letters intact');
		await range(page, 'noise').fill('0');
		await expect(panel).toContainText('100% without code, 100% with');
		await expect(panel).toContainText(/With the Hamming \(7, 4\) code\s*47 of 47 letters intact/);
	});

	test('error correction code: the verdict is text and follows the flips', async ({ page }) => {
		await page.goto('./error-correction/#repair');
		const panel = readouts(page);
		await expect(panel).toContainText(/Verdict\s*check 1 \+ check 4 fail → position 5/);
		await expect(panel).toContainText('The receiver flips bit 5 back.');
		await expect(drawing(page)).not.toContainText('The receiver flips');
		await page.getByRole('button', { name: 'Undo all flips' }).click();
		await expect(panel).toContainText(/Verdict\s*all checks even: no error/);
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

	test('circuits ohm: the current I = V ÷ R is text and follows the voltage', async ({ page }) => {
		await page.goto('./electric-circuits/#ohm');
		const panel = readouts(page);
		await expect(panel).toContainText(/Current, I = V ÷ R\s*6\.0 V ÷ 12 Ω = 0\.50 A/);
		await expect(drawing(page)).not.toContainText('Ohm’s law');
		await range(page, 'emf').fill('12');
		await expect(panel).toContainText('12.0 V ÷ 12 Ω = 1.00 A');
	});

	test('circuits drift: the drift speed is text and follows the current', async ({ page }) => {
		await page.goto('./electric-circuits/#drift');
		const panel = readouts(page);
		await expect(panel).toContainText(/Drift speed\s*≈ 0\.037 mm\/s/);
		await expect(drawing(page)).not.toContainText('Drift speed');
		await range(page, 'amps').fill('0');
		await expect(panel).toContainText(/Drift speed\s*0 mm\/s/);
		await expect(panel).toContainText(/No current \(0 A\)\s*nothing moves/);
	});

	test('logic gates: the gate and the table row are text and follow the gate picked', async ({
		page
	}) => {
		await page.goto('./logic-gates/#gates');
		const panel = readouts(page);
		await expect(panel).toContainText(/The gate\s*Out = A AND B\s*on only if both inputs are on/);
		await expect(panel).toContainText(/This row of the table\s*A = [01], B = [01] → Out = [01]/);
		await expect(drawing(page)).not.toContainText('Out = A AND B');
		await page.locator('button[data-control=gateKind][data-value=OR]').click();
		await expect(panel).toContainText(/The gate\s*Out = A OR B/);
	});

	test('logic gates 4-bit adder: the sum is text and follows A', async ({ page }) => {
		await page.goto('./logic-gates/#four');
		const panel = readouts(page);
		await expect(panel).toContainText(/Sum\s*11 \+ 6 = 17\s*1011 \+ 0110 = 10001 in binary/);
		await expect(drawing(page)).not.toContainText('in binary');
		await range(page, 'a4').fill('3');
		await expect(panel).toContainText(/Sum\s*3 \+ 6 = 9/);
	});

	test('internet routers: the route to Ben is text and follows the router picked', async ({
		page
	}) => {
		await page.goto('./internet/#routers');
		const panel = readouts(page);
		await expect(panel).toContainText(/Router D’s own table\s*Ben → send via G/);
		await expect(panel).toContainText(/Ben’s computer/);
		await expect(drawing(page)).not.toContainText('own table');
		await page.locator('button[data-control=router][data-value=A]').click();
		await expect(panel).toContainText(/Router A’s own table\s*Ben → send via/);
	});

	test('internet web page: the arrival time is text and follows the round trip', async ({
		page
	}) => {
		await page.goto('./internet/#web');
		const panel = readouts(page);
		await expect(panel).toContainText(/Page arrives after\s*\d+ ms/);
		await expect(panel).toContainText('3 round trips of 80 ms');
		await expect(drawing(page)).not.toContainText('Page arrives after');
		await range(page, 'rtt').fill('200');
		await expect(panel).toContainText('3 round trips of 200 ms');
	});

	test('pagerank votes: the ranking and the A/B callouts are text', async ({ page }) => {
		await page.goto('./pagerank/#weighted');
		const panel = readouts(page);
		await expect(panel).toContainText('C 36.5% · A 33.6% · B 20.3%');
		await expect(panel).toContainText(/A\s*1 vote, 33\.6%/);
		await expect(panel).toContainText(/B\s*4 votes, 20\.3%/);
		await expect(drawing(page)).not.toContainText('with all of C’s share');
	});

	test('pagerank surfer: the damping readout is text and follows the slider', async ({ page }) => {
		await page.goto('./pagerank/#damping');
		const panel = readouts(page);
		await expect(panel).toContainText(/Follows a link\s*85%/);
		await expect(panel).toContainText('Trap: D ⇄ E');
		await expect(drawing(page)).not.toContainText('Follows a link');
		await range(page, 'damping').fill('0.6');
		await expect(panel).toContainText(/Follows a link\s*60%/);
		await expect(panel).toContainText('jumps at random 40%');
	});

	test('pagerank iteration: the split and the ranks are text and follow the damping', async ({
		page
	}) => {
		await page.goto('./pagerank/#compute');
		const panel = readouts(page);
		await expect(panel).toContainText(/To the jump pool\s*15%/);
		await expect(panel).toContainText('C 36.5%');
		await expect(drawing(page)).not.toContainText('jump pool');
		await range(page, 'damping').fill('0.7');
		await expect(panel).toContainText(/To the jump pool\s*30%/);
		await expect(panel).toContainText(/Along its links\s*70%/);
	});

	test('learning from data fit: the errors are text and follow the degree', async ({ page }) => {
		await page.goto('./learning-from-data/#test');
		const panel = readouts(page);
		await expect(panel).toContainText(/Flexibility\s*degree 3: up to 2 bends/);
		await expect(panel).toContainText(/Test error\s*0\.047/);
		await expect(drawing(page)).not.toContainText('test error');
		await range(page, 'degree').fill('1');
		await expect(panel).toContainText(/Flexibility\s*degree 1/);
		await expect(panel).not.toContainText(/Test error\s*0\.047/);
	});

	test('learning from data curve: model and sweet spot are text and follow the degree', async ({
		page
	}) => {
		await page.goto('./learning-from-data/#sweetspot');
		const panel = readouts(page);
		await expect(panel).toContainText(/Your model\s*degree 3/);
		await expect(panel).toContainText(/Sweet spot\s*degree 6/);
		await expect(drawing(page)).not.toContainText('sweet spot');
		await range(page, 'degree').fill('6');
		await expect(panel).toContainText(/Your model\s*degree 6/);
	});

	test('reinforcement learning grid: the discount and what S is worth are text', async ({
		page
	}) => {
		await page.goto('./reinforcement-learning/#discount');
		const panel = readouts(page);
		await expect(panel).toContainText(/Discount factor\s*γ = 0\.90/);
		await expect(panel).toContainText(/What S is worth\s*learnt so far/);
		await expect(drawing(page)).not.toContainText('discount factor');
		await range(page, 'gamma').fill('0.5');
		await expect(panel).toContainText(/Discount factor\s*γ = 0\.50/);
	});

	test('reinforcement learning curve: the moves per episode are text and follow ε', async ({
		page
	}) => {
		await page.goto('./reinforcement-learning/#progress');
		const panel = readouts(page);
		await expect(panel).toContainText(/Random moves\s*10%/);
		await expect(panel).toContainText(/Episode 300\s*\d+ moves/);
		await expect(drawing(page)).not.toContainText('Moves per episode');
		await range(page, 'epsilon').fill('0.3');
		await expect(panel).toContainText(/Random moves\s*30%/);
	});

	test('entropy box: the arrangement count is text under the stage', async ({ page }) => {
		await page.goto('./entropy/#entropy');
		const panel = readouts(page);
		await expect(panel).toContainText(/Arrangements now, in multiples of the start\s*× \d/);
		await expect(panel).toContainText(/Highest possible\s*× \d/);
		await expect(panel).toContainText(/Wall\s*lifted at/);
		await expect(drawing(page)).not.toContainText('microstates (arrangements) now');
		await page.goto('./entropy/#mix');
		await expect(panel).toContainText(/Left half\s*T = \d\.\d/);
		await expect(drawing(page)).not.toContainText('temperature of each half');
	});

	test('entropy sharing: the energy split is text and follows the share', async ({ page }) => {
		await page.goto('./entropy/#share');
		const panel = readouts(page);
		await expect(panel).toContainText(/Energy on the left\s*80%/);
		await expect(panel).toContainText(/Ways to share the packets \(left × right\)\s*\d/);
		await expect(panel).toContainText(/the peak has .* times as many/);
		await expect(drawing(page)).not.toContainText('together (left × right)');
		await range(page, 'share').fill('50');
		await expect(panel).toContainText(/Energy on the left\s*50%/);
		await expect(panel).toContainText('this is the most likely share');
	});

	test('chaos pendulum: the release angle and energy are text and follow the angle', async ({
		page
	}) => {
		await page.goto('./chaos-fractals/#pendulum');
		const panel = readouts(page);
		await expect(panel).toContainText(/Released from\s*120°/);
		await expect(panel).toContainText(/Energy\s*-?\d+\.\d+ J/);
		await expect(drawing(page)).not.toContainText('Time since release');
		await range(page, 'angle').fill('60');
		await expect(panel).toContainText(/Released from\s*60°/);
		await page.goto('./chaos-fractals/#twins');
		await expect(panel).toContainText(/Starting difference\s*0\.001°/);
		await expect(drawing(page)).not.toContainText('Starting difference');
		await page.locator('button[data-control="nudge"][data-value="1"]').click();
		await expect(panel).toContainText(/Starting difference\s*1°/);
	});

	test('chaos logistic map: the growth rate and its outcome are text and follow r', async ({
		page
	}) => {
		await page.goto('./chaos-fractals/#logistic');
		const panel = readouts(page);
		await expect(panel).toContainText(/Growth rate\s*r = 2\.800/);
		await expect(panel).toContainText(/The population\s*settles at/);
		await expect(drawing(page)).not.toContainText('The population');
		await range(page, 'rate').fill('3.9');
		await expect(panel).toContainText(/Growth rate\s*r = 3\.900/);
		await expect(panel).toContainText('no year ever repeats an earlier one');
		await page.goto('./chaos-fractals/#cascade');
		await expect(panel).toContainText(/Lyapunov exponent\s*−?\d/);
		await expect(drawing(page)).not.toContainText('Lyapunov exponent');
	});

	test('mandelbrot: the orbits and the magnification are text and follow the place', async ({
		page
	}) => {
		await page.goto('./chaos-fractals/#mandelbrot');
		const panel = readouts(page);
		await expect(panel).toContainText(/Rule\s*z → z² \+ c/);
		await expect(panel).toContainText(/stays bounded|escapes after/);
		await expect(drawing(page)).not.toContainText('start at z₀ = 0');
		await page.goto('./chaos-fractals/#zoom');
		await expect(panel).toContainText(/Magnification\s*× 1\s*Repetitions/);
		await expect(drawing(page)).not.toContainText('repetitions per point');
		await page.locator('button[data-control="place"][data-value="minibrot"]').click();
		await expect(panel).not.toContainText(/Magnification\s*× 1\s*Repetitions/);
	});

	test('calculus slope: the tangent slope is text and follows the point', async ({ page }) => {
		await page.goto('./calculus/#tangent');
		const panel = readouts(page);
		await expect(panel).toContainText(/Curve\s*y = x²/);
		await expect(panel).toContainText(/Slope of the tangent\s*f′\(x\) = 2\.00/);
		await expect(drawing(page)).not.toContainText('slope of the tangent');
		await range(page, 'x').fill('2');
		await expect(panel).toContainText(/Point\s*x = 2\.00/);
		await expect(panel).toContainText(/f′\(x\) = 4\.00/);
	});

	test('calculus area: the rectangles’ total is text and follows n', async ({ page }) => {
		await page.goto('./calculus/#rectangles');
		const panel = readouts(page);
		await expect(panel).toContainText(/Rectangles\s*n = 4/);
		await expect(panel).toContainText(/Total of the rectangles\s*5\.91/);
		await expect(drawing(page)).not.toContainText('total of the rectangles');
		await range(page, 'n').fill('100');
		await expect(panel).toContainText(/Rectangles\s*n = 100/);
		await expect(panel).toContainText(/Total of the rectangles\s*8\.8\d/);
	});

	test('calculus running area: A(x) is text and follows the edge', async ({ page }) => {
		await page.goto('./calculus/#running');
		const panel = readouts(page);
		await expect(panel).toContainText(/Area from 0 to x\s*A\(x\) = 0\.33/);
		await expect(drawing(page)).not.toContainText('area from 0 to x');
		await range(page, 'x').fill('3');
		await expect(panel).toContainText(/A\(x\) = 9\.00/);
	});

	test('linear transformations plane: v is text and follows its sliders', async ({ page }) => {
		await page.goto('./linear-transformations/#arrows');
		const panel = readouts(page);
		await expect(panel).toContainText(/Vector v\s*v = \(2, 1\)/);
		await expect(panel).toContainText('2 steps right, 1 step up');
		await expect(drawing(page)).not.toContainText('Scaling by a number');
		await range(page, 'vx').fill('-3');
		await expect(panel).toContainText(/v = \(−3, 1\)/);
		await expect(panel).toContainText('3 steps left');
	});

	test('linear transformations: where v lands is text and follows v', async ({ page }) => {
		await page.goto('./linear-transformations/#follow');
		const panel = readouts(page);
		await expect(panel).toContainText(/Before\s*v = \(2, 1\)/);
		await expect(panel).toContainText(/After: the same recipe\s*= \(/);
		await expect(panel).toContainText('î lands on');
		await expect(drawing(page)).not.toContainText('v lands here');
		await range(page, 'vy').fill('3');
		await expect(panel).toContainText(/Before\s*v = \(2, 3\)/);
		await page.goto('./linear-transformations/#determinant');
		await expect(panel).toContainText(/det = ad − bc\s*.* = 3/);
		await expect(drawing(page)).not.toContainText('det = ad − bc');
	});

	test('seasons: the Sun’s overhead latitude is text and follows the date', async ({ page }) => {
		await page.goto('./sun-earth-moon/#orbit');
		const panel = readouts(page);
		await expect(panel).toContainText(/Sun overhead at noon\s*23\.4° N \(Tropic of Cancer\)/);
		await expect(drawing(page)).not.toContainText('Sun overhead at noon');
		await range(page, 'day').fill('354');
		await expect(panel).toContainText(/Sun overhead at noon\s*23\.4° S \(Tropic of Capricorn\)/);
		await page.goto('./sun-earth-moon/#distance');
		await expect(panel).toContainText(/From the Sun\s*\d+\.\d million km/);
		await expect(drawing(page)).not.toContainText('million km from the Sun');
	});

	test('sunlight: the day length is text and follows the latitude', async ({ page }) => {
		await page.goto('./sun-earth-moon/#daylength');
		const panel = readouts(page);
		await expect(panel).toContainText(/Day length\s*40° N on 21 Jun: 14 h 51 min of daylight/);
		await expect(panel).toContainText(/One day at 40° N\s*sunrise/);
		await expect(drawing(page)).not.toContainText('of the 24 hours in daylight');
		await range(page, 'latitude').fill('80');
		await expect(panel).toContainText(/One day at 80° N\s*daylight all 24 hours/);
	});

	test('moon: the phase and the lit fraction are text and follow the Moon', async ({ page }) => {
		await page.goto('./sun-earth-moon/#phases');
		const panel = readouts(page);
		await expect(panel).toContainText(/Waxing crescent\s*\d+% of the face lit/);
		await expect(panel).toContainText('Phases are not a shadow');
		await expect(drawing(page)).not.toContainText('days since new Moon');
		await range(page, 'moon').fill('7.5');
		await expect(panel).toContainText(/First quarter/i);
		await page.goto('./sun-earth-moon/#tilted');
		await expect(panel).toContainText(/This month\s*New Moon on/);
		await expect(drawing(page)).not.toContainText('New Moon on');
	});

	test('tides: the tidal range is text and follows the Moon', async ({ page }) => {
		await page.goto('./sun-earth-moon/#spring');
		const panel = readouts(page);
		await expect(panel).toContainText(/Tidal range now\s*1\.04× the Moon's alone/);
		await expect(drawing(page)).not.toContainText('Range now');
		await range(page, 'moon').fill('0');
		await expect(panel).toContainText(/Tidal range now\s*1\.[3-6]\d× the Moon's alone/);
		await page.goto('./sun-earth-moon/#tides');
		await expect(panel).toContainText(/Two high tides and two low tides\s*every 24 h 50 min/);
	});

	test('radioactivity nucleus: the decay and its half-life are text and follow the mode', async ({
		page
	}) => {
		await page.goto('./radioactivity/#nucleus');
		const panel = readouts(page);
		await expect(panel).toContainText(/Carbon-12\s*6 protons · 6 neutrons/);
		await page.goto('./radioactivity/#compare');
		await expect(panel).toContainText(/Alpha decay\s*half-life 432\.6/);
		await expect(panel).toContainText(/Emitted\s*α particle/);
		await expect(drawing(page)).not.toContainText('What stops it');
		await page.locator('button[data-control="mode"][data-value="beta"]').click();
		await expect(panel).toContainText(/Beta decay\s*half-life 5,700/);
		await expect(panel).toContainText(/Carbon-14 → Nitrogen-14\s*Z \+ 1, A same/);
	});

	test('radioactivity grid: the counts and the half-life are text and follow the slider', async ({
		page
	}) => {
		await page.goto('./radioactivity/#halflife');
		const panel = readouts(page);
		await expect(panel).toContainText(/After each half-life\s*½: \d/);
		await expect(panel).toContainText(/Intact\s*\d/);
		await expect(panel).toContainText(/half-life 8 s\s*\d\.\d half-lives: \d+ left/);
		await expect(drawing(page)).not.toContainText('After each half-life');
		await range(page, 'halflife').fill('20');
		await expect(panel).toContainText(/half-life 20 s/);
		await page.goto('./radioactivity/#random');
		await expect(panel).toContainText(/The circled nucleus\s*(still intact|decayed) after/);
	});

	test('carbon dating: the age is text and follows the carbon-14 left', async ({ page }) => {
		await page.goto('./radioactivity/#dating');
		const panel = readouts(page);
		await expect(panel).toContainText(/The sample\s*25% left/);
		await expect(panel).toContainText(/Age\s*≈ 11,400 years old/);
		await expect(drawing(page)).not.toContainText('years old');
		await range(page, 'fraction').fill('50');
		await expect(panel).toContainText(/Age\s*≈ 5,700 years old/);
		await page.goto('./radioactivity/#carbon14');
		await expect(panel).toContainText(/Upper atmosphere\s*nitrogen-14 → carbon-14/);
	});

	test('relativity clocks: each frame’s tick is text and follows the speed', async ({ page }) => {
		await page.goto('./special-relativity/#time-dilation');
		const panel = readouts(page);
		await expect(panel).toContainText(/Train speed\s*0\.6 c · γ = 1\.25/);
		await expect(panel).toContainText(
			/One tick, timed on the platform\s*platform clock 10\.0 ns · train clock 12\.5 ns/
		);
		await expect(drawing(page)).not.toContainText('one tick, timed on the platform');
		await range(page, 'beta').fill('0.8');
		await expect(panel).toContainText(/train clock 16\.7 ns/);
	});

	test('relativity γ: the moving clock’s tick and the muon ranges are text', async ({ page }) => {
		await page.goto('./special-relativity/#gamma');
		const panel = readouts(page);
		await expect(panel).toContainText(/Speed of the train\s*0\.6 c → γ = 1\.25/);
		await expect(panel).toContainText(/One tick, clock at 0\.6 c\s*12\.5 ns/);
		await expect(drawing(page)).not.toContainText('One tick of the light clock');
		await range(page, 'beta').fill('0.8');
		await expect(panel).toContainText(/One tick, clock at 0\.8 c\s*16\.7 ns/);
		await page.goto('./special-relativity/#muons');
		await expect(panel).toContainText(/Solid: what happens\s*[\d.]+ k?m/);
		await expect(drawing(page)).not.toContainText('what happens');
	});

	test('relativity length: each frame’s measurement is text and follows the speed', async ({
		page
	}) => {
		await page.goto('./special-relativity/#length');
		const panel = readouts(page);
		await expect(panel).toContainText(/Measured on the platform\s*train 160 m long/);
		await expect(panel).toContainText(/Measured on the train\s*platform 160 m long/);
		await expect(drawing(page)).not.toContainText('the train is 160 m long');
		await range(page, 'beta').fill('0.8');
		await expect(panel).toContainText(/train 120 m long/);
	});

	test('relativity lightning: when the strikes happen is text and follows the speed', async ({
		page
	}) => {
		await page.goto('./special-relativity/#train-view');
		const panel = readouts(page);
		await expect(panel).toContainText(/Train frame: the strikes\s*front first/);
		await expect(drawing(page)).not.toContainText('strikes:');
		await range(page, 'beta').fill('0');
		await expect(panel).toContainText(/Train frame: the strikes\s*same moment, t′ = 0/);
	});

	test('relativity spacetime: the event’s interval is text and follows the event', async ({
		page
	}) => {
		await page.goto('./special-relativity/#interval');
		const panel = readouts(page);
		await expect(panel).toContainText(/The event is\s*timelike/);
		await expect(panel).toContainText(/= 30000 m²/);
		await expect(drawing(page)).not.toContainText('s² =');
		await range(page, 'ex').fill('250');
		await range(page, 'ect').fill('0');
		await expect(panel).toContainText(/The event is\s*spacelike/);
	});

	test('optics mirror: both angles are text and follow the mirror', async ({ page }) => {
		await page.goto('./light-optics/#mirror');
		const panel = readouts(page);
		await expect(panel).toContainText(/Angle of incidence\s*47\.7°/);
		await expect(panel).toContainText(/Angle of reflection\s*47\.7°/);
		await expect(drawing(page)).not.toContainText('Angle of incidence');
		await range(page, 'mirror').fill('10');
		await expect(panel).not.toContainText(/Angle of incidence\s*47\.7°/);
	});

	test('optics wavefronts: the speed inside is text and follows n', async ({ page }) => {
		await page.goto('./light-optics/#slower');
		const panel = readouts(page);
		await expect(panel).toContainText(/Crown glass\s*n = 1\.52/);
		await expect(panel).toContainText(/Speed inside\s*66%/);
		await expect(drawing(page)).not.toContainText('Speed inside');
		await range(page, 'n').fill('2');
		await expect(panel).toContainText(/Speed inside\s*50%/);
	});

	test('optics boundary: the angles and Snell’s law are text and follow the ray', async ({
		page
	}) => {
		await page.goto('./light-optics/#snell');
		const panel = readouts(page);
		await expect(panel).toContainText(/In the material\s*25\.0°/);
		await expect(panel).toContainText('1.00 × sin 40.0° = 1.52 × sin 25.0°');
		await expect(drawing(page)).not.toContainText('1.00 × sin');
		await range(page, 'angle').fill('30');
		await expect(panel).toContainText(/In the air\s*30\.0°/);
		await page.goto('./light-optics/#tir');
		await expect(panel).toContainText(/Critical angle \(dashed\)\s*41\.1°/);
		await range(page, 'inside').fill('50');
		await expect(panel).toContainText(/Outside\s*none/);
	});

	test('optics fibre: what happens to the light is text and follows the bend', async ({ page }) => {
		await page.goto('./light-optics/#fibre');
		const panel = readouts(page);
		await expect(panel).toContainText(/The light\s*trapped/);
		await expect(drawing(page)).not.toContainText('Trapped');
		await range(page, 'bend').fill('5');
		await expect(panel).toContainText(/The light\s*escapes at the bend/);
	});

	test('optics lens: the focal length and the image are text and follow the controls', async ({
		page
	}) => {
		await page.goto('./light-optics/#lens');
		const panel = readouts(page);
		await expect(panel).toContainText(/Focal length \(formula\)\s*144 mm/);
		await expect(drawing(page)).not.toContainText('Focal length');
		await range(page, 'radius').fill('150');
		await expect(panel).not.toContainText(/Focal length \(formula\)\s*144 mm/);
		await page.goto('./light-optics/#image');
		await expect(panel).toContainText(/Object at u\s*200 mm/);
		await expect(panel).toContainText('real image');
		await range(page, 'u').fill('300');
		await expect(panel).toContainText(/Object at u\s*150 mm/);
	});

	test('optics prism: the refractive indices are text and follow the material', async ({
		page
	}) => {
		await page.goto('./light-optics/#prism');
		const panel = readouts(page);
		await expect(panel).toContainText('Flint glass prism');
		await expect(panel).toContainText(/n for red \(656 nm\)\s*1\.776/);
		await expect(drawing(page)).not.toContainText('n for red');
		await page.locator('button[data-control="material"][data-value="crown"]').click();
		await expect(panel).toContainText('Crown glass prism');
		await expect(panel).not.toContainText(/n for red \(656 nm\)\s*1\.776/);
	});

	test('optics rainbow: the bow’s angles are text and follow the light', async ({ page }) => {
		await page.goto('./light-optics/#rainbow');
		const panel = readouts(page);
		await expect(panel).toContainText(/Red comes back at\s*42\.3°/);
		await expect(drawing(page)).not.toContainText('Red comes back at');
		const white = page.locator('input[type=checkbox][data-control=white]');
		await white.focus();
		await page.keyboard.press('Space');
		await expect(white).not.toBeChecked();
		await expect(panel).toContainText(/The bow for 650 nm\s*\d+\.\d°/);
	});

	test('optics bench: the glass is text and follows the material', async ({ page }) => {
		await page.goto('./light-optics/#bench');
		const panel = readouts(page);
		await expect(panel).toContainText(/Lens and prism\s*Flint glass, n = 1\.784/);
		await expect(drawing(page)).not.toContainText('lens and prism');
		await page.locator('button[data-control="material"][data-value="water"]').click();
		await expect(panel).toContainText(/Lens and prism\s*Water, n = 1\.33/);
	});

	test('motor parts: the part names are numbered badges, named under the stage', async ({
		page
	}) => {
		await page.goto('./motors-generators/#parts');
		const panel = readouts(page);
		await expect(panel).toContainText('split-ring commutator');
		await expect(panel).toContainText('brushes');
		await expect(drawing(page)).not.toContainText('split-ring commutator');
	});

	test('motor and generator: the card’s values are text and follow the controls', async ({
		page
	}) => {
		await page.goto('./motors-generators/#force');
		const panel = readouts(page);
		await expect(panel).toContainText(/force on each side\s*3\.75 N/);
		await expect(panel).toContainText(/Graph: torque on the coil/);
		await expect(drawing(page)).not.toContainText('force on each side');
		await range(page, 'current').fill('0.5');
		await expect(panel).toContainText(/force on each side\s*2\.50 N/);
		await page.goto('./motors-generators/#ac');
		await expect(panel).toContainText(/peak, N·B·A·ω\s*3\.14 V/);
		await range(page, 'speed').fill('2');
		await expect(panel).toContainText(/peak, N·B·A·ω\s*6\.28 V/);
		await page.goto('./motors-generators/#same');
		await expect(panel).toContainText('electrical energy → motion');
		await page.locator('button[data-control="role"][data-value="generator"]').click();
		await expect(panel).toContainText('motion → electrical energy');
	});

	test('cryptography channel: what Eve copies is text under the stage', async ({ page }) => {
		await page.goto('./cryptography/#open-line');
		const panel = readouts(page);
		await expect(panel).toContainText(/Eve’s copy of the traffic\s*every message/);
		await expect(panel).toContainText('“Meet me at noon”');
		await expect(drawing(page)).not.toContainText('Eve reads them all');
		await page.goto('./cryptography/#shared-key');
		await expect(panel).toContainText(/Eve’s copy\s*[01]{8} [01]{8}/);
	});

	test('cryptography paint: the secrets are text and follow the paint chosen', async ({ page }) => {
		await page.goto('./cryptography/#paint-secrets');
		const panel = readouts(page);
		await expect(panel).toContainText(/Alice’s secret\s*red/);
		await expect(panel).toContainText(/Mixing paint is easy/);
		await expect(drawing(page)).not.toContainText('red: secret');
		await page.locator('button[data-control="alicePaint"][data-value="teal"]').click();
		await expect(panel).toContainText(/Alice’s secret\s*teal/);
	});

	test('cryptography key exchange: the public numbers are text and follow a', async ({ page }) => {
		await page.goto('./cryptography/#dh-public');
		const panel = readouts(page);
		await expect(panel).toContainText(/Alice sends\s*A = 2²⁹ mod 101 = 59/);
		await expect(drawing(page)).not.toContainText('square-and-multiply');
		await range(page, 'a').fill('30');
		await expect(panel).toContainText(/Alice’s secret\s*a = 30/);
		await expect(panel).toContainText(/A = 2³⁰ mod 101 = 17/);
	});

	test('cryptography discrete log: Eve’s target is text and follows a', async ({ page }) => {
		await page.goto('./cryptography/#dh-eve');
		const panel = readouts(page);
		await expect(panel).toContainText(/Eve wants a with\s*2ᵃ ≡ 59 \(mod 101\)/);
		await expect(panel).toContainText(/Real keys\s*a prime of 2048 bits/);
		await expect(drawing(page)).not.toContainText('Eve wants a');
		await range(page, 'a').fill('30');
		await expect(panel).toContainText(/2ᵃ ≡ 17 \(mod 101\)/);
	});

	test('cryptography hash: the sizes and the tries needed are text and follow the inputs', async ({
		page
	}) => {
		await page.goto('./cryptography/#hash');
		const panel = readouts(page);
		await expect(panel).toContainText(/In\s*15 characters = 120 bits/);
		await expect(panel).toContainText(/Out\s*256 bits/);
		await expect(drawing(page)).not.toContainText('whatever the length');
		await page.locator('input[data-field="msg"]').fill('Hi');
		await expect(panel).toContainText(/In\s*2 characters = 16 bits/);
		await page.goto('./cryptography/#hash-oneway');
		await expect(panel).toContainText(/Tries needed for 3 digits\s*16³ = 4,096/);
		await range(page, 'digits').fill('2');
		await expect(panel).toContainText(/Tries needed for 2 digits\s*16² = 256/);
	});

	test('cryptography signature: the verdict is text and follows Bob’s copy', async ({ page }) => {
		await page.goto('./cryptography/#sign');
		const panel = readouts(page);
		await expect(panel).toContainText(/Alice’s signature\s*s = \d+/);
		await expect(panel).toContainText(/✓ \d+ = \d+: valid/);
		await expect(drawing(page)).not.toContainText('Signed by Alice');
		await page.getByLabel('The message Bob received').fill('Pay Eve 10 €');
		await expect(panel).toContainText(/✗ \d+ ≠ \d+: invalid/);
		await expect(panel).toContainText(/Eve\s*changed it to “Pay Eve 10 €”/);
		await page.locator('.action button[data-control="resend"]').click();
		await expect(panel).toContainText(/✓ \d+ = \d+: valid/);
	});

	test('cryptography one-way streets: the streets are numbered and listed', async ({ page }) => {
		await page.goto('./cryptography/#one-way');
		const panel = readouts(page);
		await expect(panel).toContainText('Multiplying primes');
		await expect(panel).toContainText('Easy to do, practically impossible to undo');
		await expect(drawing(page)).not.toContainText('Multiplying primes');
	});

	test('compression message: the sizes are text and follow the message', async ({ page }) => {
		await page.goto('./compression/#bits');
		const panel = readouts(page);
		await expect(panel).toContainText(/UTF-8\s*296 bits/);
		await expect(panel).toContainText(/Fixed 4-bit code\s*148 bits/);
		await expect(drawing(page)).not.toContainText('UTF-8:');
		await page.getByLabel('Message', { exact: true }).fill('abab');
		await expect(panel).toContainText(/UTF-8\s*32 bits/);
		await expect(panel).toContainText(/Fixed 1-bit code\s*4 bits/);
	});

	test('compression Huffman: the coded sizes are text and follow the message', async ({ page }) => {
		await page.goto('./compression/#size');
		const panel = readouts(page);
		await expect(panel).toContainText(/Huffman code\s*114 bits/);
		await expect(panel).toContainText(/Entropy floor n × H\s*111\.4 bits/);
		await expect(drawing(page)).not.toContainText('Entropy floor');
		await page.getByLabel('Message', { exact: true }).fill('abab');
		await expect(panel).toContainText(/Huffman code\s*4 bits/);
	});

	test('compression block: what quantising keeps is text and follows the quality', async ({
		page
	}) => {
		await page.goto('./compression/#quantise');
		const panel = readouts(page);
		await expect(panel).toContainText(/Quality 50\s*steps from 10 to 121/);
		await expect(panel).toContainText(/Kept\s*15 of 64 coefficients/);
		await expect(drawing(page)).not.toContainText('coefficients kept');
		await range(page, 'quality').fill('90');
		await expect(panel).toContainText(/Quality 90\s*steps from/);
		await expect(panel).not.toContainText('15 of 64');
	});

	test('compression quality: the size and PSNR are text and follow the quality', async ({
		page
	}) => {
		await page.goto('./compression/#quality');
		const panel = readouts(page);
		await expect(panel).toContainText(/Size\s*12\.9 × smaller/);
		await expect(panel).toContainText(/PSNR\s*35\.7 dB/);
		await expect(drawing(page)).not.toContainText('PSNR');
		await range(page, 'quality').fill('10');
		await expect(panel).toContainText(/Size\s*47\.1 × smaller/);
	});

	test('cpu machine: the phase and the assembler are text and follow the program', async ({
		page
	}) => {
		await page.goto('./cpu/#execute');
		const panel = readouts(page);
		await expect(panel).toContainText(/Execute\s*Execute: the ALU works out 7 \+ 5 = 12/);
		await expect(drawing(page)).not.toContainText('the ALU works out');
		await page.goto('./cpu/#editor');
		await expect(panel).toContainText(/Assembler\s*19 of 32 bytes/);
		await expect(panel).toContainText(/Run\s*Halted after 44 instructions/);
		await expect(drawing(page)).not.toContainText('Assembled:');
		await page.getByLabel('Assembly program').fill('FOO');
		await expect(panel).toContainText(/Assembler\s*line 1: /);
	});

	test('cpu pipeline: the instructions finished and the clock rate are text', async ({ page }) => {
		await page.goto('./cpu/#speed');
		const panel = readouts(page);
		await expect(panel).toContainText(/One at a time\s*6 of 6 finished/);
		await expect(panel).toContainText(/Pipelined\s*6 of 6 finished/);
		await expect(panel).toContainText(/Intel Core i9-14900K \(2023\)\s*up to 6 GHz/);
		await expect(drawing(page)).not.toContainText('instructions finished');
	});

	test('atoms build: the element and its charge are text and follow the buttons', async ({
		page
	}) => {
		await page.goto('./atoms-periodic-table/#build');
		const panel = readouts(page);
		await expect(panel).toContainText(/Element\s*Carbon\s*carbon-12/);
		await expect(panel).toContainText(/Charge\s*0/);
		await expect(drawing(page)).not.toContainText('neutral atom');
		await page.locator('.action button[data-control=addProton]').click();
		await expect(panel).toContainText(/Element\s*Nitrogen/);
		await expect(panel).toContainText(/Charge\s*\+1/);
	});

	test('atoms shells: the configuration is text and follows the electrons', async ({ page }) => {
		await page.goto('./atoms-periodic-table/#shells');
		const panel = readouts(page);
		await expect(panel).toContainText(/Sodium \(Na\)\s*11 electrons/);
		await expect(panel).toContainText(/Electrons per shell\s*2 · 8 · 1/);
		await expect(drawing(page)).not.toContainText('Electrons per shell');
		await range(page, 'fillTo').fill('24');
		await expect(panel).toContainText(/Not the rule\s*measured/);
	});

	test('atoms orbitals: the orbital and its scale are text and follow the choice', async ({
		page
	}) => {
		await page.goto('./atoms-periodic-table/#orbitals');
		const panel = readouts(page);
		await expect(panel).toContainText(/Orbital\s*1s orbital/);
		await expect(panel).toContainText(/Scale bar\s*\d+ a₀/);
		await expect(drawing(page)).not.toContainText('Bohr radius');
		await page.locator('button[data-control=orbital][data-value="2p"]').click();
		await expect(panel).toContainText(/Orbital\s*2p orbital/);
		await expect(panel).toContainText('ψ negative');
	});

	test('atoms table: the chosen element and the trend scale are text', async ({ page }) => {
		await page.goto('./atoms-periodic-table/#table');
		const panel = readouts(page);
		await expect(panel).toContainText('d block · 10 columns');
		await expect(drawing(page)).not.toContainText('10 columns');
		await page.getByRole('slider', { name: /Periodic table/ }).focus();
		await page.keyboard.press('End');
		await expect(panel).toContainText(/Oganesson\s*Og · Z = 118/);
		await page.goto('./atoms-periodic-table/#trends');
		await expect(panel).toContainText(/Atomic radius \(covalent, pm\)\s*\d+ to \d+ pm/);
		await page.locator('button[data-control=colourBy][data-value=ionization]').click();
		await expect(panel).toContainText(/First ionization energy \(eV\)\s*[\d.]+ to [\d.]+ eV/);
		await page.goto('./atoms-periodic-table/#chemistry');
		await expect(panel).toContainText(/Group 17 · halogens\s*7 outer electrons/);
	});

	test('electromagnetism charges: the force and the field are text and follow the charges', async ({
		page
	}) => {
		await page.goto('./electromagnetism/#force');
		const panel = readouts(page);
		await expect(panel).toContainText(/Big charge\s*\+10 nC/);
		await expect(panel).toContainText(/Force on the test charge\s*8\.99 µN/);
		await expect(drawing(page)).not.toContainText('force on the test charge');
		await range(page, 'charge').fill('20');
		await expect(panel).toContainText(/Big charge\s*\+20 nC/);
		await expect(panel).not.toContainText('8.99 µN');
		await page.goto('./electromagnetism/#field');
		await expect(panel).toContainText(/Field at the test charge\s*[\d.]+ kN\/C/);
	});

	test('electromagnetism wire and coil: the fields are text and follow the current', async ({
		page
	}) => {
		await page.goto('./electromagnetism/#wire');
		const panel = readouts(page);
		await expect(panel).toContainText(/Current\s*5\.0 A/);
		await expect(panel).toContainText(/Wire’s field 2 cm away\s*50 µT/);
		await expect(drawing(page)).not.toContainText('2 cm away');
		await range(page, 'wireCurrent').fill('10');
		await expect(panel).toContainText(/Wire’s field 2 cm away\s*100 µT/);
		await page.goto('./electromagnetism/#coil');
		await expect(panel).toContainText(/Field in the middle\s*[\d.]+ mT/);
		await expect(panel).not.toContainText('Wire’s field');
		await page.locator('button[data-control=source][data-value=magnet]').click();
		await expect(panel).toContainText(/Source\s*bar magnet/);
	});

	test('electromagnetism induction: the induced voltage and current are text', async ({ page }) => {
		await page.goto('./electromagnetism/#magnet');
		const panel = readouts(page);
		await expect(panel).toContainText(/Voltage induced\s*[−+]?\d+ mV/);
		await expect(drawing(page)).not.toContainText('voltage induced');
		await page.goto('./electromagnetism/#neighbour');
		await expect(panel).toContainText(/Current in coil A\s*/);
		await page.locator('button[data-control=drive][data-value=hand]').click();
		await range(page, 'currentA').fill('1.5');
		await expect(panel).toContainText(/Current in coil A\s*\+?1\.50 A/);
	});

	test('electromagnetism light: the wavelength is text and follows the kind of wave', async ({
		page
	}) => {
		await page.goto('./electromagnetism/#light');
		const panel = readouts(page);
		await expect(panel).toContainText(/FM radio\s*100 MHz/);
		await expect(panel).toContainText(/Wavelength\s*3\.00 m/);
		await expect(drawing(page)).not.toContainText('one wavelength');
		await page.locator('button[data-control=band][data-value=micro]').click();
		await expect(panel).toContainText(/Microwave oven\s*2\.45 GHz/);
	});

	test('ecosystems field: the populations and the cycle are text and follow the controls', async ({
		page
	}) => {
		await page.goto('./ecosystems/#growth');
		const panel = readouts(page);
		await expect(panel).toContainText(/Carrying capacity K\s*600/);
		await expect(panel).toContainText(/Rabbits\s*\d+/);
		await expect(drawing(page)).not.toContainText('carrying capacity K');
		await range(page, 'room').fill('400');
		await expect(panel).toContainText(/Carrying capacity K\s*400/);
		await page.goto('./ecosystems/#cycles');
		await expect(panel).toContainText(/Cycle\s*One cycle ≈ [\d.]+ years/);
		await expect(panel).toContainText(/Foxes\s*\d+/);
		await range(page, 'birth').press('End');
		await range(page, 'predation').press('Home');
		await range(page, 'death').press('Home');
		await expect(panel).toContainText(/Cycle\s*Rabbits died out/);
		await page.goto('./ecosystems/#loop');
		await expect(panel).toContainText(/Balance point ✕\s*\d+ rabbits, \d+ foxes/);
	});

	test('ecosystems web: the counts are text and follow the switches', async ({ page }) => {
		await page.goto('./ecosystems/#web');
		const panel = readouts(page);
		await expect(panel).toContainText(/Now\s*In balance/);
		await expect(panel).toContainText(/Wolves\s*\d+/);
		await expect(drawing(page)).not.toContainText('wolves');
		const wolves = page.locator('input[type=checkbox][data-control=wolves]');
		await wolves.focus();
		await page.keyboard.press('Space');
		await expect(wolves).not.toBeChecked();
		await expect(panel).toContainText(/Wolves\s*switched off/);
		await page.goto('./ecosystems/#newcomer');
		await expect(panel).toContainText(/Deer\s*not here yet/);
	});

	test('heart: the chambers are numbered and the blood readouts are text', async ({ page }) => {
		await page.goto('./heart-circulation/#heart');
		const panel = readouts(page);
		await expect(panel).toContainText('left ventricle');
		await expect(panel).toContainText(/Oxygen-rich blood\s*98% O₂/);
		await expect(panel).toContainText(/Each beat\s*both squeeze out ≈ \d+ mL/);
		await expect(drawing(page)).not.toContainText('ventricle');
		await page.goto('./heart-circulation/#valves');
		await expect(panel).toContainText(/Valves open\s*\w/);
		await expect(drawing(page)).not.toContainText('tricuspid');
	});

	test('heart loop: the output is text and follows the heart rate', async ({ page }) => {
		await page.goto('./heart-circulation/#summary');
		const panel = readouts(page);
		await expect(panel).toContainText(/Each pump\s*\d\.\d L\/min\s*at 75 beats\/min/);
		await expect(drawing(page)).not.toContainText('L/min');
		await range(page, 'hr').fill('120');
		await expect(panel).toContainText(/at 120 beats\/min/);
	});

	test('heart monitor: the readout card is text and follows the heart rate', async ({ page }) => {
		await page.goto('./heart-circulation/#rate');
		const panel = readouts(page);
		await expect(panel).toContainText(/Blood pressure\s*\d+\/\d+/);
		await expect(panel).toContainText('left atrium');
		await expect(drawing(page)).not.toContainText('blood pressure');
		await expect(drawing(page)).not.toContainText('cardiac output');
		const output = panel.getByText(/L\/min/).first();
		const before = await output.textContent();
		await range(page, 'hr').fill('140');
		await expect(output).not.toHaveText(before!);
	});

	test('bridges pulled and pushed: the load and the limits are text and follow the load', async ({
		page
	}) => {
		await page.goto('./bridges-structures/#pullpush');
		const panel = readouts(page);
		await expect(panel).toContainText(/Load\s*40 kN/);
		await expect(panel).toContainText(/Pushed \(a 2 m post\)\s*70% of its limit/);
		await expect(drawing(page)).not.toContainText('of its limit');
		await range(page, 'load').fill('80');
		await expect(panel).toContainText(/Pushed \(a 2 m post\)\s*over its limit: buckles!/);
		await page.goto('./bridges-structures/#buckling');
		await expect(panel).toContainText(/Post\s*2\.0 m long\s*can take 57 kN/);
		await range(page, 'length').fill('4');
		await expect(panel).toContainText(/Post\s*4\.0 m long/);
		await expect(drawing(page)).not.toContainText('can take');
	});

	test('bridges: the verdict and the busiest member are text and follow the design', async ({
		page
	}) => {
		await page.goto('./bridges-structures/#compare');
		const panel = readouts(page);
		await expect(panel).toContainText(/Beam bridge\s*Fails/);
		await expect(panel).toContainText(/Arch\s*52% of its limit/);
		await expect(panel).toContainText('Pushes down on the bank');
		await expect(drawing(page)).not.toContainText('Busiest member');
		await page.locator('button[data-control=design][data-value=arch]').click();
		await expect(panel).toContainText(/Arch bridge\s*Every member within its limit/);
		await expect(panel).toContainText('outwards on the rock');
	});

	test('atmosphere balance: the heat flow and temperatures are text and follow the transport', async ({
		page
	}) => {
		await page.goto('./atmosphere-weather/#sunlight');
		const panel = readouts(page);
		await expect(panel).toContainText(/Sunlight at the equator\s*\d+ W\/m²/);
		await expect(drawing(page)).not.toContainText('at the poles');
		await page.goto('./atmosphere-weather/#transport');
		await expect(panel).toContainText(/Heat carried poleward\s*≈ \d\.\d PW/);
		await expect(drawing(page)).not.toContainText('PW');
		await range(page, 'transport').fill('0');
		await expect(panel).toContainText(/Heat carried poleward\s*none/);
	});

	test('atmosphere cells: the cell count is text and follows the spin', async ({ page }) => {
		await page.goto('./atmosphere-weather/#cells');
		const panel = readouts(page);
		await expect(panel).toContainText(/Cells\s*3 in each hemisphere/);
		await expect(panel).toContainText('Hadley cell');
		await expect(drawing(page)).not.toContainText('in each hemisphere');
		await range(page, 'spin').fill('0');
		await expect(panel).toContainText(/Cells\s*1 in each hemisphere/);
	});

	test('atmosphere Coriolis: each patch’s turn is text and follows the spin', async ({ page }) => {
		await page.goto('./atmosphere-weather/#coriolis');
		const panel = readouts(page);
		await expect(panel).toContainText(/60° N\s*turns right/);
		await expect(drawing(page)).not.toContainText('turns right');
		await range(page, 'spin').fill('0');
		await expect(panel).toContainText(/60° N\s*no turn/);
		await page.goto('./atmosphere-weather/#sink');
		await expect(panel).toContainText(/Ro ≈/);
		await expect(drawing(page)).not.toContainText('Rossby number');
	});

	test('atmosphere map: the centres’ pressures are text and follow the buttons', async ({
		page
	}) => {
		await page.goto('./atmosphere-weather/#pressure');
		const panel = readouts(page);
		await expect(panel).toContainText(/Centres\s*L \d+ hPa · H \d+ hPa/);
		await expect(drawing(page)).not.toContainText('hPa');
		await page.locator('button[data-control=clearMap]').click();
		await expect(panel).toContainText(/Centres\s*empty map/);
	});

	test('atmosphere storm: the wind and its ceiling are text and follow the sea', async ({
		page
	}) => {
		await page.goto('./atmosphere-weather/#hurricane');
		const panel = readouts(page);
		await expect(panel).toContainText(/Max possible over this sea\s*\d+ m\/s \(category 5\)/);
		await expect(panel).toContainText(/Sustained wind\s*\d+ m\/s/);
		await expect(drawing(page)).not.toContainText('km/h');
		await range(page, 'sst').fill('24');
		await expect(panel).toContainText(/Max possible over this sea\s*none: too cool/);
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
