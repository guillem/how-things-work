import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** Turns a switch on (clicking it only if it is off). */
async function switchOn(page: Page, label: string) {
	const sw = page.getByRole('switch', { name: `Switch ${label}` });
	if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
	await expect(sw).toHaveAttribute('aria-checked', 'true');
}

test('turning both inputs of an AND gate on lights the lamp', async ({ page }) => {
	await page.goto('./logic-gates/#gates');
	await expect(stage(page)).toContainText('Out = A AND B');
	await switchOn(page, 'A');
	await switchOn(page, 'B');
	await expect(page.getByRole('img', { name: 'Lamp Out: on' })).toBeVisible();
	await expect(stage(page)).toContainText('Out = 1');
});

test('the 4-bit adder adds 11 + 6 = 17', async ({ page }) => {
	await page.goto('./logic-gates/#four');
	await expect(stage(page)).toContainText('11 + 6 = 17');
	await expect(stage(page)).toContainText('1011 + 0110 = 10001 in binary');
});

test('the half adder shows no sum until the signals have settled', async ({ page }) => {
	await page.clock.install();
	await page.goto('./logic-gates/#half');
	await expect(page.getByRole('switch', { name: 'Switch A' })).toBeAttached();
	// Stop the clock: from here the animation moves only with runFor.
	await page.clock.pauseAt(Date.now() + 1000);
	await page.getByRole('switch', { name: 'Switch A' }).click();
	// The switch changes at once; the old carry and sum would read 1 + 0 = 00.
	await expect(stage(page)).toContainText('1 + 0 = … in binary');
	await expect(stage(page)).not.toContainText('1 + 0 = 00');
	await playUntil(page, stage(page), '1 + 0 = 01 in binary', 3000);
	await expect(stage(page)).toContainText('carry 0, sum 1: 1 in decimal');
});

test('switching the challenge clears a canvas message', async ({ page }) => {
	// Under reduced motion a message stays until something clears it (it would
	// otherwise fade on its own a few seconds later and pass without the fix).
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./logic-gates/#build');
	await expect(page.getByRole('switch', { name: 'Switch A' })).toBeAttached();
	// Click empty canvas near switch A: too close to it to add a gate.
	const box = await page.locator('.stage svg').boundingBox();
	if (!box) throw new Error('stage not drawn');
	await page.mouse.click(box.x + (130 / 960) * box.width, box.y + (210 / 600) * box.height);
	await expect(stage(page)).toContainText('Too close to another part');
	await page.locator('button[data-control=challenge][data-value=half]').click();
	await expect(stage(page)).toContainText('Sum = 0');
	await expect(stage(page)).not.toContainText('Too close to another part');
});

/** Clicks the build canvas at a point given in stage units (the stage is 960 × 600). */
async function clickStage(page: Page, x: number, y: number) {
	const box = await page.locator('.stage svg').boundingBox();
	if (!box) throw new Error('stage not drawn');
	await page.mouse.click(box.x + (x / 960) * box.width, box.y + (y / 600) * box.height);
}

/** Wires one port to another with the keyboard (Enter on each), by their names. */
async function wirePorts(page: Page, from: string, fromNth: number, to: string, toNth = 0) {
	await page
		.getByRole('button', { name: new RegExp(`^${from}:`) })
		.nth(fromNth)
		.press('Enter');
	await page
		.getByRole('button', { name: new RegExp(`^${to}:`) })
		.nth(toNth)
		.press('Enter');
}

/** Wires an output port to an input port with the keyboard (Enter on each). */
const wire = (page: Page, from: string, fromNth: number, to: string, toNth = 0) =>
	wirePorts(page, `Output of ${from}`, fromNth, to, toNth);

/**
 * Builds a full adder on a canvas with switches A, B, Carry in and lamps Sum,
 * Carry out, picking gates with the `tool` control (all but the carry-out wire
 * when `lastWire` is false).
 */
async function buildFullAdder(page: Page, tool: string, lastWire = true) {
	const add = async (kind: string, x: number, y: number) => {
		await page.locator(`button[data-control=${tool}][data-value=${kind}]`).click();
		await clickStage(page, x, y);
	};
	await add('XOR', 200, 190);
	await add('AND', 200, 340);
	await add('XOR', 360, 230);
	await add('AND', 360, 400);
	await add('OR', 480, 370);
	await expect(page.getByRole('button', { name: /^OR gate/ })).toHaveCount(1);
	// first half adder
	await wire(page, 'switch A', 0, 'Input 1 of XOR gate', 0);
	await wire(page, 'switch B', 0, 'Input 2 of XOR gate', 0);
	await wire(page, 'switch A', 0, 'Input 1 of AND gate', 0);
	await wire(page, 'switch B', 0, 'Input 2 of AND gate', 0);
	// second half adder: (A XOR B) with the carry in
	await wire(page, 'XOR gate', 0, 'Input 1 of XOR gate', 1);
	await wire(page, 'switch Carry in', 0, 'Input 2 of XOR gate', 1);
	await wire(page, 'XOR gate', 0, 'Input 1 of AND gate', 1);
	await wire(page, 'switch Carry in', 0, 'Input 2 of AND gate', 1);
	// either carry, and the outputs
	await wire(page, 'AND gate', 0, 'Input 1 of OR gate');
	await wire(page, 'AND gate', 1, 'Input 2 of OR gate');
	await wire(page, 'XOR gate', 1, 'Input of lamp Sum');
	if (lastWire) await wire(page, 'OR gate', 0, 'Input of lamp Carry out');
}

