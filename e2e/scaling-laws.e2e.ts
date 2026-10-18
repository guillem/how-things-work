import { expect, test, type Page } from '@playwright/test';

// The scaling-laws explainer: what a visitor sees when they pick a line of the sweep, retrain
// its smallest point, and drag a compute budget through the Chinchilla law with each set of
// constants. The numbers are the stored sweep's and the papers' (the model tests check both).
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'the loss falls as a power law in size until the text runs out',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./scaling-laws/#size');
		await expect(stage(page)).toContainText('training text: all 1,003,854 characters');
		await expect(stage(page)).toContainText('dashed: L = k·N^−0.067');
		await expect(stage(page)).toContainText('largest model: 1.76 measured,');
		await choose(page, 'size', '10000');
		await expect(stage(page)).toContainText('training text: 10,000 characters');
		await expect(stage(page)).toContainText('dashed: L = k·N^−0.009');
	}
);

test('more text helps a wide model more than a narrow one', async ({ page }) => {
	await page.goto('./scaling-laws/#data');
	await choose(page, 'width', '96');
	await expect(stage(page)).toContainText('dashed: L = k·D^−0.095');
	await expect(stage(page)).toContainText('all the text: 1.76');
	await choose(page, 'width', '8');
	await expect(stage(page)).toContainText('width 8 · 1,760 weights in its blocks');
	await expect(stage(page)).toContainText('dashed: L = k·D^−0.041');
	await expect(stage(page)).toContainText('all the text: 2.31');
});

test('retraining the smallest model in the page retraces the stored run', async ({ page }) => {
	await page.goto('./scaling-laws/#live');
	await expect(stage(page)).toContainText('press Train');
	await expect(page.locator('button[data-control=stop]')).toBeDisabled();
	await page.locator('button[data-control=train]').click();
	// past the measurements at steps 10 and 20, which match the stored ones
	await expect(stage(page)).toContainText(/step (2[1-9]|[3-9]\d|\d{3,}) of 3,000/, {
		timeout: 30_000
	});
	await expect(stage(page)).toContainText('largest gap from the stored run: 0.0000 nats');
	await page.locator('button[data-control=stop]').click();
	await expect(stage(page)).toContainText(/stopped at step \d+/);
});

test("Kaplan et al.'s slope next to the toy's", async ({ page }) => {
	await page.goto('./scaling-laws/#kaplan');
	await expect(stage(page)).toContainText('Kaplan et al.: α = 0.076');
	await expect(stage(page)).toContainText('this toy, 4 smallest: α = 0.067');
});

test('a compute budget has a best split, and it depends on the fit', async ({ page }) => {
	await page.goto('./scaling-laws/#chinchilla');
	// Gopher's budget with the constants printed in Hoffmann et al. 2022
	await expect(stage(page)).toContainText('budget C = 5.8 × 10²³ operations');
	await expect(stage(page)).toContainText('N = 32B parameters');
	await expect(stage(page)).toContainText('93 tokens per parameter');
	await expect(stage(page)).toContainText('floor E = 1.69');
	await choose(page, 'fit', 'hoffmann-tex');
	await expect(stage(page)).toContainText('N = 40B parameters');
	await choose(page, 'fit', 'besiroglu');
	await expect(stage(page)).toContainText('N = 72B parameters');
	await expect(stage(page)).toContainText('18 tokens per parameter');
	// a bigger budget buys a bigger model and more tokens
	await range(page, 'budget').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('budget C = 10²⁶ operations');
	await expect(stage(page)).toContainText('N = 1T parameters');
});

test('the revised step compares the three fits at one budget', async ({ page }) => {
	await page.goto('./scaling-laws/#revised');
	await expect(stage(page)).toContainText('printed: 32B, 93 per parameter');
	await expect(stage(page)).toContainText('unrounded: 40B, 59 per parameter');
	await expect(stage(page)).toContainText('refit: 72B, 18 per parameter');
});

test('an over-trained model is read off against the optimum', async ({ page }) => {
	await page.goto('./scaling-laws/#overtrain');
	await expect(stage(page)).toContainText('Llama 3 8B: 1,875 tokens per parameter');
	await expect(stage(page)).toContainText('Chinchilla');
});
