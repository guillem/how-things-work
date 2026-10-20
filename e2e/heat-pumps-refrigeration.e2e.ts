import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('cop: R-134a between 0 and 40 °C gives a heating COP of 6.5 under the Carnot 7.8', async ({
	page
}) => {
	await open(page, './heat-pumps-refrigeration/#cop', 'heating COP 6.49');
	await expect(stage(page)).toContainText('Carnot reference 7.83');
	await page.locator('input[type=range][data-control=tcond]').fill('60');
	await expect(stage(page)).toContainText('heating COP 4.06');
});

test('losses: a worse compressor lowers the COP', async ({ page }) => {
	await open(page, './heat-pumps-refrigeration/#losses', 'heating COP 5.34');
	await page.locator('input[type=range][data-control=eta]').fill('0.5');
	await expect(stage(page)).not.toContainText('heating COP 5.34');
	await expect(stage(page)).toContainText('heating COP 3.');
});

test('propane: a different fluid, almost the same COP', async ({ page }) => {
	await open(page, './heat-pumps-refrigeration/#propane', 'R-134a');
	await page.locator('[data-control=fluid][data-value=propane]').click();
	await expect(stage(page)).toContainText('propane');
	await expect(stage(page)).toContainText('heating COP 6.40');
});

test('co2: transcritical, with a best gas cooler pressure near 9 MPa', async ({ page }) => {
	await open(page, './heat-pumps-refrigeration/#co2', 'CO₂, transcritical');
	await expect(stage(page)).toContainText('best pressure 9.0 MPa');
	await page.locator('input[type=range][data-control=pgc]').fill('7.5');
	await expect(stage(page)).toContainText('heating COP 1.84');
});

test('efficiency: the heat delivered is the work plus the heat moved in', async ({ page }) => {
	await open(page, './heat-pumps-refrigeration/#efficiency', 'heat delivered 5.3');
	await expect(stage(page)).toContainText('heat from outside 4.3');
});

test('dragging on the diagram: the condenser line moves the condensing temperature', async ({
	page
}) => {
	await open(page, './heat-pumps-refrigeration/#cop', 'heating COP 6.49');
	const line = page.getByRole('slider', { name: 'Drag the condensing temperature' });
	await line.focus();
	for (let i = 0; i < 20; i++) await line.press('ArrowUp');
	await expect(page.locator('input[type=range][data-control=tcond]')).toHaveValue('60');
	await expect(stage(page)).toContainText('heating COP 4.06');
});