test('a visitor can build a full adder, and the table checks every row', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./logic-gates/#build');
	await page.locator('button[data-control=challenge][data-value=full]').click();
	await expect(page.getByRole('switch', { name: 'Switch Carry in' })).toBeAttached();
	await buildFullAdder(page, 'tool', false);
	await expect(stage(page)).toContainText('Goal: make your columns match the target');
	await expect(stage(page)).not.toContainText('✓ Right');
	await wire(page, 'OR gate', 0, 'Input of lamp Carry out');
	await expect(stage(page)).toContainText('✓ Right: that is a full adder!');
});

test('the 4-bit build only packs a full adder that is right', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./logic-gates/#adder4');
	await expect(page.getByRole('switch', { name: 'Switch Carry in' })).toBeAttached();
	// no block to place yet
	await page.locator('button[data-control=tool4][data-value=FA]').click();
	await clickStage(page, 360, 250);
	await expect(stage(page)).toContainText('Build a full adder first');
	await expect(page.getByRole('button', { name: /^Full adder block/ })).toHaveCount(0);
	// a half-built one isn't packed
	await buildFullAdder(page, 'tool4', false);
	await page.locator('button[data-control=packBlock]').click();
	await expect(stage(page)).toContainText('Not a full adder yet');
	await expect(page.getByRole('switch', { name: 'Switch A₀' })).toHaveCount(0);
	await wire(page, 'OR gate', 0, 'Input of lamp Carry out');
	await page.locator('button[data-control=packBlock]').click();
	await expect(page.getByRole('switch', { name: 'Switch A₀' })).toBeAttached();
	await expect(stage(page)).toContainText('Your full adder is now a block');
});

test('four of the visitor’s full-adder blocks, chained, add all 512 inputs', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	// the full adder built on the build step carries over to the 4-bit build
	await page.goto('./logic-gates/#build');
	await page.locator('button[data-control=challenge][data-value=full]').click();
	await expect(page.getByRole('switch', { name: 'Switch Carry in' })).toBeAttached();
	await buildFullAdder(page, 'tool');
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page.locator('aside h2')).toHaveText('Build a 4-bit adder');
	await expect(stage(page)).toContainText('✓ Right: that is a full adder!');
	await page.locator('button[data-control=packBlock]').click();
	// the switches start on 11 + 6; with nothing wired the lamps read 0
	await expect(stage(page)).toContainText('11 + 6 + 0 = 17');
	await expect(stage(page)).toContainText('1 of 512 right');
	// one block in each bit's row (the dashed outlines)
	for (const y of [90, 230, 350, 470]) await clickStage(page, 360, y);
	await expect(page.getByRole('button', { name: /^Full adder block/ })).toHaveCount(4);
	const sub = '₀₁₂₃';
	for (let i = 0; i < 4; i++) {
		await wire(page, `switch A${sub[i]}`, 0, 'Input A of full adder block', i);
		await wire(page, `switch B${sub[i]}`, 0, 'Input B of full adder block', i);
		await wirePorts(page, 'Sum of full adder block', i, `Input of lamp S${sub[i]}`);
	}
	await wire(page, 'switch Carry in', 0, 'Carry in of full adder block', 0);
	await wirePorts(page, 'Carry out of full adder block', 0, 'Carry in of full adder block', 1);
	await wirePorts(page, 'Carry out of full adder block', 2, 'Carry in of full adder block', 3);
	await wirePorts(page, 'Carry out of full adder block', 3, 'Input of lamp Carry out');
	// the carry out of bit 1 goes nowhere: 11 + 6 loses it and comes out 13
	await expect(stage(page)).toContainText('the lamps read 01101 = 13 ✗');
	await expect(stage(page)).not.toContainText('All 512 right');
	await wirePorts(page, 'Carry out of full adder block', 1, 'Carry in of full adder block', 2);
	await expect(stage(page)).toContainText('✓ All 512 right');
	await expect(stage(page)).toContainText('the lamps read 10001 = 17 ✓');
	await expect(page.getByRole('img', { name: 'Lamp Carry out: on' })).toBeVisible();
	// any other sum: 11 + 7 = 18
	await page.getByRole('switch', { name: 'Switch B₀' }).click();
	await expect(stage(page)).toContainText('the lamps read 10010 = 18 ✓');
});

test('the 4-bit adder only adds right once the reader connects every carry', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./logic-gates/#four');
	await page.locator('button[data-control=carryLinks][data-value=build]').click();
	// with no carry wires the carry out of bit 1 is lost: 11 + 6 comes out 13
	await expect(stage(page)).toContainText('11 + 6 = 13');
	await expect(stage(page)).not.toContainText('✓');
	for (const k of [1, 2, 3])
		await page.getByRole('switch', { name: `Carry wire from bit ${k} to bit ${k + 1}` }).click();
	await expect(stage(page)).toContainText('11 + 6 = 17');
	await expect(stage(page)).toContainText('✓ Right: it adds all 256 pairs');
});
