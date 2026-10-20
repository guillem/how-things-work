import { expect, test, type Page } from '@playwright/test';

// The residual-stream explainer: what a visitor sees when they follow GPT-2's running vector, read
// it with the logit lens, and switch components off. The numbers are GPT-2 small's (the model
// tests check them against the data). Reduced motion freezes every scene on its complete frame.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`).click();

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'the logit lens reads the answer appearing in the last column',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./residual-stream-logit-lens/#lens');
		await expect(stage(page)).toContainText('Read after block 12, after “to”:');
		await expect(stage(page)).toContainText('68%');
		await range(page, 'row').fill('10');
		await expect(stage(page)).toContainText('Read after block 10, after “to”:');
		await expect(stage(page)).toContainText('99.8%');
		await range(page, 'row').fill('9');
		await expect(stage(page)).not.toContainText('99.8%');

		// Another prompt: the count is answered " 7".
		await choose(page, 's', 'count');
		await range(page, 'row').fill('12');
		await expect(stage(page)).toContainText('probability of “7”, the final answer');
		await expect(stage(page)).toContainText('96%');
	}
);

test('clicking a grid cell reads that cell', async ({ page }) => {
	await page.goto('./residual-stream-logit-lens/#grid');
	// The grid's click surface: 14 words by 13 rows. Click the second word ("Mary"), row 0.
	const surface = stage(page).locator('rect[style*="cursor"]');
	const box = await surface.boundingBox();
	if (!box) throw new Error('no grid');
	await surface.click({ position: { x: (box.width / 14) * 1.5, y: (box.height / 13) * 0.5 } });
	await expect(stage(page)).toContainText('Read after the embedding, after “Mary”:');
	await expect(range(page, 'col')).toHaveValue('2');
	await expect(range(page, 'row')).toHaveValue('0');
});

test('the running vector grows block by block', async ({ page }) => {
	await page.goto('./residual-stream-logit-lens/#arrows');
	await expect(stage(page)).toContainText('Running vector after block 12: length 477.9');
	await range(page, 'depth').fill('9');
	await expect(stage(page)).toContainText('Running vector after block 9: length 117.5');
	await expect(stage(page)).toContainText('“them” at 73%');
	await range(page, 'depth').fill('0');
	await expect(stage(page)).toContainText('Running vector after the embedding: length 4.5');
});

test('switching a component off changes the guesses after it', async ({ page }) => {
	await page.goto('./residual-stream-logit-lens/#ablate');
	await expect(stage(page)).toContainText('block 11 MLP switched off');
	await expect(stage(page)).toContainText('12 of 182 guesses changed');
	await expect(stage(page)).toContainText('With block 11 MLP off: next token after “to”');
	await page.locator('input[data-control=off]').uncheck();
	await expect(stage(page)).toContainText('0 of 182 guesses changed');
	await page.locator('input[data-control=off]').check();
	await range(page, 'block').fill('1');
	await expect(stage(page)).toContainText('139 of 182 guesses changed');
});

test('the chart of all 24 ablations names the one picked', async ({ page }) => {
	await page.goto('./residual-stream-logit-lens/#effects');
	await expect(stage(page)).toContainText(
		'block 11 MLP off: “Mary” 68% → 26%, and the top guess becomes “them”'
	);
	await choose(page, 's', 'count');
	await range(page, 'block').fill('12');
	await choose(page, 'part', 'attn');
	await expect(stage(page)).toContainText(
		'block 12 attention off: “7” 96% → 66%, still the top guess'
	);
	await expect(stage(page)).toContainText('largest drop past block 1: block 12 attention');
});
