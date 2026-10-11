import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string, text: string) {
	// Reduced motion freezes the scenes on one complete frame.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('pigments: the wavelength slider moves the readout and the absorption', async ({ page }) => {
	await open(page, './photosynthesis/#pigments', '550 nm · green · 2.25 eV per photon');
	await expect(stage(page)).toContainText('10% absorbed by the extract');
	await expect(stage(page)).toContainText('even a real leaf (~¾ absorbed)');
	await range(page, 'wavelength').fill('430');
	await expect(stage(page)).toContainText('430 nm · violet · 2.88 eV per photon');
	await expect(stage(page)).toContainText('100% absorbed');
	await expect(stage(page)).toContainText('10 of 10 absorbed');
	await expect(stage(page)).toContainText(
		'Violet light is strongly absorbed, mainly by chlorophyll a and the carotenoids.'
	);
	await range(page, 'wavelength').fill('680');
	await expect(stage(page)).toContainText('680 nm · red · 1.82 eV per photon');
	await expect(stage(page)).toContainText('53% absorbed');
	await expect(stage(page)).toContainText('At 680 nm about half of the light is absorbed');
});

test('pigments: arrow keys on the slider change the wavelength, not the step', async ({ page }) => {
	await open(page, './photosynthesis/#pigments', '550 nm');
	await range(page, 'wavelength').focus();
	await page.keyboard.press('ArrowRight');
	await expect(range(page, 'wavelength')).toHaveValue('555');
	await expect(stage(page)).toContainText('555 nm ·');
	await expect(page).toHaveURL(/#pigments$/);
});

test('water: with no light the lumen loses its acidity, and the light level carries over', async ({
	page
}) => {
	await open(page, './photosynthesis/#water', 'thylakoid lumen · pH ≈ 6.2');
	await range(page, 'light').fill('0');
	await expect(stage(page)).toContainText('thylakoid lumen · pH ≈ 8.0');
	// The next step shares the light slider and keeps its value...
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#etc$/);
	await expect(range(page, 'light')).toHaveValue('0');
	await expect(stage(page)).toContainText('thylakoid lumen · pH ≈ 8.0');
	// ...and so does this one on the way back.
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(page).toHaveURL(/#water$/);
	await expect(range(page, 'light')).toHaveValue('0');
	await expect(stage(page)).toContainText('thylakoid lumen · pH ≈ 8.0');
});

test('rubisco: switching off "Count the carbons" labels molecules with carbon counts', async ({
	page
}) => {
	await open(page, './photosynthesis/#rubisco', 'Carbon bookkeeping');
	const label = stage(page).getByText('5C', { exact: true });
	await expect(label).toHaveCount(0);
	await page.locator('input[type=checkbox][data-control=carbons]').uncheck({ force: true });
	await expect(label.first()).toBeAttached();
	await expect(stage(page).getByText('3C', { exact: true }).first()).toBeAttached();
});

test('limits: light, colour and CO₂ change the rate and what limits it', async ({ page }) => {
	await open(page, './photosynthesis/#limits', 'Limited by RuBisCO and CO₂');
	// Full sun at today's CO₂: RuBisCO sets the pace, so more light hardly helps...
	await expect(stage(page)).toContainText('14.1 µmol per m² per second');
	await range(page, 'light').fill('100');
	await expect(stage(page)).toContainText('14.1 µmol per m² per second');
	// ...but more CO₂ does, until light limits again.
	await range(page, 'co2').fill('1000');
	await expect(stage(page)).toContainText('Limited by light');
	await expect(stage(page)).toContainText('19.1 µmol per m² per second');
	// In dim light the light reactions are the bottleneck, and green light
	// (less of it absorbed) drives the leaf less than red.
	await range(page, 'co2').fill('420');
	await range(page, 'light').fill('15');
	await expect(stage(page)).toContainText('Limited by light');
	await page.locator('button[data-control=colour][data-value="660"]').click();
	await expect(stage(page)).toContainText('10.7 µmol per m² per second');
	await page.locator('button[data-control=colour][data-value="550"]').click();
	await expect(stage(page)).toContainText('9.2 µmol per m² per second');
	// In the dark the leaf only respires: O₂ goes in, sugar is used up.
	await range(page, 'light').fill('0');
	await expect(stage(page)).toContainText('Dark: respiration only');
	await expect(stage(page)).toContainText('-0.9 µmol per m² per second');
});

test('limits: below the CO₂ compensation point the leaf loses carbon', async ({ page }) => {
	await open(page, './photosynthesis/#limits', 'Limited by RuBisCO and CO₂');
	await range(page, 'co2').fill('60');
	await expect(stage(page)).toContainText('Too little CO₂: the leaf loses carbon');
});
