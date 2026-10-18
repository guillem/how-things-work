import { expect, test, type Page } from '@playwright/test';

// The TCP congestion-control explainer: what a visitor sees when they resize the router's queue,
// change the increase rule, the round trips and connections of two users, the random loss, the
// number of senders and their backoff, and let a Reno flow join a Vegas one. Reduced motion
// shows each scene's complete run. The model tests check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
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

test(
	'a queue smaller than the path leaves the link idle after each halving',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./tcp-congestion-control/#sawtooth');
		await expect(stage(page)).toContainText('queue of 60 packets');
		expect(await read(page, 'mean')).toBeGreaterThan(11.9);
		await range(page, 'buffer').press('Home');
		await expect(stage(page)).toContainText('queue of 5 packets');
		expect(await read(page, 'mean')).toBeLessThan(10.5);
	}
);

test('a huge queue adds delay but no throughput', async ({ page }) => {
	await page.goto('./tcp-congestion-control/#bufferbloat');
	await expect(stage(page)).toContainText('100 % busy');
	const rtt60 = await read(page, '% busy,');
	await range(page, 'buffer').press('End');
	await expect(stage(page)).toContainText('queue of 400 packets');
	await expect(stage(page)).toContainText('100 % busy');
	expect(await read(page, '% busy,')).toBeGreaterThan(3 * rtt60);
});

test('AIMD flows end up with equal shares; MIMD flows keep their imbalance', async ({ page }) => {
	await page.goto('./tcp-congestion-control/#fairness');
	await expect(stage(page)).toContainText('t = 80 s');
	const aimd = await read(page, 'flow 1:');
	expect(aimd).toBeGreaterThan(40);
	expect(aimd).toBeLessThan(60);
	await page.locator('button[data-control=rule][data-value=mimd]').click();
	await expect(stage(page)).toContainText('MIMD');
	expect(await read(page, 'flow 1:')).toBeGreaterThan(70);
});

test('a longer round trip, or fewer connections, means a smaller share', async ({ page }) => {
	await page.goto('./tcp-congestion-control/#rtt');
	await expect(stage(page)).toContainText('user B: 1 connection, 60 ms');
	await range(page, 'rtt2').fill('150');
	await expect(stage(page)).toContainText('user B: 1 connection, 150 ms');
	expect(await read(page, 'share of user B:')).toBeLessThan(35);
	await range(page, 'rtt2').fill('60');
	await range(page, 'n2').fill('4');
	await expect(stage(page)).toContainText('user B: 4 connections, 60 ms');
	expect(await read(page, 'share of user B:')).toBeGreaterThan(70);
});

test('throughput over a lossy link follows the Mathis formula', async ({ page }) => {
	await page.goto('./tcp-congestion-control/#mathis');
	for (const key of ['Home', 'End']) {
		await range(page, 'loss').press(key);
		await expect(stage(page)).toContainText(key === 'Home' ? 'losing 0.05 %' : 'losing 2 %');
		const ratio = (await read(page, 'simulated')) / (await read(page, 'formula'));
		expect(ratio).toBeGreaterThan(0.95);
		expect(ratio).toBeLessThan(1.25);
	}
});

test('without congestion control the link fills with copies; with it, with new data', async ({
	page
}) => {
	await page.goto('./tcp-congestion-control/#collapse');
	await expect(stage(page)).toContainText('congestion control off');
	await range(page, 'senders').press('End');
	await expect(stage(page)).toContainText('96 senders');
	expect(await read(page, 'copies')).toBeGreaterThan(50);
	const toggle = page.locator('input[type=checkbox][data-control=backoff]');
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(stage(page)).toContainText('congestion control on');
	expect(await read(page, 'new data')).toBeGreaterThan(90);
});

test('alone, Vegas fills the link; next to Reno, it yields', async ({ page }) => {
	await page.goto('./tcp-congestion-control/#compare');
	const text = async () => (await stage(page).textContent()) ?? '';
	await expect(stage(page)).toContainText('t = 90 s');
	const alone = /Vegas.*?([\d.]+) Mbit\/s/.exec(await text());
	expect(Number(alone?.[1])).toBeGreaterThan(23.5);
	const toggle = page.locator('input[type=checkbox][data-control=rival]');
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(stage(page)).toContainText('a Reno flow joins at 30 s');
	const vs = /Vegas.*?([\d.]+) Mbit\/s\s*Reno ([\d.]+)/.exec(await text());
	expect(Number(vs?.[1])).toBeLessThan(0.3 * Number(vs?.[2]));
});
