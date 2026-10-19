// The dislocations explainer as a visitor sees it, on the frozen reduced-motion frames: the
// gauge's readings for the perfect crystal, one dislocation, an alloy and a pile-up, and the
// controls that change the crystal.
import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** The divisor of a gauge reading such as "highest G/1,100" (the stress is G divided by it). */
async function reading(page: Page, which: 'now' | 'highest') {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${which} G/([\\d,.]+)`).exec(text);
	expect(m, `"${which} G/…" on the stage`).not.toBeNull();
	return Number(m![1].replace(/,/g, ''));
}

test('a perfect crystal holds to about G/7, one with a dislocation yields hundreds of times lower', async ({
	page
}) => {
	await page.goto('./dislocations-alloys/#perfect');
	await expect(stage(page)).toContainText('Perfect crystal: no dislocation');
	const perfect = await reading(page, 'highest');
	expect(perfect).toBeGreaterThan(5);
	expect(perfect).toBeLessThan(10);

	await page.goto('./dislocations-alloys/#dislocation');
	await expect(stage(page)).toContainText('Pure crystal with one edge dislocation');
	await expect(stage(page)).toContainText('edge dislocation');
	const glide = await reading(page, 'now');
	expect(glide / perfect).toBeGreaterThan(100);
});

test('foreign atoms of either size raise the stress; none leaves the pure crystal', async ({
	page
}) => {
	await page.goto('./dislocations-alloys/#solutes');
	await expect(stage(page)).toContainText('Alloy: 5 % larger foreign atoms');
	const large = await reading(page, 'highest');
	expect(large).toBeLessThan(300);

	await page.locator('button[data-control=size][data-value=small]').click();
	await expect(stage(page)).toContainText('Alloy: 5 % smaller foreign atoms');
	expect(await reading(page, 'highest')).toBeLessThan(300);

	await page.locator('input[type=range][data-control=fraction]').fill('0');
	await expect(stage(page)).toContainText('Alloy: 0 % smaller foreign atoms');
	expect(await reading(page, 'highest')).toBeGreaterThan(700);
});

test('the pile-up step drives one to three dislocations at a hard particle', async ({ page }) => {
	await page.goto('./dislocations-alloys/#pileup');
	await expect(stage(page)).toContainText('3 dislocations against a hard particle');
	await expect(stage(page)).toContainText('hard particle');
	// stopped at the particle, the crystal hardens far above the glide stress (about G/1,700)
	expect(await reading(page, 'highest')).toBeLessThan(170);
	await page.locator('input[type=range][data-control=count]').fill('1');
	await expect(stage(page)).toContainText('1 dislocation against a hard particle');
});

test('the gauge shows the measured band of real metals on the step about them', async ({
	page
}) => {
	await page.goto('./dislocations-alloys/#perfect');
	await expect(stage(page)).not.toContainText('real pure metals');
	await page.goto('./dislocations-alloys/#measured');
	await expect(stage(page)).toContainText('real pure metals');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('the gauge readings are listed as text under the stage', async ({ page }) => {
		await page.goto('./dislocations-alloys/#dislocation');
		const panel = page.getByRole('group', { name: 'Readouts' });
		await expect(panel).toContainText(/Stress now\s*G\/[\d,]+/);
		await expect(panel).toContainText(/Perfect crystal's peak\s*G\/\d/);
	});
});
