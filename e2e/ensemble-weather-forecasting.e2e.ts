import { expect, test, type Page } from '@playwright/test';

// The ensemble forecasting explainer: what a visitor sees when they change the measurement
// error, the day, the forecast model and the lead time. Reduced motion shows every run to its
// end. The model tests check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();
const press = (page: Page, id: string) => page.locator(`button[data-control=${id}]`).click();
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.]+)`).exec(text);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'a ten times better measurement makes the forecast last longer, but not ten times',
	{
		tag: '@smoke'
	},
	async ({ page }) => {
		await page.goto('./ensemble-weather-forecasting/#single');
		await expect(stage(page)).toContainText('useful for');
		const coarse = await read(page, 'useful for');
		expect(coarse).toBeGreaterThan(6);
		expect(coarse).toBeLessThan(13);
		await choose(page, 'obsErr', '0.03');
		await expect(stage(page)).toContainText('measurement with error 0.03');
		const fine = await read(page, 'useful for');
		expect(fine - coarse).toBeGreaterThan(3);
		expect(fine).toBeLessThan(3 * coarse);
	}
);

test('averaged over many days, each tenfold improvement buys about a week', async ({ page }) => {
	await page.goto('./ensemble-weather-forecasting/#tenfold');
	await expect(stage(page)).toContainText('0.003:');
	const gain = (await read(page, '0.03:')) - (await read(page, '0.3:'));
	expect(gain).toBeGreaterThan(5.5);
	expect(gain).toBeLessThan(9);
});

test('another day gives other weather and another forecast', async ({ page }) => {
	await page.goto('./ensemble-weather-forecasting/#fan');
	await expect(stage(page)).toContainText('spread');
	const before = await stage(page).textContent();
	await press(page, 'day');
	await expect.poll(() => stage(page).textContent()).not.toBe(before);
});

test('a perfect model’s fan is honest; a wrong model’s is too narrow', async ({ page }) => {
	await page.goto('./ensemble-weather-forecasting/#spread');
	await expect(stage(page)).toContainText('perfect model');
	const ratio = async () =>
		(await read(page, 'spread')) / (await read(page, 'error of the average'));
	const honest = await ratio();
	expect(honest).toBeGreaterThan(0.85);
	expect(honest).toBeLessThan(1.15);
	await choose(page, 'model', 'weak20');
	await expect(stage(page)).toContainText('model heating F = 6.4');
	expect(await ratio()).toBeLessThan(0.8);
});

test('the chance of rain sinks to the climate’s 17 % at long range', async ({ page }) => {
	await page.goto('./ensemble-weather-forecasting/#odds');
	await expect(stage(page)).toContainText('your town 69 %');
	await range(page, 'lead').fill('30');
	await expect(stage(page)).toContainText('chance of rain on day 30');
	const town = await read(page, 'your town');
	expect(town).toBeLessThan(40);
});

test('a wrong model is overconfident and forecasts too little rain', async ({ page }) => {
	await page.goto('./ensemble-weather-forecasting/#reliability');
	await expect(stage(page)).toContainText('4,000 forecasts');
	const fair = await read(page, 'average forecast chance');
	expect(Math.abs(fair - (await read(page, 'it rained in')))).toBeLessThanOrEqual(2);
	await choose(page, 'model', 'weak20');
	await expect(stage(page)).toContainText('model F = 6.4');
	expect(await read(page, 'average forecast chance')).toBeLessThan(14);
	expect(await read(page, 'it rained in')).toBeGreaterThan(15);
});

test('observing and correcting keeps the analysis closer than the observations', async ({
	page
}) => {
	await page.goto('./ensemble-weather-forecasting/#cycle');
	await expect(stage(page)).toContainText('analysis error');
	expect(await read(page, 'analysis error')).toBeLessThan(1);
	expect(await read(page, 'left alone')).toBeGreaterThan(2);
});
