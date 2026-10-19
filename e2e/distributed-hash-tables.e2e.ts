import { expect, test, type Page } from '@playwright/test';

// The distributed-hash-tables explainer: what a visitor sees when a server joins under each
// rule, when servers get virtual nodes, when a lookup walks successors or jumps along fingers,
// when the network grows to 16,384 nodes, and when churn meets longer successor lists and more
// copies. Reduced motion shows each run finished. The model tests check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
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
	'a server joining the ring moves only its share of the keys; hash mod N moves most of them',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./distributed-hash-tables/#join');
		await expect(stage(page)).toContainText('consistent hashing · 6 servers');
		await toggle(page, 'add').check();
		await expect(stage(page)).toContainText('G joins');
		const ring = await read(page, 'G joins:');
		expect(ring).toBeLessThan(30);
		await expect(stage(page)).toContainText('all of them to G');
		await choose(page, 'rule', 'modulo');
		await expect(stage(page)).toContainText('hash mod 7');
		const modulo = await read(page, 'G joins:');
		expect(modulo).toBeGreaterThan(40);
		expect(modulo).toBeGreaterThan(2 * ring);
	}
);

test('virtual nodes bring the busiest server close to its fair share', async ({ page }) => {
	await page.goto('./distributed-hash-tables/#vnodes');
	await expect(stage(page)).toContainText('one point each');
	expect(await read(page, 'busiest server')).toBeGreaterThan(1.5);
	await range(page, 'vnodes').press('End');
	await expect(stage(page)).toContainText('128 virtual nodes each');
	expect(await read(page, 'busiest server')).toBeLessThan(1.3);
});

test('with fingers a lookup among 64 nodes takes a few hops; along successors, dozens', async ({
	page
}) => {
	await page.goto('./distributed-hash-tables/#walk');
	await range(page, 'nodes').press('End');
	await expect(stage(page)).toContainText('64 nodes · each knows only its successor');
	await expect(stage(page)).toContainText('answers');
	const walkHops = Number(/(\d+) hops: node/.exec((await stage(page).textContent()) ?? '')?.[1]);
	expect(walkHops).toBeGreaterThan(10);
	await page.goto('./distributed-hash-tables/#fingers');
	await range(page, 'nodes').press('End');
	await expect(stage(page)).toContainText('64 nodes · each knows its fingers');
	await expect(stage(page)).toContainText('finger table of node');
	const fingerHops = Number(/(\d+) hops?: node/.exec((await stage(page).textContent()) ?? '')?.[1]);
	expect(fingerHops).toBeGreaterThan(0);
	expect(fingerHops).toBeLessThanOrEqual(6);
});

test('16,384 nodes find any key in about 7 hops, 99 % within a dozen', async ({ page }) => {
	await page.goto('./distributed-hash-tables/#scale');
	await range(page, 'size').press('End');
	await expect(stage(page)).toContainText('16,384 nodes: mean');
	const mean = await read(page, '16,384 nodes: mean');
	expect(mean).toBeGreaterThan(6);
	expect(mean).toBeLessThan(8);
	expect(await read(page, '99 % within')).toBeLessThanOrEqual(12);
});

test('longer successor lists keep the ring whole; more copies keep the keys', async ({ page }) => {
	await page.goto('./distributed-hash-tables/#heal');
	await expect(stage(page)).toContainText('round 12 of 12');
	expect(await read(page, 'the ring broke in')).toBe(12);
	await range(page, 'successors').press('End');
	await expect(stage(page)).toContainText('successor lists of 4');
	expect(await read(page, 'the ring broke in')).toBe(0);

	await page.goto('./distributed-hash-tables/#replicas');
	await expect(stage(page)).toContainText('1 copy of each key');
	expect(await read(page, 'keys lost:')).toBeGreaterThan(40);
	await range(page, 'copies').press('End');
	await expect(stage(page)).toContainText('4 copies of each key');
	expect(await read(page, 'keys lost:')).toBeLessThanOrEqual(2);
});
