import { expect, test, type Page } from '@playwright/test';

// The Turing-pattern explainer: what a visitor sees when they move the diffusion ratio across its
// critical value, change the activator's diffusion, saturate the activator, narrow the tail and
// watch the strip grow. Reduced motion shows each run settled (seeded noise, so deterministic).
// The model tests check the numbers against linear stability theory.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = text.match(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.]+)`));
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'a pattern forms only above the critical diffusion ratio',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./turing-patterns/#onset');
		await expect(stage(page)).toContainText('critical Dₕ/Dₐ ≈ 21');
		await expect(stage(page)).toContainText('a pattern has formed');
		await range(page, 'ratio').fill('15');
		await expect(stage(page)).toContainText('small ripples fade');
		await expect(stage(page)).toContainText('Dₕ/Dₐ = 15');
	}
);

test('with equal diffusion the noise fades', async ({ page }) => {
	await page.goto('./turing-patterns/#loop');
	await expect(stage(page)).toContainText('Dₕ/Dₐ = 1');
	await expect(stage(page)).toContainText('every ripple fades');
});

test('the measured spacing matches the predicted wavelength, and scales as √Dₐ', async ({
	page
}) => {
	await page.goto('./turing-patterns/#spacing');
	await expect(stage(page)).toContainText('fastest-growing wavelength: 12.5 cells');
	await expect(stage(page)).toContainText('spacing measured in the dish:');
	const measured = await read(page, 'spacing measured in the dish:');
	expect(Math.abs(measured / 12.5 - 1)).toBeLessThan(0.08);
	await range(page, 'Da').fill('0.25');
	await expect(stage(page)).toContainText('fastest-growing wavelength: 6.2 cells');
	await expect(stage(page)).not.toContainText(`dish: ${measured.toFixed(1)} cells`);
	const quarter = await read(page, 'spacing measured in the dish:');
	expect(measured / quarter).toBeGreaterThan(1.8);
	expect(measured / quarter).toBeLessThan(2.2);
});

test('saturating the activator turns spots into stripes', async ({ page }) => {
	await page.goto('./turing-patterns/#shapes');
	await expect(stage(page)).toContainText('pattern: spots');
	await expect(stage(page)).toContainText('0 stripes');
	await range(page, 'kappa').fill('0.15');
	await expect(stage(page)).toContainText('pattern: stripes (a labyrinth)');
	await expect(stage(page)).toContainText('critical Dₕ/Dₐ ≈ 98');
});

test('a narrow tail makes bands, a wider one spots', async ({ page }) => {
	await page.goto('./turing-patterns/#tail');
	await expect(stage(page)).toContainText('tail: bands');
	await range(page, 'tip').fill('12');
	await expect(stage(page)).toContainText('tail: spots');
});

test('the growing strip doubles its stripes as it grows, keeping its spacing', async ({ page }) => {
	await page.goto('./turing-patterns/#growth');
	await expect(stage(page)).toContainText('length 200 cells');
	const stripes = await read(page, 'length 200 cells ·');
	expect(stripes).toBeGreaterThanOrEqual(15);
	// the history marks the insertions: about doubling each time
	await expect(stage(page)).toContainText('9 stripes');
	const spacing = await read(page, 'spacing');
	expect(spacing).toBeGreaterThan(10);
	expect(spacing).toBeLessThan(22);
});

test('on a phone the critical ratio is listed under the stage', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('./turing-patterns/#onset');
	const panel = page.getByRole('group', { name: 'Readouts' });
	await expect(panel).toContainText('Critical ratio');
	await expect(panel).toContainText('21×');
});

test('feather buds are listed as mixed evidence, not well supported', async ({ page }) => {
	// Shyer et al. (2017): a mechanical instability starts the feather spacing, as the text says.
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('./turing-patterns/#nature');
	const row = (label: string) =>
		page.getByRole('group', { name: 'Readouts' }).locator('.row', { hasText: label });
	await expect(row('mixed')).toContainText('feather buds');
	await expect(row('well supported')).not.toContainText('feather');
});
