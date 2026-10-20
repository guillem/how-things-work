import { expect, test, type Page } from '@playwright/test';

// The caches explainer: what a visitor sees when they change the line length, sum by columns
// on different caches, make a direct-mapped cache thrash, change the replacement rule, tile
// the matrix product, turn the L2 off and on, and add an L2 to the latency curve. Reduced
// motion shows each run finished. The model tests check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`).click();
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d,.]+)`).exec(text);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1].replace(/,/g, ''));
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'a row sum misses once per line: one load in eight with 64-byte lines, one in two with 16',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./cache-memory-hierarchy/#lines');
		await expect(stage(page)).toContainText('256 of 256 accesses · 32 misses');
		await range(page, 'line').press('Home');
		await expect(stage(page)).toContainText('16-byte lines');
		await expect(stage(page)).toContainText('256 of 256 accesses · 128 misses');
	}
);

test('a column sum misses every load until a fully associative cache holds the column', async ({
	page
}) => {
	await page.goto('./cache-memory-hierarchy/#columns');
	await expect(stage(page)).toContainText('Sum it column by column');
	await expect(stage(page)).toContainText('256 misses (100 %)');
	await range(page, 'size').press('End');
	await expect(stage(page)).toContainText('1 KB');
	// still direct-mapped: the column's lines use only half the sets
	await expect(stage(page)).toContainText('256 misses (100 %)');
	await range(page, 'ways').press('End');
	await expect(stage(page)).toContainText('fully associative');
	await expect(stage(page)).toContainText('32 misses');
	await choose(page, 'order', 'row');
	await expect(stage(page)).toContainText('Sum a matrix row by row');
	await expect(stage(page)).toContainText('32 misses');
});

test('two arrays a cache size apart thrash a direct-mapped cache of any size; two ways cure it', async ({
	page
}) => {
	await page.goto('./cache-memory-hierarchy/#conflict');
	for (const key of ['Home', 'End']) {
		await range(page, 'csize').press(key);
		await expect(stage(page)).toContainText('64 misses (100 %)');
	}
	expect(await read(page, 'conflict')).toBeGreaterThan(0);
	await range(page, 'cways').press('ArrowRight');
	await expect(stage(page)).toContainText('2-way');
	await expect(stage(page)).toContainText('8 misses');
});

test('LRU misses every load of a loop one line too big; random replacement and a direct-mapped cache do not', async ({
	page
}) => {
	await page.goto('./cache-memory-hierarchy/#replacement');
	await expect(stage(page)).toContainText('36 of 36 accesses · 36 misses');
	await choose(page, 'policy', 'random');
	await expect(stage(page)).toContainText('RANDOM');
	expect(await read(page, '36 of 36 accesses ·')).toBeLessThan(20);
	await range(page, 'rways').press('Home');
	await expect(stage(page)).toContainText('direct-mapped');
	await expect(stage(page)).toContainText('36 of 36 accesses · 15 misses');
});

test('tiling the matrix product cuts the misses many times over, unless the tile is too big', async ({
	page
}) => {
	await page.goto('./cache-memory-hierarchy/#tiles');
	await expect(stage(page)).toContainText('tiles of 12');
	expect(await read(page, 'textbook order:')).toBeGreaterThan(250);
	expect(await read(page, 'tiles of 12:')).toBeGreaterThan(20);
	await range(page, 'block').press('End');
	await expect(stage(page)).toContainText('tiles of 60');
	expect(await read(page, 'tiles of 60:')).toBeLessThan(5);
});

test('summing by columns costs seven times summing by rows; the L2 helps none of the programs much', async ({
	page
}) => {
	await page.goto('./cache-memory-hierarchy/#bills');
	await expect(stage(page)).toContainText('35 cycles');
	await expect(stage(page)).toContainText('250 cycles');
	await expect(stage(page)).toContainText('239 cycles');
	await page.locator('input[data-control=withL2]').uncheck();
	await expect(stage(page)).toContainText('32 KB L1 only');
	await expect(stage(page)).toContainText('35 cycles');
	await expect(stage(page)).toContainText('249 cycles');
});

test('the latency curve breaks at the L1, and with an L2 the break to DRAM moves to its size', async ({
	page
}) => {
	await page.goto('./cache-memory-hierarchy/#knee');
	await expect(stage(page)).toContainText('every load from DRAM from 45.3 KB on');
	await page.locator('input[data-control=l2]').check();
	await expect(stage(page)).toContainText('every load from DRAM from 362 KB on');
	await range(page, 'l2size').press('End');
	await expect(stage(page)).toContainText('every load from DRAM from 2.83 MB on');
});

test('the lab runs the chosen program, plain or cache-friendly', async ({ page }) => {
	await page.goto('./cache-memory-hierarchy/#lab');
	await expect(stage(page)).toContainText('Multiply matrices');
	await range(page, 'ways').press('End');
	await expect(stage(page)).toContainText('fully associative');
	await expect(stage(page)).toContainText('1,088 of 1,088 accesses · 584 misses');
	await page.locator('input[data-control=friendly]').check();
	await expect(stage(page)).toContainText('Multiply matrices in tiles');
	await expect(stage(page)).toContainText('1,216 of 1,216 accesses · 72 misses');
	await choose(page, 'program', 'list');
	await expect(stage(page)).toContainText('Walk a list, nodes in order');
	await expect(stage(page)).toContainText('128 of 128 accesses · 32 misses');
});
