import { expect, test, type Page } from '@playwright/test';

// The calculus-of-variations explainer: what a visitor sees when they race the ramps, reshape their
// own, run the optimiser, move the end point and nudge the chain. The model tests check the numbers.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'the straight line loses the race, and a curve that climbs too high never arrives',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./calculus-of-variations/#race');
		await expect(stage(page)).toContainText('1.43 s');
		await expect(stage(page)).toContainText('1.17 s');
		await expect(stage(page)).toContainText('1.18 s');
		// Lift the first control point above A with the keyboard.
		const handle = page.getByRole('slider', { name: 'Control point 1 of your curve' });
		await handle.focus();
		await page.keyboard.press('Home');
		await expect(stage(page)).toContainText('never arrives');
		await page.keyboard.press('End');
		await expect(stage(page)).not.toContainText('never arrives');
	}
);

test('the cycloid wins by a measured margin', async ({ page }) => {
	await page.goto('./calculus-of-variations/#cycloid');
	await expect(stage(page)).toContainText('1.14 s');
	await expect(stage(page)).toContainText('the line loses by 0.29 s');
	await expect(stage(page)).toContainText('25 % slower than the cycloid');
});

test('gradient descent reaches the cycloid time with the residual near zero', async ({ page }) => {
	await page.goto('./calculus-of-variations/#descend');
	await expect(stage(page)).toContainText('optimiser, step 150');
	await expect(stage(page)).toContainText('1.140 s');
	await expect(stage(page)).toContainText(/largest residual: \d\.\d × 10⁻[⁴⁵⁶⁷⁸⁹] s\/m²/);
	// From the straight line it gets there too.
	await page.locator('button[data-control=from][data-value=line]').click();
	await expect(stage(page)).toContainText('1.140 s');
});

test('the cycloid dips below B only when L/h is more than π/2', async ({ page }) => {
	await page.goto('./calculus-of-variations/#dip');
	await expect(stage(page)).toContainText('the cycloid dips 7 cm below B');
	await range(page, 'span').fill('3');
	await expect(stage(page)).toContainText('no dip: L/h is below π/2');
	await range(page, 'span').fill('6');
	await expect(stage(page)).toContainText('the cycloid dips 48 cm below B');
	// Drag B to the far end with the keyboard: the slider follows.
	await page.getByRole('slider', { name: 'End point B' }).focus();
	await page.keyboard.press('End');
	await expect(range(page, 'span')).toHaveValue('8');
	await expect(stage(page)).toContainText('54 % slower than the cycloid');
});

test('the chain: the multiplier is the pull at the hooks; nudged, the arch loses energy', async ({
	page
}) => {
	await page.goto('./calculus-of-variations/#chain');
	await expect(stage(page)).toContainText('31.8 N');
	await expect(stage(page)).toContainText('sag 2.01 m');
	await expect(stage(page)).toContainText('the parabola is 0.12 J higher');
	await page.goto('./calculus-of-variations/#arch');
	await range(page, 'nudge').fill('-0.2');
	await expect(stage(page)).toContainText(/hanging chain[\s\S]*nudged: \+0\.\d\d J/);
	await expect(stage(page)).toContainText(/nudged: −0\.\d\d J/);
});
