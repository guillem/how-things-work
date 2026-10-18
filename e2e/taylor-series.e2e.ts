import { expect, test, type Page } from '@playwright/test';

// The taylor-series explainer: what a visitor sees when they add terms, move the point where the
// error is measured, move the centre, and compare with Chebyshev interpolation. The model tests
// check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'outside the radius of 1/(1 + x²), more terms make the polynomial worse',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./taylor-series/#wall');
		await expect(stage(page)).toContainText('at x = 1.50');
		await expect(stage(page)).toContainText('series converges for −1.00 < x < 1.00');
		await range(page, 'n').fill('10');
		await expect(stage(page)).toContainText('error 39.9');
		await range(page, 'n').fill('20');
		await expect(stage(page)).toContainText('error 2302');
		// inside the radius the same terms close in
		await range(page, 'probeOut').fill('0.5');
		await expect(stage(page)).toContainText('P₂₀ = 0.8000');
	}
);

test('dragging the error point with the keyboard moves it along the x axis', async ({ page }) => {
	await page.goto('./taylor-series/#bound');
	await expect(stage(page)).toContainText('at x = 4.00');
	const handle = page.getByRole('slider', { name: 'Point where the error is measured' });
	await handle.focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('at x = −4.00');
	await expect(range(page, 'probe')).toHaveValue('-4');
	await expect(stage(page)).toContainText("Taylor's bound");
});

test('moving the centre resizes the disk to the distance to ±i', async ({ page }) => {
	await page.goto('./taylor-series/#recentre');
	await expect(stage(page)).toContainText('R = 1.00: distance to ±i');
	await range(page, 'a').fill('2');
	await expect(stage(page)).toContainText('R = 2.24: distance to ±i');
	await expect(stage(page)).toContainText('series converges for −0.24 < x < 4.24');
	// log(1 + x): the distance to −1
	await page.locator('button[data-control=fn][data-value=log]').click();
	await expect(stage(page)).toContainText('R = 3.00: distance to −1');
	// eˣ has no singularity
	await page.locator('button[data-control=fn][data-value=exp]').click();
	await expect(stage(page)).toContainText('R = ∞: no singularity');
});

test('Chebyshev interpolation fits the whole interval where Taylor cannot', async ({ page }) => {
	await page.goto('./taylor-series/#chebyshev');
	await range(page, 'n').fill('20');
	await expect(stage(page)).toContainText(/Chebyshev 0\.006\d/);
	await expect(stage(page)).toContainText('Taylor 1.0 × 10¹²');
});

test('left of −1 the logarithm has no real value, so no error is shown', async ({ page }) => {
	await page.goto('./taylor-series/#log');
	await expect(stage(page)).toContainText('series converges for −1 < x ≤ 1.00');
	await range(page, 'probeOut').fill('-1.5');
	await expect(stage(page)).toContainText('no real value for x ≤ −1');
	await expect(stage(page)).toContainText('undefined for x ≤ −1');
	await expect(stage(page)).not.toContainText(/error \d|error at x/);
});
