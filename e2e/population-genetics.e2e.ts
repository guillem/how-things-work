// Browser tests of the population-genetics page: Hardy–Weinberg from any parents, newborns that
// match it while p moves, drift ending in fixation or loss, heterozygosity's 1/2N decay, about 2s
// for a new beneficial mutation whatever N, a recessive advantage that selection barely sees,
// and a harmful allele that still fixes in a small population. Reduced motion shows every run
// whole, so its frames are exact.
import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
const pick = (page: Page, control: string, value: string) =>
	page.locator(`button[data-control="${control}"][data-value="${value}"]`).click();
async function key(page: Page, id: string, k: string) {
	await range(page, id).focus();
	await page.keyboard.press(k);
}

test(
	'one generation of random mating gives p², 2pq, q² whatever the parents',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('./population-genetics/#hardy-weinberg');
		await expect(stage(page)).toContainText('share of A: 30% in the parents → 30% in the children');
		// children: 9%, 42%, 49%; the parents have no heterozygotes
		await expect(stage(page)).toContainText('9.0%');
		await expect(stage(page)).toContainText('42%');
		await expect(stage(page)).toContainText('49%');
		await pick(page, 'parents', 'het');
		await expect(stage(page)).toContainText('60%');
		await expect(stage(page)).toContainText('share of A: 30% in the parents → 30% in the children');
		await range(page, 'p_hw').fill('0.5');
		await expect(stage(page)).toContainText('share of A: 50% in the parents → 50% in the children');
		await expect(stage(page)).toContainText('25%');
	}
);

test('a single population: its newborns sit on the Hardy–Weinberg shares', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./population-genetics/#one-population');
	await expect(stage(page)).toContainText('generation 200');
	await expect(stage(page)).toContainText('one population · N = 200');
	await expect(stage(page).getByText(/^HW /)).toHaveCount(3);
});

test('with no selection every small population ends fixed or lost', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./population-genetics/#drift');
	await key(page, 'N_d', 'Home');
	await expect(stage(page)).toContainText('N = 10');
	await expect(stage(page)).toContainText(/both still present\s*0/);
	await expect(stage(page)).toContainText('50 of 100 (its starting share)');
	await key(page, 'N_d', 'End');
	await expect(stage(page)).toContainText('N = 1,000');
	// a thousand individuals drift slowly: after 400 generations nearly all still have both
	const text = (await stage(page).textContent()) ?? '';
	expect(Number(/both still present\s*(\d+)/.exec(text)?.[1])).toBeGreaterThan(90);
});

test('the drift plays generation by generation', async ({ page }) => {
	await page.clock.install();
	await page.goto('./population-genetics/#drift');
	await playUntil(page, stage(page), /generation 1\d\d100 populations/, 15_000);
	await playUntil(page, stage(page), 'generation 400', 15_000);
});

test('heterozygosity halves in about 1.4 N generations', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./population-genetics/#heterozygosity');
	await expect(stage(page)).toContainText('about 42 generations (1.4 N)');
	await key(page, 'N_d', 'End');
	await expect(stage(page)).toContainText('about 1,386 generations (1.4 N)');
});

test('a new beneficial mutation fixes about 2s of the time, whatever N', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./population-genetics/#new-mutations');
	const share = async () => {
		const text = (await stage(page).textContent()) ?? '';
		const m = /fixed\s*[\d,]+ \(([\d.]+)%\)/.exec(text);
		return m ? Number(m[1]) : NaN;
	};
	await expect(stage(page)).toContainText(/Haldane: 2s\s*10%/);
	await expect(stage(page)).toContainText(/Kimura\s*9\.5%/);
	for (const k of ['Home', 'End']) {
		await key(page, 'N_n', k);
		await expect(stage(page)).toContainText(k === 'Home' ? 'N = 100' : 'N = 10,000');
		// 2,000 runs: 9.5% ± 0.7% (one standard error), so within about three
		const s = await share();
		expect(s).toBeGreaterThan(7.5);
		expect(s).toBeLessThan(11.5);
	}
});

test('a recessive advantage is hidden while the allele is rare', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./population-genetics/#dominance');
	await expect(stage(page)).toContainText('31 of 100 (31%)');
	await pick(page, 'h_d', '0.5');
	await expect(stage(page)).toContainText('98 of 100 (98%)');
});

test('in a small population a harmful allele still fixes', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./population-genetics/#n-times-s');
	await expect(stage(page)).toContainText('N × s = −0.5');
	await key(page, 'N_b', 'Home');
	await range(page, 's_b').fill('-0.01');
	await expect(stage(page)).toContainText('N = 10, s = −1% per copy');
	await expect(stage(page)).toContainText('fixes with chance 4.1%');
	await key(page, 'N_b', 'End');
	await expect(stage(page)).toContainText('simulated (ring): 0 of 4,000 fixed');
});
