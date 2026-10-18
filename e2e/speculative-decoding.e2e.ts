import { expect, test, type Page } from '@playwright/test';

// The speculative-decoding explainer: what a visitor sees when a round's guesses are checked,
// turned down and topped up, when the number of guesses and the draft change the passes, when
// 10,000 draws are compared with the target's probabilities, and on the speed charts. The model
// tests check the numbers.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'a guess the target finds unlikely is turned down and redrawn from the leftover',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./speculative-decoding/#reject');
		await expect(stage(page)).toContainText('Round 1 of 20');
		await expect(stage(page)).toContainText('The check of “g”');
		await expect(stage(page)).toContainText('turned down');
		await expect(stage(page)).toContainText('leftover: “t” (0.979)');
		await expect(stage(page)).toContainText(
			'whole text: 58 characters in 20 passes (2.9 per pass)'
		);
	}
);

test('a round whose guesses are all kept earns a bonus character', async ({ page }) => {
	await page.goto('./speculative-decoding/#bonus');
	await expect(stage(page)).toContainText('Round 2 of 20');
	await expect(stage(page)).toContainText('Every guess was kept');
	await expect(stage(page)).toContainText('drew “s” (0.574)');
	await expect(stage(page)).toContainText('5 characters for one pass');
});

test('more guesses or a better draft take fewer passes', async ({ page }) => {
	await page.goto('./speculative-decoding/#keep');
	await expect(stage(page)).toContainText('58 characters in 20 passes');
	await range(page, 'k').focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('58 characters in 32 passes (1.8 per pass)');
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('58 characters in 15 passes (3.9 per pass)');
	// the target as its own draft: every guess kept
	await range(page, 'k').focus();
	for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
	await page.getByRole('radio', { name: 'The target itself' }).click();
	await expect(stage(page)).toContainText('58 characters in 12 passes');
	// the round slider steps through the run
	await range(page, 'round').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Round 12 of 12');
});

test('the last round, cut short by the full window, shows the target’s own character', async ({
	page
}) => {
	// regression: a round with no room left for guesses used to throw
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('./speculative-decoding/#keep');
	await page.getByRole('radio', { name: 'The target itself' }).click();
	await range(page, 'k').focus();
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await range(page, 'round').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Round 20 of 20 · 0 guesses');
	await expect(stage(page)).toContainText('No room left for guesses');
	expect(errors).toEqual([]);
});

test('10,000 speculative draws land on the target’s probabilities, the shortcut does not', async ({
	page
}) => {
	await page.goto('./speculative-decoding/#exact');
	await expect(stage(page)).toContainText('10,000 draws');
	await expect(stage(page)).toContainText(
		'distance from p: 1.0% · sampling noise alone: about 1.0%'
	);
	await page.goto('./speculative-decoding/#why');
	await expect(stage(page)).toContainText('Σ min(p, q) = 0.878');
	await page.goto('./speculative-decoding/#greedy');
	await expect(stage(page)).toContainText('distance from p: the rule 1.0% · top choice only 23.5%');
	await page.getByRole('radio', { name: /bigram/ }).click();
	await expect(stage(page)).toContainText('the rule 0.6% · top choice only 25.8%');
});

test('characters per pass follow the keep rate; the draft’s cost decides the speed-up', async ({
	page
}) => {
	await page.goto('./speculative-decoding/#per-pass');
	await expect(stage(page)).toContainText('keep rate α = 0.76');
	await expect(stage(page)).toContainText('measured: 3.09 per pass');
	await page.getByRole('radio', { name: /bigram/ }).click();
	await expect(stage(page)).toContainText('keep rate α = 0.55');
	await page.goto('./speculative-decoding/#cost');
	await page.getByRole('radio', { name: /Smaller tiny GPT/ }).click();
	await expect(stage(page)).toContainText('speed-up: 1.25× (ideal)');
	await expect(stage(page)).toContainText('arithmetic per character: 2.08×');
	await page.getByRole('radio', { name: 'The target itself' }).click();
	await expect(stage(page)).toContainText('the bytes: slower');
});
