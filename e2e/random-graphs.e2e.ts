import { expect, test, type Page } from '@playwright/test';

// The random-graphs explainer: what a visitor sees when they raise the average degree of the
// drawn graph, solve the giant's equation, explore from a node, sweep graphs of several sizes and
// open bonds on a grid. Reduced motion shows each scene complete. The model tests check the
// numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const control = (page: Page, id: string) => page.locator(`[data-control=${id}]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`);
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.,]+)`).exec(text);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1].replace(/,/g, ''));
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'raising the average degree past 1 turns dust into a giant component',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./random-graphs/#merge');
		await expect(stage(page)).toContainText('200 nodes · c = 0.50');
		expect(await read(page, 'largest piece:')).toBeLessThan(15);
		await control(page, 'c').fill('2');
		await expect(stage(page)).toContainText('c = 2.00');
		expect(await read(page, 'largest piece:')).toBeGreaterThan(60);
		await control(page, 'c').press('End');
		await expect(stage(page)).toContainText('c = 4.00');
		expect(await read(page, 'largest piece:')).toBeGreaterThan(90);
	}
);

test('more nodes: the drawn graph and its count of links follow', async ({ page }) => {
	await page.goto('./random-graphs/#gnp');
	await option(page, 'nodes', '500').click();
	await expect(stage(page)).toContainText('500 nodes');
	await control(page, 'c').press('Home');
	await expect(stage(page)).toContainText('0 links');
	await expect(stage(page)).toContainText('500 pieces');
	expect(await read(page, 'largest:')).toBe(1);
});

test('S = 1 − e^(−cS) has a second solution only above c = 1', async ({ page }) => {
	await page.goto('./random-graphs/#equation');
	await expect(stage(page)).toContainText('a second crossing at S = 0.583');
	await control(page, 'cb').fill('2');
	await expect(stage(page)).toContainText('a second crossing at S = 0.797');
	await control(page, 'cb').fill('1');
	await expect(stage(page)).toContainText('the curve stays under the line; only S = 0');
});

test('a search from one node runs into the giant, or stops early in a small piece', async ({
	page
}) => {
	await page.goto('./random-graphs/#explore');
	await expect(stage(page)).toContainText(': the largest component');
	await control(page, 'start').click();
	await expect(stage(page)).toContainText('stopped after');
	await control(page, 'cb').fill('0.5');
	await expect(stage(page)).toContainText('no giant below c = 1');
});

test('the sweep: small graphs are rounded, big ones close in on the exact curve', async ({
	page
}) => {
	await page.goto('./random-graphs/#knee');
	await expect(stage(page)).toContainText('Largest piece’s share against c · 50 nodes');
	// at c = 1 the largest piece is a quarter of 50 nodes, a few per cent of 20,000
	await expect(stage(page)).toContainText('26 %');
	await option(page, 'n', '20000').click();
	await expect(stage(page)).toContainText('20,000 nodes');
	await page.goto('./random-graphs/#sweep');
	await expect(stage(page)).toContainText('c = 4.00: 98 %');
	await expect(stage(page)).toContainText('exact large-n: 98 %');
});

test('a grid spans top to bottom only with enough open bonds, and then its dual cannot', async ({
	page
}) => {
	await page.goto('./random-graphs/#lattice');
	await control(page, 'p').fill('0.3');
	await expect(stage(page)).toContainText('no spanning cluster');
	await control(page, 'p').fill('0.7');
	await expect(stage(page)).toContainText('a spanning cluster');
	await page.goto('./random-graphs/#dual');
	await control(page, 'p').fill('0.7');
	await expect(stage(page)).toContainText('the dual is blocked: the grid crosses top to bottom');
	await control(page, 'p').fill('0.3');
	await expect(stage(page)).toContainText('the dual crosses left to right: the grid cannot');
});
