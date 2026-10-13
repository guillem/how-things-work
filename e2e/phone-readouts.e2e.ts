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
