import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('brayton: the gas turbine makes 41% and sends its exhaust out at 657 °C', async ({ page }) => {
	await open(page, './gas-turbines-combined-cycle/#brayton', 'gas turbine: 41.2%');
	await expect(stage(page)).toContainText('exhaust 657 °C');
	// A higher pressure ratio: more efficient, cooler exhaust.
	await page.locator('input[type=range][data-control=ratio]').fill('30');
	await expect(stage(page)).toContainText('gas turbine: 44.9%');
	await expect(stage(page)).toContainText('exhaust 565 °C');
});

test('levels: each added level lowers the stack and raises the plant’s efficiency', async ({
	page
}) => {
	await open(page, './gas-turbines-combined-cycle/#levels', 'stack 115 °C');
	await expect(stage(page)).toContainText('plant 60.5%');
	await page.locator('[data-control=levels][data-value="3"]').click();
	await expect(stage(page)).toContainText('stack 69 °C');
	await expect(stage(page)).toContainText('plant 61.6%');
	await expect(stage(page)).toContainText('0.4 MPa: boils at 144 °C');
});

test('pinch: a wider pinch sends hotter gas up the stack', async ({ page }) => {
	await open(page, './gas-turbines-combined-cycle/#pinch', 'pinch 10 K');
	await page.locator('input[type=range][data-control=pinch]').fill('40');
	await expect(stage(page)).toContainText('stack 167 °C');
});

test('plant: the gas turbine and the steam turbine share the work', async ({ page }) => {
	await open(page, './gas-turbines-combined-cycle/#plant', 'plant: 61.6%');
	await expect(stage(page)).toContainText('steam turbine work');
	await expect(stage(page)).toContainText('gas turbine alone: 41.2%');
});

test('optimum: the plant’s best pressure ratio is below the gas turbine’s', async ({ page }) => {
	await open(page, './gas-turbines-combined-cycle/#optimum', 'combined plant: best at 34');
	await expect(stage(page)).toContainText('gas turbine alone: best at 66');
	await page.locator('input[type=range][data-control=tit]').fill('1400');
	await expect(stage(page)).toContainText('combined plant: best at 19');
	await expect(stage(page)).toContainText('gas turbine alone: best at 38');
});
