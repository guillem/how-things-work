import { expect, test, type Page } from '@playwright/test';

// The lac-operon explainer: what a visitor sees when they switch the sugars, slide the TMG,
// sweep it up and down (with and without glucose, and with lactose instead), and grow cultures
// of the wild type and the mutants on glucose and lactose. Reduced motion shows each scene's
// complete frame (the sweep and the culture run to the end). The model tests check the numbers.
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
	'lactose switches the operon on, and glucose keeps it off by blocking the permease',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./lac-operon/#operon');
		await expect(stage(page)).toContainText('medium: lactose only');
		// The output glides to its new value; wait for it.
		await expect(stage(page)).toContainText(/lac output: [5-9]\d % of full/);
		await expect(stage(page)).toContainText('LacI let go');
		const glucose = page.locator('input[type=checkbox][data-control=glc]');
		await glucose.focus();
		await page.keyboard.press('Space');
		await expect(stage(page)).toContainText('medium: glucose + lactose');
		await expect(stage(page)).toContainText('LacY blocked by EIIA-Glc');
		await expect(stage(page)).toContainText('LacI on the operator');
		await expect(stage(page)).toContainText(/lac output: [0-4]\.\d % of full/);
	}
);

test('between the thresholds production and loss balance twice; outside them once', async ({
	page
}) => {
	await page.goto('./lac-operon/#balance');
	await expect(stage(page)).toContainText('TMG 10 µM');
	await expect(stage(page)).toContainText('two stable states: off and on');
	await range(page, 'tmg').fill('2.5');
	await expect(stage(page)).toContainText('one stable state: on');
	await range(page, 'tmg').fill('-0.3');
	await expect(stage(page)).toContainText('one stable state: off');
});

test("a TMG sweep switches on near 30 µM and off near 3 µM, as Ozbudak's cells did", async ({
	page
}) => {
	await page.goto('./lac-operon/#hysteresis');
	await expect(stage(page)).toContainText('a loop: history decides');
	const on = await read(page, 'up: on at');
	const off = await read(page, 'down: off at');
	expect(on).toBeGreaterThan(20);
	expect(on).toBeLessThan(45);
	expect(off).toBeGreaterThan(2);
	expect(off).toBeLessThan(4.5);
});

test('glucose moves the loop to higher TMG; lactose leaves no loop', async ({ page }) => {
	await page.goto('./lac-operon/#glucose');
	await range(page, 'gluc').fill('1000');
	await expect(stage(page)).toContainText('glucose 1000 µM');
	expect(await read(page, 'up: on at')).toBeGreaterThan(500);
	expect(await read(page, 'down: off at')).toBeGreaterThan(50);
	await page.goto('./lac-operon/#lactose');
	await expect(stage(page)).toContainText('no loop: same path');
});

test('a culture on two sugars pauses; without the repressor it does not', async ({ page }) => {
	await page.goto('./lac-operon/#diauxie');
	await expect(stage(page)).toContainText('wild type');
	const minutes = await read(page, 'pause:');
	expect(minutes).toBeGreaterThan(20);
	expect(minutes).toBeLessThan(90);
	await page.goto('./lac-operon/#mutants');
	await page.locator('button[data-control=strain][data-value=uv5]').click();
	await expect(stage(page)).toContainText('lacL8UV5, blind to CAP-cAMP');
	expect(await read(page, 'pause:')).toBeGreaterThan(20);
	await page.locator('button[data-control=strain][data-value=lacI]').click();
	await expect(stage(page)).toContainText('no repressor');
	await expect(stage(page)).toContainText('no pause');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('the sweep and the pause are listed under the stage', async ({ page }) => {
		await page.goto('./lac-operon/#hysteresis');
		const panel = page.getByRole('group', { name: 'Readouts' });
		await expect(panel).toContainText(/Going up\s*switched on at \d+ µM/);
		await page.goto('./lac-operon/#diauxie');
		await expect(panel).toContainText(/Diauxic pause\s*\d+ min/);
	});
});
