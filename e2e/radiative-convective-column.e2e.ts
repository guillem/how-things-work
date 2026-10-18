// Browser tests of the radiative-convective-column page: the energy balance at the top; more
// absorber raises the emission level and warms the ground; convection removes the ground's
// jump and sets a tropopause; the stratosphere cools with twice the absorber only while the
// window is open; a doubled absorber first cuts the outgoing infrared, and the column ends back in
// balance, warmer. Reduced motion, keyboard controls.
import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
const toggle = (page: Page, id: string) =>
	page.locator(`input[type=checkbox][data-control="${id}"]`);
async function flip(page: Page, id: string) {
	await toggle(page, id).focus();
	await page.keyboard.press('Space');
}
async function key(page: Page, id: string, k: string) {
	await range(page, id).focus();
	await page.keyboard.press(k);
}

test.use({ reducedMotion: 'reduce' });

test(
	'the infrared leaving balances the sunlight; more absorber lifts the emission level',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./radiative-convective-column/#streams');
		await expect(stage(page)).toContainText('band 199 W/m² + window 39 W/m² = 238 W/m²');

		await page.goto('./radiative-convective-column/#emission');
		await expect(stage(page)).toContainText('ground 288.7 K');
		await expect(stage(page)).toContainText('5.0 km · 256 K');
		await key(page, 'tau', 'End');
		await expect(stage(page)).toContainText('ground 316.6 K');
		await expect(stage(page)).toContainText('10.3 km · 250 K');
	}
);

test('radiative equilibrium has a hot ground under unstable air; convection fixes it', async ({
	page
}) => {
	await page.goto('./radiative-convective-column/#unstable');
	await expect(stage(page)).toContainText('ground 314.9 K');
	await expect(stage(page)).toContainText('cool faster than 6.5 K/km');
	await expect(stage(page)).toContainText('16.3 K warmer than the air above it');

	await page.goto('./radiative-convective-column/#convection');
	await expect(stage(page)).toContainText('tropopause at 10.7 km');
	await expect(stage(page)).toContainText('ground 288.7 K · without convection 314.9 K');
	await flip(page, 'convection');
	await expect(stage(page)).toContainText('convection off: pure radiative equilibrium');
	await flip(page, 'convection');
	// a steeper lapse rate warms the ground
	await key(page, 'lapse', 'End');
	await expect(stage(page)).toContainText('ground 299.8 K');
});

test('with twice the absorber the stratosphere cools only when the window is open', async ({
	page
}) => {
	await page.goto('./radiative-convective-column/#stratosphere');
	await expect(stage(page)).toContainText('stratosphere (10 hPa) −2.5 K');
	await expect(stage(page)).toContainText('ground +15.6 K');
	await flip(page, 'window');
	await expect(toggle(page, 'window')).not.toBeChecked();
	await expect(stage(page)).toContainText('stratosphere (10 hPa) ±0.0 K');
	await expect(stage(page)).toContainText('closed: a fully grey gas');
});

test('a doubled absorber cuts the outgoing infrared, then the column warms back to balance', async ({
	page
}) => {
	await page.goto('./radiative-convective-column/#forcing');
	await expect(stage(page)).toContainText('infrared out now · 198 W/m²');
	await expect(stage(page)).toContainText('forcing 40 W/m²');

	// reduced motion shows the end of the run
	await page.goto('./radiative-convective-column/#response');
	await expect(stage(page)).toContainText('year 30');
	await expect(stage(page)).toContainText('infrared out 238 W/m²');
	await expect(stage(page)).toContainText('change at the ground +15.6 K');
});
