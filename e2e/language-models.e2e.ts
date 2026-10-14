import { expect, test, type Page } from '@playwright/test';

// The language-model explainer: what a visitor sees when they type text for GPT-2's tokenizer,
// move the temperature and cut-off sliders, watch sampled runs, pick tokens themselves and
// compare a base model's answers. Reduced motion freezes every scene on a complete frame.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'typing text shows GPT-2’s tokens and their numbers, without triggering shortcuts',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./language-models/#tokens');
		await expect(stage(page)).toContainText('38 characters → 9 tokens');
		await expect(stage(page)).toContainText('8765'); // ␣Tower
		const box = page.getByRole('textbox', { name: 'Text to tokenize' });
		await box.fill('');
		// letters that are shortcuts elsewhere, and a space
		await box.pressSequentially('rafj paris');
		await expect(page).toHaveURL(/#tokens$/);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		// r·a·f·j is cut into GPT-2's pieces; ␣paris is two tokens, ␣par + is
		await expect(stage(page)).toContainText('10 characters →');
		await expect(stage(page)).toContainText('␣par');
		await page.getByRole('button', { name: /^Use the text Paris, in Paris/ }).click();
		await expect(stage(page)).toContainText('40313'); // Paris
		await expect(stage(page)).toContainText('6342'); // ␣Paris
	}
);

test('the merges step replays the merges of the text, in rank order', async ({ page }) => {
	await page.goto('./language-models/#merges');
	await expect(stage(page)).toContainText('All the merges of “␣unbelievably”, in order');
	// reduced motion: every merge applied, the last one named
	await expect(stage(page)).toContainText(/merge no\. [\d,]+ of 50,000: .+ → .+/);
	await expect(stage(page)).toContainText('merge 48,688');
});

test('temperature reshapes the distribution; 0 is greedy', async ({ page }) => {
	await page.goto('./language-models/#temperature');
	await expect(stage(page)).toContainText('T = 1.0: the ten shown hold 89%');
	await range(page, 'temp').fill('0');
	await expect(stage(page)).toContainText('T = 0: all the probability on the top token (greedy)');
	await range(page, 'temp').fill('2');
	await expect(stage(page)).toContainText('T = 2.0: the ten shown hold 12%');
	await option(page, 'pr', 'story').click();
	await expect(stage(page)).toContainText('the ten shown hold 1.8%');
});

test('top-k and top-p keep fewer tokens and rescale them', async ({ page }) => {
	await page.goto('./language-models/#cutoffs');
	await expect(stage(page)).toContainText('3 tokens kept, holding 83% before rescaling');
	await expect(stage(page)).toContainText('35% → 42%');
	await expect(stage(page)).toContainText('top-p 0.90 alone would keep 14');
	await range(page, 'topp').fill('0.05');
	await expect(stage(page)).toContainText('1 token kept');
	await expect(stage(page)).toContainText('35% → 100%');
});

test('a sampled run: the text depends on the temperature and the run', async ({ page }) => {
	await page.goto('./language-models/#sample');
	await expect(stage(page)).toContainText('T = 0.7, run 1');
	await expect(stage(page)).toContainText('late thirties');
	await range(page, 'seed').fill('3');
	await expect(stage(page)).toContainText('elf');
	await option(page, 'rt', '0').click();
	await expect(stage(page)).toContainText('greedy decoding (T = 0)');
	await expect(stage(page)).toContainText('peace and harmony');
});

test('choosing tokens yourself: add, undo and start again', async ({ page }) => {
	await page.goto('./language-models/#choose');
	await expect(stage(page)).toContainText('Your choice 1 of 3');
	await stage(page).getByRole('button', { name: 'Add the token ␣woman' }).click();
	await expect(stage(page)).toContainText('Your choice 2 of 3');
	await expect(stage(page)).toContainText('woman');
	await stage(page).getByRole('button', { name: 'Undo the last token' }).click();
	await expect(stage(page)).toContainText('Your choice 1 of 3');
	for (let i = 0; i < 3; i++)
		await stage(page)
			.getByRole('button', { name: /^Add the token/ })
			.first()
			.click();
	await expect(stage(page)).toContainText('Three tokens chosen');
	await page.locator('button[data-control=restart]').click();
	await expect(stage(page)).toContainText('Your choice 1 of 3');
	// at temperature 0 only the top token may be picked
	await range(page, 'temp').fill('0');
	await expect(stage(page).getByRole('button', { name: /^Add the token/ })).toHaveCount(1);
});

test('training: the probability GPT-2 gave each real next token', async ({ page }) => {
	await page.goto('./language-models/#learned');
	await expect(stage(page)).toContainText('GPT-2 gave it 1.1%'); // ␣1889
	await stage(page)
		.getByRole('button', { name: /^Position 5:/ })
		.click();
	await expect(range(page, 'pos')).toHaveValue('5');
	await expect(stage(page)).toContainText('GPT-2 gave it 98%'); // ␣Tower
	await expect(stage(page)).toContainText('average loss over the sentence (cross-entropy): 2.78');
});

test('a base model continues text; framed as Q and A it answers, wrongly', async ({ page }) => {
	await page.goto('./language-models/#base');
	await expect(stage(page)).toContainText('53%');
	await option(page, 'frame', 'qa').click();
	await expect(stage(page)).toContainText('1.5 degrees Fahrenheit');
});
