import { expect, test, type Page } from '@playwright/test';

// The exponentials-and-logarithms explainer: what a visitor sees when they fold paper, race
// adding against multiplying, switch to a log axis, count doublings, date a sample and use the
// slide rule. The model tests check the arithmetic itself.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'42 folds of 0.1 mm paper reach past the Moon; 27 pass Everest',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./exponentials-logarithms/#fold');
		await expect(stage(page)).toContainText('439,805 km');
		await expect(stage(page)).toContainText('the Moon');
		await range(page, 'folds').fill('27');
		await expect(stage(page)).toContainText('13.4 km');
		await expect(stage(page)).toContainText('Mount Everest');
	}
);

test('multiplying overtakes adding late when the factor is small', async ({ page }) => {
	await page.goto('./exponentials-logarithms/#race');
	await expect(stage(page)).toContainText('multiplying overtakes at step 27');
	await range(page, 'factor').fill('1.01');
	await expect(stage(page)).toContainText('multiplying overtakes at step 364');
	await range(page, 'factor').fill('1');
	await expect(stage(page)).toContainText('multiplying never overtakes');
});

test('on the log axis each ×10 takes the same number of steps', async ({ page }) => {
	await page.goto('./exponentials-logarithms/#logaxis');
	await expect(stage(page)).toContainText('×10 every 47.2 steps');
	await range(page, 'factor').fill('1.3');
	await expect(stage(page)).toContainText('×10 every 8.8 steps');
});

test('the doubling time against the rules of 72 and 70', async ({ page }) => {
	await page.goto('./exponentials-logarithms/#doubling');
	await expect(stage(page)).toContainText('one doubling: 7.27 steps');
	await expect(stage(page)).toContainText('rule of 72: 72 ÷ 10 = 7.20');
	await range(page, 'rate').fill('100');
	await expect(stage(page)).toContainText('one doubling: 1.00 steps');
	await expect(stage(page)).toContainText('28.0 % short');
});

test('dragging the sample age by keyboard reads off the carbon-14 left', async ({ page }) => {
	await page.goto('./exponentials-logarithms/#decay');
	await expect(stage(page)).toContainText('25.0 %');
	await page.getByRole('slider', { name: 'Age of the sample' }).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('10.53 half-lives');
	await expect(stage(page)).toContainText('0.068 %');
	await expect(range(page, 'age')).toHaveValue('60000');
});

test('a logarithm counts doublings and zeros', async ({ page }) => {
	await page.goto('./exponentials-logarithms/#count');
	await expect(stage(page)).toContainText('log₂ 1,000 = 9.97');
	const marker = page.getByRole('slider', { name: 'Number on the log scale' });
	await marker.focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('log₂ 1,000,000 = 19.93');
	await page.goto('./exponentials-logarithms/#zeros');
	await range(page, 'number').fill('6');
	await expect(stage(page)).toContainText('log₁₀ 1,000,000 = 6.00');
	await expect(stage(page)).toContainText('4.00 magnitude steps');
});

test('the slide rule multiplies, and past 10 uses its other end', async ({ page }) => {
	await page.goto('./exponentials-logarithms/#slide');
	await expect(stage(page)).toContainText('reads 6');
	await range(page, 'b').fill('6');
	await expect(stage(page)).toContainText('off the end of the rule');
	await page.goto('./exponentials-logarithms/#offscale');
	await expect(stage(page)).toContainText('reads 2 → 20');
	await range(page, 'a2').fill('3.71');
	await range(page, 'b2').fill('2.43');
	await expect(stage(page)).toContainText('reads 9.025');
	await expect(stage(page)).toContainText('exact product: 9.0153');
});
