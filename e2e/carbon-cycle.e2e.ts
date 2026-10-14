import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

// Reduced motion shows each step's finished picture: the clock has run to the end.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

/** The CO₂ the run step reports for its last year, in ppm. */
async function finalPPM(page: Page) {
	const text = (await stage(page).textContent()) ?? '';
	const m = /\+[\d,]+ GtC · (\d+) ppm/.exec(text);
	expect(m, 'the air bar shows its ppm').not.toBeNull();
	return Number(m![1]);
}

test('the air holds 590 GtC before industry and 898 GtC in 2024', async ({ page }) => {
	await open(page, './carbon-cycle/#stores');
	await expect(stage(page)).toContainText('590 GtC in 1750');
	await expect(stage(page)).toContainText('deep ocean');
	await page.goto('./carbon-cycle/#burning');
	await expect(stage(page)).toContainText('898 GtC in 2024');
	await expect(stage(page)).toContainText('burning 9.8');
});

test('the model matches the measured ocean and land sinks of 2015–2024', async ({ page }) => {
	await open(page, './carbon-cycle/#history');
	await expect(stage(page)).toContainText('ocean 2015–2024: model 3.2, GCB 3.2');
	await expect(stage(page)).toContainText('plants 2015–2024: model 2.4, GCB 2.4');
	await expect(stage(page)).toContainText('2024 · 423 ppm');
});

test('after emissions stop, CO₂ falls but stays far above 278 ppm for 1,000 years', async ({
	page
}) => {
	await open(page, './carbon-cycle/#run');
	await expect(stage(page)).toContainText('Extra carbon since 1750, in 3024');
	await expect(stage(page)).toContainText('emissions stopped in 2074');
	const fifty = await finalPPM(page);
	await page.locator('input[type=range][data-control=years]').fill('0');
	await expect(stage(page)).toContainText('no emissions after 2024');
	const none = await finalPPM(page);
	// Stopping now leaves less CO₂ in 3024 than 50 more years of emissions…
	expect(none).toBeLessThan(fifty);
	// …but still well above the 278 ppm of 1750.
	expect(none).toBeGreaterThan(310);
	// More burning for longer leaves more in the air.
	await page.locator('input[type=range][data-control=years]').fill('150');
	await page.locator('input[type=range][data-control=burning]').fill('20');
	await expect(stage(page)).toContainText('more than the proven reserves');
	expect(await finalPPM(page)).toBeGreaterThan(fifty + 200);
});

test('weaker sinks leave more CO₂ in the air', async ({ page }) => {
	await open(page, './carbon-cycle/#sinks');
	const base = await finalPPM(page);
	await page.locator('input[type=range][data-control=plants]').fill('0');
	await expect(stage(page)).toContainText('dashed: default sinks');
	const noPlants = await finalPPM(page);
	expect(noPlants).toBeGreaterThan(base + 10);
	await page.locator('input[type=range][data-control=plants]').fill('100');
	await page.locator('input[type=range][data-control=mixing]').fill('25');
	expect(await finalPPM(page)).toBeGreaterThan(base + 30);
});

test('a burst of CO₂ lingers: about a quarter is still in the air after 1,000 years', async ({
	page
}) => {
	await open(page, './carbon-cycle/#pulse');
	await expect(stage(page)).toContainText('Share of a 100 GtC burst still in the air');
	await expect(stage(page)).toContainText('39% after 100 yr');
	await expect(stage(page)).toContainText('25% after 1,000 yr');
	await page.locator('input[type=range][data-control=pulse]').fill('2000');
	await expect(stage(page)).toContainText('Share of a 2000 GtC burst');
	await expect(stage(page)).toContainText('33% after 1,000 yr');
});
