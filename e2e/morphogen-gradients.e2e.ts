import { expect, test, type Page } from '@playwright/test';

// The morphogen-gradient explainer: what a visitor sees when they change the morphogen's lifetime
// and production, drag a threshold, pick Bicoid's measured constants, compare a short and a long
// tissue with and without the expansion–repression circuit, and add reading noise. Reduced motion
// shows each scene's settled frame. The model tests check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
/** The numbers after each `prefix` in the stage's text, in order. */
const readAll = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const re = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.]+)`, 'g');
	return [...text.matchAll(re)].map((m) => Number(m[1]));
};
const read = async (page: Page, prefix: string) => {
	const all = await readAll(page, prefix);
	if (all.length === 0) throw new Error(`no "${prefix}" in the stage`);
	return all[0];
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'the length scale is √(D·τ): four times the lifetime doubles it',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./morphogen-gradients/#shape');
		await expect(stage(page)).toContainText('= 90 µm');
		await range(page, 'halfLife').fill('104');
		await expect(stage(page)).toContainText('= 180 µm');
	}
);

test('doubling production moves a boundary back by λ·ln 2', async ({ page }) => {
	await page.goto('./morphogen-gradients/#flag');
	const before = await read(page, 'blue | white:');
	await range(page, 'prod').fill('2');
	await expect(stage(page)).not.toContainText(`blue | white: ${before} µm`);
	const after = await read(page, 'blue | white:');
	expect(after - before).toBeGreaterThan(60);
	expect(after - before).toBeLessThan(65);
});

test('a threshold handle moves with the keyboard and the slider follows', async ({ page }) => {
	await page.goto('./morphogen-gradients/#flag');
	const handle = page.getByRole('slider', { name: 'low threshold' });
	await handle.focus();
	await page.keyboard.press('Home');
	await expect(range(page, 't2')).toHaveValue('1');
	await expect(stage(page)).toContainText('low threshold: 1');
	expect(await read(page, 'white | red:')).toBeGreaterThan(400);
});

test("FRAP's diffusion constant gives a gradient far shorter than the measured one", async ({
	page
}) => {
	await page.goto('./morphogen-gradients/#bicoid');
	await expect(stage(page)).toContainText('λ = √(D·τ) = 90 µm');
	await expect(stage(page)).toContainText('measured: λ ≈ 100 µm');
	await page.locator('button[data-control=measure][data-value=frap]').click();
	await expect(stage(page)).toContainText('λ = √(D·τ) = 26 µm');
});

test('a longer tissue keeps its proportions only with the expansion–repression circuit', async ({
	page
}) => {
	await page.goto('./morphogen-gradients/#scale-fail');
	await expect(stage(page)).toContainText('1000 µm');
	let [a, b] = await readAll(page, 'blue');
	expect(a).toBeGreaterThan(1.8 * b);
	await page.goto('./morphogen-gradients/#expander');
	await expect(stage(page)).toContainText('expansion–repression on');
	[a, b] = await readAll(page, 'blue');
	expect(Math.abs(a - b)).toBeLessThanOrEqual(3);
	const toggle = page.locator('input[type=checkbox][data-control=expander]');
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(stage(page)).toContainText('expansion–repression off');
	[a, b] = await readAll(page, 'blue');
	expect(a).toBeGreaterThan(1.8 * b);
});

test('noise blurs the boundary in the flat tail more than the one on the steep part', async ({
	page
}) => {
	await page.goto('./morphogen-gradients/#noise');
	const [high, low] = await readAll(page, 'positional error ±');
	expect(low).toBeGreaterThan(2.5 * high);
	await range(page, 'noise').fill('0');
	await expect(stage(page)).not.toContainText('positional error');
});
