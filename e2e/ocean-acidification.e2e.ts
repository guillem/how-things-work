// Browser tests of the ocean-acidification page: the CO₂ slider drives Henry's law and the
// carbonate ion's loss; seawater stays basic at the slider's top; cold water reaches aragonite
// undersaturation at far lower CO₂ than warm water; the draggable marker on the chart moves the
// slider; the Revelle factor rises with CO₂. Reduced motion, keyboard controls.
import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
async function key(page: Page, id: string, k: string) {
	await range(page, id).focus();
	await page.keyboard.press(k);
}

test.use({ reducedMotion: 'reduce' });

test(
	'more CO₂ in the air: more dissolved CO₂, less carbonate ion',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./ocean-acidification/#dissolve');
		await expect(stage(page)).toContainText('air · 423 ppm CO₂');
		await expect(stage(page)).toContainText('→ 14.2 µmol of CO₂ per kg of water');
		await key(page, 'co2', 'End');
		await expect(stage(page)).toContainText('air · 1,200 ppm CO₂');
		await expect(stage(page)).toContainText('→ 40.2 µmol of CO₂ per kg of water');
		// colder water dissolves more
		await key(page, 'temp', 'Home');
		await expect(stage(page)).toContainText('→ 80.2 µmol of CO₂ per kg of water');

		// the next step keeps the reader's air and water: carbonate ion down by almost three quarters
		await page.goto('./ocean-acidification/#react');
		await expect(stage(page)).toContainText('−72% since 280 ppm');
		await key(page, 'co2', 'Home');
		await expect(stage(page)).toContainText('since 280 ppm: HCO₃⁻ +0, CO₃²⁻ +0 µmol/kg');
	}
);

test('even at 1,200 ppm the water stays basic', async ({ page }) => {
	await page.goto('./ocean-acidification/#not-acid');
	await expect(stage(page)).toContainText('pH 8.03');
	await key(page, 'co2', 'End');
	await key(page, 'temp', 'Home');
	await expect(stage(page)).toContainText('pH 7.58');
	await expect(stage(page)).toContainText('pH stays above 7 throughout');
	await expect(stage(page)).toContainText(
		'pH −0.59 units (hydrogen ions +289%); carbonate ion −72%'
	);
});

test('cold water reaches aragonite undersaturation first', async ({ page }) => {
	await page.goto('./ocean-acidification/#cold');
	await expect(stage(page)).toContainText('aragonite Ω = 1 at 1,431 ppm');
	await key(page, 'temp', 'Home');
	await expect(stage(page)).toContainText('aragonite Ω = 1 at 536 ppm');
	await key(page, 'temp', 'End');
	await expect(stage(page)).toContainText('aragonite Ω = 1 at 2,602 ppm');
});

test('the marker on the chart moves the CO₂ slider', async ({ page }) => {
	await page.goto('./ocean-acidification/#saturation');
	await expect(stage(page)).toContainText('Ω aragonite 2.61');
	const handle = page.locator('.stage [role=slider]');
	await handle.focus();
	await page.keyboard.press('End');
	await expect(range(page, 'co2')).toHaveValue('1200');
	await expect(stage(page)).toContainText('Ω aragonite 1.16');
	await page.keyboard.press('ArrowLeft');
	await expect(range(page, 'co2')).toHaveValue('1195');
});

test('the Revelle factor rises as the water fills', async ({ page }) => {
	await page.goto('./ocean-acidification/#revelle');
	await expect(stage(page)).toContainText('Revelle factor 11.0');
	await key(page, 'co2', 'Home');
	await expect(stage(page)).toContainText('Revelle factor 9.4');
	await key(page, 'co2', 'End');
	await expect(stage(page)).toContainText('Revelle factor 16.6');
});
