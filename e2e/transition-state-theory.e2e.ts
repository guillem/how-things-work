// The transition-state explainer as a visitor sees it, on the frozen reduced-motion frames:
// a trajectory's outcome and the fan's count as the energies change (the threshold of H + H₂,
// translation over the early pass of F + H₂, vibration over the late pass of H + HF), the
// clock at the pass, the Eyring rate's climb with temperature, and the H/D ratio.
import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

/** The number of the 24 phases that cross, from "Fan of 24 phases: N cross". */
async function crossing(page: Page) {
	const text = (await stage(page).textContent()) ?? '';
	const m = /Fan of 24 phases: (\d+) cross/.exec(text);
	expect(m, 'the fan count on the stage').not.toBeNull();
	return Number(m![1]);
}

/** A number in scientific form after a label, such as "rate = 9.5 × 10⁷". */
async function sci(page: Page, label: string) {
	const text = (await stage(page).textContent()) ?? '';
	const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
	const m = new RegExp(`${label} = ([\\d.]+) × 10([⁻${sup}]+)`).exec(text);
	expect(m, `"${label} = …" on the stage`).not.toBeNull();
	const exp = [...m![2]].map((c) => (c === '⁻' ? '-' : String(sup.indexOf(c)))).join('');
	return Number(m![1]) * 10 ** Number(exp);
}

test('H + H₂: too little translation turns back, enough crosses', async ({ page }) => {
	await page.goto('./transition-state-theory/#fire');
	await expect(stage(page)).toContainText('Crossed: H₂ + H');
	expect(await crossing(page)).toBeGreaterThan(18);
	await range(page, 'hTrans').fill('0.2');
	await expect(stage(page)).toContainText('No reaction: H + H₂');
	expect(await crossing(page)).toBe(0);
});

test('the early pass of F + H₂ wants translation; extra vibration does not help', async ({
	page
}) => {
	await page.goto('./transition-state-theory/#early');
	await expect(stage(page)).toContainText('Crossed: HF + H');
	const ground = await crossing(page);
	expect(ground).toBeGreaterThan(15);
	// the same translation with three quanta of vibration crosses less often
	await range(page, 'fV').fill('3');
	await expect(stage(page)).toContainText('vibration v = 3');
	expect(await crossing(page)).toBeLessThan(ground / 2);
});

test('the late pass of H + HF wants vibration; translation alone bounces off', async ({ page }) => {
	await page.goto('./transition-state-theory/#late');
	await expect(stage(page)).toContainText('Pass: 1.42 eV above the HF valley floor');
	await expect(stage(page)).toContainText('No reaction: H + HF');
	expect(await crossing(page)).toBe(0);
	await range(page, 'lTrans').fill('0.2');
	await range(page, 'lV').fill('3');
	await expect(stage(page)).toContainText('HF vibration v = 3');
	expect(await crossing(page)).toBeGreaterThan(6);
});

test('the pass is crossed in a few femtoseconds', async ({ page }) => {
	await page.goto('./transition-state-theory/#pass');
	const text = (await stage(page).textContent()) ?? '';
	const m = /Time within 0.2 Å of the pass: ([\d.]+) fs/.exec(text);
	expect(m).not.toBeNull();
	expect(Number(m![1])).toBeGreaterThan(0);
	expect(Number(m![1])).toBeLessThan(15);
});

test('the Eyring rate climbs steeply with temperature, and deuterium is slower', async ({
	page
}) => {
	await page.goto('./transition-state-theory/#eyring');
	await expect(stage(page)).toContainText('At 300 K: kT/h = 6.3 × 10¹² per second');
	const cold = await sci(page, 'energy-only factor');
	await range(page, 'temp').fill('600');
	await expect(stage(page)).toContainText('At 600 K');
	expect((await sci(page, 'energy-only factor')) / cold).toBeGreaterThan(100);

	await page.goto('./transition-state-theory/#isotope');
	// the temperature carries over from the step before: back to room temperature
	await range(page, 'temp').fill('300');
	await expect(stage(page)).toContainText('At 300 K');
	const text = (await stage(page).textContent()) ?? '';
	const ratio = Number(/k\(H\) \/ k\(D\) from E₀ alone = ([\d.]+)/.exec(text)![1]);
	expect(ratio).toBeGreaterThan(3);
	await page.locator('button[data-control=reaction][data-value=f-h2]').click();
	await expect(stage(page)).toContainText('E₀ (F + D₂)');
	const fText = (await stage(page).textContent()) ?? '';
	const fRatio = Number(/k\(H\) \/ k\(D\) from E₀ alone = ([\d.]+)/.exec(fText)![1]);
	expect(fRatio).toBeGreaterThan(1);
	expect(fRatio).toBeLessThan(ratio);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('the energies and the outcome are listed under the stage', async ({ page }) => {
		await page.goto('./transition-state-theory/#fire');
		const panel = page.getByRole('group', { name: 'Readouts' });
		await expect(panel).toContainText(/This shot\s*Crossed: H₂ \+ H/);
		await expect(panel).toContainText(/All 24 phases\s*\d+ of 24 cross/);
	});
});
