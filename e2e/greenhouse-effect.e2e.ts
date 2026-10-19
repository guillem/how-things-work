import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test.describe('settled frames (reduced motion)', () => {
	test.use({ reducedMotion: 'reduce' });

	test('a bare planet balances at −18 °C; a brighter one settles colder', async ({ page }) => {
		await open(page, './greenhouse-effect/#glow');
		await expect(stage(page)).toContainText('255 K = −18 °C');
		await expect(stage(page)).toContainText('balanced: in = out');
		await range(page, 'albedo').fill('70');
		await expect(stage(page)).toContainText('settles at 206 K');
	});

	test('a layer absorbing 77% of the infrared gives 15 °C; even 100% only 30 °C', async ({
		page
	}) => {
		await open(page, './greenhouse-effect/#layer');
		await expect(stage(page)).toContainText('288 K = 15 °C');
		await expect(stage(page)).toContainText('balancing the 240 in');
		await range(page, 'absorb').fill('0');
		await expect(stage(page)).toContainText('255 K = −18 °C');
		await range(page, 'absorb').fill('100');
		await expect(stage(page)).toContainText('303 K = 30 °C');
	});

	test('doubled CO₂ warms 1.2 °C alone, and each feedback adds to it, up to 3 °C', async ({
		page
	}) => {
		await open(page, './greenhouse-effect/#co2');
		await expect(stage(page)).toContainText('doubled CO₂: +1.2 °C once settled');
		await expect(stage(page)).toContainText('in balance');
		await page.goto('./greenhouse-effect/#water');
		await expect(stage(page)).toContainText('doubled CO₂: +1.9 °C');
		await page.goto('./greenhouse-effect/#ice');
		await expect(stage(page)).toContainText('doubled CO₂: +2.3 °C');
		await page.goto('./greenhouse-effect/#sensitivity');
		await expect(stage(page)).toContainText('doubled CO₂: +3.0 °C');
		// Each doubling adds the same: four times the CO₂, twice the warming.
		await range(page, 'co2').fill('1120');
		await expect(stage(page)).toContainText('settles at +6.0 °C');
		await toggle(page, 'water').uncheck({ force: true });
		await expect(stage(page)).toContainText('water vapour off');
		await expect(stage(page)).toContainText('doubled CO₂: +1.5 °C');
		// Less CO₂ than before industry cools the planet.
		await range(page, 'co2').fill('180');
		await expect(stage(page)).toContainText('settles at −1.0 °C');
	});

	test('the model matches the warming measured to 2011–2020', async ({ page }) => {
		await open(page, './greenhouse-effect/#past');
		await expect(stage(page)).toContainText('2011–2020: model +1.09 °C · measured +1.09 °C');
	});

	test('the scenarios reach the IPCC’s warming for 2081–2100', async ({ page }) => {
		await open(page, './greenhouse-effect/#scenarios');
		await expect(stage(page)).toContainText('IPCC 2.7 °C · model 2.7');
		await page.locator('[data-control=scenario][data-value=ssp585]').click();
		await expect(stage(page)).toContainText('IPCC 4.4 °C · model 4.4');
		await expect(stage(page)).toContainText('SSP5-8.5 · 2100: 1135 ppm');
		await page.locator('[data-control=scenario][data-value=ssp119]').click();
		await expect(stage(page)).toContainText('IPCC 1.4 °C · model 1.3');
		// Without the water-vapour feedback, the same emissions warm far less.
		await toggle(page, 'water').uncheck({ force: true });
		await expect(stage(page)).toContainText('dashed: all feedbacks on');
		await expect(stage(page)).toContainText('IPCC 1.4 °C · model 0.8');
	});

	test('warming follows cumulative emissions', async ({ page }) => {
		await open(page, './greenhouse-effect/#budget');
		await expect(stage(page)).toContainText('IPCC: 0.45 °C per 1,000 Gt');
		await expect(stage(page)).toContainText('SSP2-4.5 · 2100: 5,069 Gt CO₂ emitted');
	});
});

test('with more CO₂ the planet warms until the flows balance again', async ({ page }) => {
	await page.clock.install();
	await open(page, './greenhouse-effect/#co2');
	await expect(stage(page)).toContainText('more in than out, warming');
	await playUntil(page, stage(page), 'in balance: in = out', 40_000);
	await expect(stage(page)).toContainText('+1.2 °C');
});
