import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const button = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`);

// Reduced motion: no tweens, each step's finished picture.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'disconnecting the wire stops both halves of the cell',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './redox-batteries/#split');
		await expect(stage(page)).toContainText('running: the lamp is lit');
		await toggle(page, 'closed').focus();
		await page.keyboard.press('Space');
		await expect(toggle(page, 'closed')).not.toBeChecked();
		await expect(stage(page)).toContainText('wire disconnected: both halves stop');
	}
);

test('the higher rung is reduced, whichever electrode is picked first', async ({ page }) => {
	await open(page, './redox-batteries/#ladder');
	await expect(stage(page)).toContainText('1.104 V');
	await expect(stage(page)).toContainText('Cu²⁺ + 2e⁻ → Cu');
	// Swap the two: the same cell, the same voltage.
	await button(page, 'metalA', 'cu').click();
	await button(page, 'metalB', 'zn').click();
	await expect(stage(page)).toContainText('1.104 V');
	await expect(stage(page)).toContainText('Zn → Zn²⁺ + 2e⁻');
	// Lithium against gold: the widest step on the ladder.
	await button(page, 'metalA', 'li').click();
	await button(page, 'metalB', 'au').click();
	await expect(stage(page)).toContainText('4.560 V');
	// The same metal on both sides gives nothing.
	await button(page, 'metalA', 'au').click();
	await expect(stage(page)).toContainText('no step, 0 V');
});

test('Nernst: a thousandfold change in one concentration moves the voltage by 89 mV', async ({
	page
}) => {
	await open(page, './redox-batteries/#nernst');
	await expect(stage(page)).toContainText('1.104 V');
	await button(page, 'cu', '0.001').click();
	await expect(stage(page)).toContainText('1.015 V');
	await button(page, 'cu', '1').click();
	await button(page, 'zn', '0.001').click();
	await expect(stage(page)).toContainText('1.192 V');
});

test('a Daniell cell stays near 1.1 V until its copper ions run out', async ({ page }) => {
	await open(page, './redox-batteries/#rundown');
	await range(page, 'used').fill('50');
	await expect(stage(page)).toContainText('1.090 V');
	await expect(stage(page)).toContainText('charge passed: 2.68 Ah');
	await range(page, 'used').fill('100');
	await expect(stage(page)).toContainText('0.000 V');
	await expect(stage(page)).toContainText('charge passed: 5.36 Ah');
	await expect(stage(page)).toContainText('equilibrium');
});

test('the lithium-ion cell runs from 4.2 V full to 2.5 V empty', async ({ page }) => {
	await open(page, './redox-batteries/#curve');
	await expect(stage(page)).toContainText('4.19 V');
	await expect(stage(page)).toContainText('charge left: 5.00 of 5 Ah');
	await range(page, 'soc').fill('0');
	await expect(stage(page)).toContainText('2.50 V');
	// Faraday: 5 Ah is 0.187 mol of Li⁺, 1.29 g of lithium.
	await expect(stage(page)).toContainText('lithium moved into the oxide: 1.29 g');
});

test('a charger reverses both half-reactions; nothing connected stops them', async ({ page }) => {
	await open(page, './redox-batteries/#charge');
	await expect(stage(page)).toContainText('charging');
	await expect(stage(page)).toContainText('C₆ + Li⁺ + e⁻ → LiC₆');
	await button(page, 'mode', 'discharge').click();
	await expect(stage(page)).toContainText('LiC₆ → C₆ + Li⁺ + e⁻');
	await button(page, 'mode', 'open').click();
	await expect(stage(page)).toContainText('circuit open: ions and electrons both stop');
});

test('swapping electrodes changes the voltage and the energy per kilogram', async ({ page }) => {
	await open(page, './redox-batteries/#voltage');
	await expect(stage(page)).toContainText('3.69 V');
	await button(page, 'cathode', 'lfp').click();
	await expect(stage(page)).toContainText('3.19 V');
	await open(page, './redox-batteries/#capacity');
	await button(page, 'cathode', 'nmc').click();
	await expect(stage(page)).toContainText('423 Wh/kg');
	// Silicon holds ten times more per gram than graphite: a far lighter anode.
	await button(page, 'anode', 'silicon').click();
	await expect(stage(page)).toContainText('598 Wh/kg');
	await expect(stage(page)).toContainText('silicon: 0.29 g');
});
