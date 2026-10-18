import { expect, test, type Page } from '@playwright/test';

// The tokenization explainer: what a visitor sees when they learn merges from a text they type,
// and run GPT-2's real tokenizer. The numbers are what the page computes (the model tests check
// them against references). Reduced motion freezes every scene on its complete frame.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'the pairs of the reader’s text are counted, without triggering shortcuts',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./tokenization/#bytes');
		await expect(stage(page)).toContainText('Most frequent pair: ␣ + t, 19 times');
		const box = page.getByRole('textbox', { name: 'Text to learn the merges from' });
		await box.fill('');
		// letters that are shortcuts elsewhere
		await box.pressSequentially('rafa rafa');
		await expect(page).toHaveURL(/#bytes$/);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(stage(page)).toContainText('Most frequent pair: r + a, 2 times');
		await expect(stage(page)).toContainText('Your text: 9 bytes → 9 tokens');
	}
);

test('merges one at a time until no pair occurs twice', async ({ page }) => {
	await page.goto('./tokenization/#merge');
	await expect(stage(page)).toContainText('Merge no. 1: ␣ + t → ␣t (19 times)');
	await range(page, 'k').fill('8');
	await expect(stage(page)).toContainText('Merge no. 8: ␣t + he → ␣the (6 times)');
	await expect(stage(page)).toContainText('Vocabulary: 256 bytes + 8 merges = 264');
	await range(page, 'k').press('End');
	await expect(stage(page)).toContainText('Your text: 384 bytes → 196 tokens');
	await expect(stage(page)).toContainText('no pair occurs twice any more');
	// Gage's example: three merges, five tokens
	await stage(page).getByRole('button', { name: 'Use the example aaabdaaabac' }).click();
	await range(page, 'k').press('End');
	await expect(stage(page)).toContainText('Merge no. 3: aaa + b → aaab (2 times)');
	await expect(stage(page)).toContainText('Your text: 11 bytes → 5 tokens');
});

test('the curve: the text and a new sentence both get shorter', async ({ page }) => {
	await page.goto('./tokenization/#shorter');
	await range(page, 'k').fill('0');
	await expect(stage(page)).toContainText(
		'Comparison sentence, the next line of the speech: 49 bytes → 49 tokens'
	);
	await range(page, 'k').press('End');
	await expect(stage(page)).toContainText('49 merges · vocabulary 305');
	await expect(stage(page)).toContainText('49 bytes → 33 tokens');
	await expect(stage(page)).toContainText('384 bytes → 196 tokens (51%)');
});

test('an empty text: nothing to learn, and no percentage', async ({ page }) => {
	await page.goto('./tokenization/#merge');
	await page.getByRole('textbox', { name: 'Text to learn the merges from' }).fill('');
	await expect(stage(page)).toContainText('No pair occurs twice: nothing to merge');
	await page.goto('./tokenization/#shorter');
	await expect(stage(page)).toContainText('your text: 0 bytes → 0 tokens');
	await expect(stage(page)).not.toContainText('NaN');
});

test('GPT-2: the pre-split, rank order against longest match, and ranks', async ({ page }) => {
	await page.goto('./tokenization/#presplit');
	await expect(stage(page)).toContainText('50 characters → 8 pieces → 10 tokens');
	const box = page.getByRole('textbox', { name: 'Text for GPT-2’s tokenizer' });
	await box.fill("it's");
	await expect(stage(page)).toContainText('4 characters → 2 pieces → 2 tokens');

	// the text typed is kept across steps
	await page.goto('./tokenization/#ranks');
	await expect(stage(page)).toContainText('2 tokens · not GPT-2');
	await stage(page).getByRole('button', { name: 'Use the example strawberry' }).click();
	await expect(stage(page)).toContainText('10 tokens · not GPT-2');
	await stage(page).getByRole('button', { name: 'Use the example long words' }).click();
	await expect(stage(page)).toContainText('8 tokens');
	await expect(stage(page)).toContainText('10 tokens · not GPT-2');
	await expect(stage(page)).toContainText('The merges of “␣antidisestablishmentarianism”');

	// each token with the merge that made it: early for common pieces, late for rare ones
	await page.goto('./tokenization/#common');
	await expect(stage(page)).toContainText('44 characters → 8 tokens');
	await expect(stage(page)).toContainText('␣ofno. 31');
	await expect(stage(page)).toContainText('establishmentno. 44,135');
});

test('numbers, languages and the letters inside a token', async ({ page }) => {
	await page.goto('./tokenization/#numbers');
	await expect(stage(page)).toContainText('one token: 505 of 1,000');
	await expect(stage(page)).toContainText('2 tokens · move the Number slider');
	await range(page, 'num').fill('777');
	await expect(stage(page)).toContainText('1 token · move the Number slider');

	await page.goto('./tokenization/#languages');
	await expect(stage(page)).toContainText('Hindi');
	await expect(stage(page)).toContainText('×4.7');

	await page.goto('./tokenization/#letters');
	await expect(stage(page)).toContainText(
		'“␣strawberry” · after a space, as in running text · 1 token'
	);
	await expect(stage(page)).toContainText('41236');
	await expect(stage(page)).toContainText('spelled out, letter by letter · 10 tokens');
});
