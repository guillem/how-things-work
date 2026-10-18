import { expect, test, type Page } from '@playwright/test';

// The differential-equations explainer: what a visitor sees when they drop starting points on
// the slope field, move the newest one, overlay the exact formula, and raise the catch of the
// fish stock past rK/4. The model tests check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const action = (page: Page, id: string) => page.locator(`.action button[data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'raising the catch past rK/4 merges the two level lines and then removes them',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./differential-equations/#harvest');
		await expect(stage(page)).toContainText('level lines: N = 20 unstable, N = 80 stable');
		// the newest preset starts below the threshold and collapses
		await expect(stage(page)).toContainText('stock gone after 3.9 years');
		await range(page, 'H').fill('12.5');
		await expect(stage(page)).toContainText('level lines: N = 50 semi-stable');
		await page.goto('./differential-equations/#collapse');
		await expect(stage(page)).toContainText('no level line at all');
		await expect(stage(page)).toContainText('stock gone after 14.6 years');
		// just past the edge the stock lingers for decades
		await range(page, 'H2').fill('13');
		await expect(stage(page)).toContainText('at year 40: N = 40.7');
	}
);

test('clicking the plot drops a start and traces the curve through it', async ({ page }) => {
	await page.goto('./differential-equations/#follow');
	await expect(stage(page)).toContainText('t₀ = 5.00 h, y₀ = 40.0 thousand');
	const plot = page.locator('.de-drop');
	const box = await plot.boundingBox();
	if (!box) throw new Error('no plot');
	await plot.click({ position: { x: box.width / 2, y: box.height / 2 } });
	await expect(stage(page)).toContainText(/t₀ = (4\.9\d|5\.0\d) h, y₀ = (49\.\d|50\.\d) thousand/);
	// the exact formula lies on the traced curve: they differ by less than a billionth
	await expect(stage(page)).toContainText(/largest gap: \d\.\d × 10⁻(⁹|¹[⁰¹²³⁴⁵⁶⁷⁸⁹])/);
	const toggle = page.locator('input[type=checkbox][data-control=exact]');
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(toggle).not.toBeChecked();
	await expect(stage(page)).not.toContainText('largest gap');
});

test('the newest start moves with the keyboard', async ({ page }) => {
	await page.goto('./differential-equations/#cooling');
	await expect(stage(page)).toContainText('T₀ = 5.00 °C');
	const handle = page.getByRole('slider', { name: 'Start of the newest curve' });
	await handle.focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('T₀ = 100.0 °C');
	await expect(stage(page)).toContainText('level lines: T = 20 stable');
	await range(page, 'room').fill('30');
	await expect(stage(page)).toContainText('level lines: T = 30 stable');
});

test('curves never cross, however many are added', async ({ page }) => {
	await page.goto('./differential-equations/#cross');
	await expect(stage(page)).toContainText('10 curves on the plot');
	await expect(stage(page)).toContainText('crossings found: 0');
	// each new curve goes into the widest gap left at the left edge, so no two are the same
	await action(page, 'add').click();
	const first = await stage(page)
		.getByText(/^t₀ = /)
		.textContent();
	await action(page, 'add').click();
	await expect(stage(page)).toContainText('12 curves on the plot');
	await expect(stage(page).getByText(/^t₀ = /)).not.toHaveText(first ?? '');
	await expect(stage(page)).toContainText('crossings found: 0');
	await page.locator('button[data-control=crossRule][data-value=riccati]').click();
	await expect(stage(page)).toContainText('crossings found: 0');
	// back to the first curves
	await page.locator('button[data-control=crossRule][data-value=logistic]').click();
	await action(page, 'clear').click();
	await expect(stage(page)).toContainText('10 curves on the plot');
});

test('stability is read from the sign of f', async ({ page }) => {
	await page.goto('./differential-equations/#sign');
	await expect(stage(page)).toContainText('level lines: N = 0 unstable, N = 100 stable');
	await page.locator('button[data-control=signRule][data-value=growth]').click();
	await expect(stage(page)).toContainText('level lines: y = 0 unstable');
});

test('a rule with no formula is still traced', async ({ page }) => {
	await page.goto('./differential-equations/#no-formula');
	await expect(stage(page)).toContainText('newest curve at t = 6: y = 2.41');
});
