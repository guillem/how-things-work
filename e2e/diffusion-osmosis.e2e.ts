import { expect, test, type Page } from '@playwright/test';

// The diffusion and osmosis explainer: what a visitor sees when they warm the dye, count the
// crossings, change the sugar on each side of the membrane, press on the sugary side, put the
// cells in different solutions and switch the pump off. Reduced motion shows each scene's
// settled frame. The model tests check the numbers themselves.
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

test('warmer water spreads the dye faster, and distance costs time as its square', async ({
	page
}) => {
	await page.goto('./diffusion-osmosis/#warmer');
	await expect(stage(page)).toContainText('time to spread by diffusion, at 20 °C:');
	await expect(stage(page)).toContainText('22 min');
	await range(page, 'temp').fill('80');
	await expect(stage(page)).toContainText('at 80 °C:');
	await expect(stage(page)).toContainText('7 min');
	await page.goto('./diffusion-osmosis/#drop');
	await range(page, 'temp').fill('0');
	await expect(stage(page)).toContainText('water at 0 °C');
	expect(await read(page, 'D =')).toBeLessThan(0.00025);
});

test('the net flow is the difference of the two crossing counts', async ({ page }) => {
	await page.goto('./diffusion-osmosis/#counting');
	const right = await read(page, 'crossed the line → :');
	const left = await read(page, 'crossed the line ← :');
	expect(left).toBeGreaterThan(0);
	expect(right).toBeGreaterThan(left);
	expect(await read(page, 'net flow to the right:')).toBe(right - left);
});

test(
	'water climbs on the sugary side, and a piston stops and reverses it',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./diffusion-osmosis/#membrane');
		await expect(stage(page)).toContainText('left level is');
		expect(await read(page, 'left level is')).toBeGreaterThan(15);
		await range(page, 'sugarR').fill('1');
		await expect(stage(page)).toContainText('both levels are the same');
		await page.goto('./diffusion-osmosis/#push');
		await range(page, 'press').fill('4');
		// settled: the piston has squeezed water out of the sugar water, until the pushes balance
		await expect(stage(page)).toContainText('right level is');
		await expect(stage(page)).toContainText('balanced: no flow');
	}
);

test('a red blood cell holds in saline, bursts in pure water and shrinks in salty water', async ({
	page
}) => {
	await page.goto('./diffusion-osmosis/#blood-cell');
	await expect(stage(page)).toContainText('red blood cell: holds its shape');
	await range(page, 'salt').fill('0');
	await expect(stage(page)).toContainText('swells into a ball and bursts');
	await range(page, 'salt').fill('3');
	await expect(stage(page)).toContainText('shrinks and crinkles');
});

test('a potato cell firms up in pure water and pulls away from its wall in strong sugar', async ({
	page
}) => {
	await page.goto('./diffusion-osmosis/#potato');
	await expect(stage(page)).toContainText('potato cell: firm');
	await expect(stage(page)).toContainText('+11 %');
	await range(page, 'sucrose').fill('1');
	await expect(stage(page)).toContainText('pulls away from the wall');
});

test('the pump crowds the inside while it runs; switched off, nothing piles up', async ({
	page
}) => {
	await page.goto('./diffusion-osmosis/#pump');
	await expect(stage(page)).toContainText('times as crowded');
	expect(await read(page, 'inside is')).toBeGreaterThan(3);
	const toggle = page.locator('input[type=checkbox][data-control=pump]');
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(toggle).not.toBeChecked();
	await expect(stage(page)).toContainText('pump off');
	await expect(stage(page)).toContainText('pumped in so far: 0');
});
