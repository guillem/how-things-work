import { expect, test, type Page } from '@playwright/test';

// The chromatography explainer: what a visitor sees when they change a compound's stickiness,
// the flow speed, the particle size, the column length and the surface. The model tests check
// the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.]+)`).exec(text);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('a stickier compound comes out later, at t_M(1 + k′)', { tag: '@smoke' }, async ({ page }) => {
	await page.goto('./chromatography/#retention');
	await expect(stage(page)).toContainText('marker: t_M = 50 s');
	await expect(stage(page)).toContainText('compound 1: t_R = 140 s');
	await expect(stage(page)).toContainText('compound 2: t_R = 150 s');
	await range(page, 'k2').fill('3');
	await expect(stage(page)).toContainText('compound 2: t_R = 200 s');
	await expect(stage(page)).toContainText('k′ = (t_R − t_M)/t_M = 3.00');
});

test('the plate height is smallest at a middling flow speed, and finer particles move it up', async ({
	page
}) => {
	await page.goto('./chromatography/#best');
	await expect(stage(page)).toContainText('the peak at 1 mm/s');
	const mid = await read(page, 'H =');
	await range(page, 'logu').fill('-1');
	await expect(stage(page)).toContainText('the peak at 0.1 mm/s');
	expect(await read(page, 'H =')).toBeGreaterThan(1.8 * mid);
	await range(page, 'logu').fill('1');
	await expect(stage(page)).toContainText('the peak at 10 mm/s');
	expect(await read(page, 'H =')).toBeGreaterThan(1.8 * mid);
	const best5 = await read(page, 'best:');
	expect(best5).toBeGreaterThan(0.7);
	expect(best5).toBeLessThan(1.4);
	await choose(page, 'dp', '2');
	await expect(stage(page)).toContainText('2 µm particles');
	expect(await read(page, 'best:')).toBeGreaterThan(2 * best5);
});

test('four times the column length doubles the resolution', async ({ page }) => {
	await page.goto('./chromatography/#length');
	await expect(stage(page)).toContainText('resolution R_s =');
	const short = await read(page, 'resolution R_s =');
	expect(short).toBeGreaterThan(1.2);
	expect(short).toBeLessThan(1.6);
	await range(page, 'L').fill('200');
	await expect(stage(page)).toContainText('column 200 mm');
	const long = await read(page, 'resolution R_s =');
	expect(long / short).toBeGreaterThan(1.8);
	expect(long / short).toBeLessThan(2.2);
});

test('an even surface gives symmetric peaks; a few very sticky sites make them tail', async ({
	page
}) => {
	await page.goto('./chromatography/#tailing');
	await expect(stage(page)).toContainText('compound 2: skewness');
	expect(await read(page, 'compound 2: skewness')).toBeGreaterThan(0.6);
	await choose(page, 'surface', 'even');
	await expect(stage(page)).toContainText('stickings per molecule: 32');
	const text = (await stage(page).textContent()) ?? '';
	const skew = /compound 2: skewness (−?[\d.]+)/.exec(text)?.[1].replace('−', '-');
	expect(Math.abs(Number(skew))).toBeLessThan(0.2);
});
