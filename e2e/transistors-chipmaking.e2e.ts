import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'raising the gate voltage forms a channel and switches the transistor on',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./transistors-chipmaking/#mosfet');
		await expect(stage(page)).toContainText('OFF: no channel, no current');
		await expect(stage(page)).toContainText('electrons in the channel: practically none');
		await slider(page, 'vg').fill('1.8');
		await expect(stage(page)).toContainText('ON: a channel of electrons joins source and drain');
		await expect(stage(page)).toContainText('drain current: 654 µA');
		await expect(page).toHaveURL(/#mosfet$/);
	}
);

test('the transfer curve: dragging the dot to the end gives the full current', async ({ page }) => {
	await page.goto('./transistors-chipmaking/#threshold');
	const handle = stage(page).getByRole('slider', { name: 'Gate voltage' });
	await handle.press('End');
	await expect(stage(page)).toContainText('1.80 V → 654 µA');
	await handle.press('Home');
	await expect(stage(page)).toContainText('0.00 V → 5.84 pA');
	await page.getByRole('switch', { name: 'Logarithmic current scale' }).check({ force: true });
	await expect(stage(page)).toContainText('89 mV');
});

test('the pMOS conducts when its gate is low', async ({ page }) => {
	await page.goto('./transistors-chipmaking/#pmos');
	await expect(stage(page)).toContainText('OFF: no channel');
	await slider(page, 'vgp').fill('0');
	await expect(stage(page)).toContainText('ON: a channel of holes');
});

test('the CMOS inverter flips its output and draws current only mid-switch', async ({ page }) => {
	await page.goto('./transistors-chipmaking/#inverter');
	await expect(stage(page)).toContainText('output 1.80 V');
	await expect(stage(page)).toContainText('supply → ground: 5.84 pA');
	await slider(page, 'vin').fill('0.9');
	await expect(stage(page)).toContainText('output 0.90 V');
	await expect(stage(page)).toContainText('both transistors partly on');
	await slider(page, 'vin').fill('1.8');
	await expect(stage(page)).toContainText('output 0.00 V');
	await expect(stage(page)).toContainText('one transistor is off');
});

test('the NAND gate goes low only when both inputs are 1', async ({ page }) => {
	await page.goto('./transistors-chipmaking/#nand');
	await expect(stage(page)).toContainText('output connected to the supply');
	await page.getByRole('switch', { name: 'Input B' }).check({ force: true });
	await expect(stage(page)).toContainText('output connected to ground');
	await expect(stage(page)).toContainText('output 0.00 V');
});

test('zooming goes from a wafer of chips down to one transistor', async ({ page }) => {
	await page.goto('./transistors-chipmaking/#wafer');
	await expect(stage(page)).toContainText('509 whole chips');
	await expect(stage(page)).toContainText('100 mm');
	await slider(page, 'zoom').fill('4');
	await expect(stage(page)).toContainText('one transistor: a gate crossing two fins');
	await expect(stage(page)).toContainText('50 nm');
});

test('the fabrication steps end with a stencil, a gate, and a finished transistor', async ({
	page
}) => {
	await page.goto('./transistors-chipmaking/#litho');
	await expect(stage(page)).toContainText('Develop: the exposed resist dissolves');
	await page.goto('./transistors-chipmaking/#etch');
	await expect(stage(page)).toContainText('Strip: the resist is removed');
	await page.goto('./transistors-chipmaking/#dope');
	await expect(stage(page)).toContainText('A finished nMOS transistor');
});

test('lines narrower than k₁ ≈ 0.25 leave no image; EUV prints far smaller', async ({ page }) => {
	await page.goto('./transistors-chipmaking/#resolution');
	await expect(stage(page)).toContainText('= 0.400 × 193 nm / 1.35 = 57 nm');
	await expect(stage(page)).toContainText('a sharp image');
	await slider(page, 'k1').fill('0.24');
	await expect(stage(page)).toContainText('image contrast 0 %');
	await expect(stage(page)).toContainText('no usable image');
	await page.locator('button[data-control=tool][data-value=euv]').click();
	await expect(stage(page)).toContainText('= 0.240 × 13.5 nm / 0.33 = 9.8 nm');
});

test('transistor counts double every two years', async ({ page }) => {
	await page.goto('./transistors-chipmaking/#moore');
	await expect(stage(page)).toContainText('doubles every 2.0 years');
	await expect(stage(page)).toContainText('largest by 2022: 58 billion transistors');
	await slider(page, 'year').fill('1990');
	await expect(stage(page)).toContainText('largest by 1990: 1.2 million transistors');
});
