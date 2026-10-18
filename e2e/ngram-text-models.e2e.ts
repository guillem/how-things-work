import { expect, test, type Page } from '@playwright/test';

// The n-gram explainer: what a visitor sees when they feed the counting machine their own text,
// let it write, and widen its window on Tiny Shakespeare. The meters are live computations on
// the shipped text, so the numbers below are what the page measures (the model tests check
// them independently). Reduced motion freezes every scene on its complete frame.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'the machine counts the windows of the reader’s text, without triggering shortcuts',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./ngram-text-models/#count');
		await expect(stage(page)).toContainText(
			'92 different windows of 2; 55 of them came up only once'
		);
		const box = page.getByRole('textbox', { name: 'Text for the machine to count' });
		await box.fill('');
		// letters that are shortcuts elsewhere
		await box.pressSequentially('rafarafa');
		await expect(page).toHaveURL(/#count$/);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		// ra, af, fa: each window of 2 and what followed it
		await expect(stage(page)).toContainText(
			'4 different windows of 2; 2 of them came up only once'
		);
		await range(page, 'cn').fill('1');
		await expect(stage(page)).toContainText(
			'3 different windows of 1; 0 of them came up only once'
		);
		await stage(page).getByRole('button', { name: 'Use the text tongue twister' }).click();
		await expect(stage(page)).toContainText('different windows of 1');
	}
);

test('it writes from those counts; another draw gives another text', async ({ page }) => {
	await page.goto('./ngram-text-models/#write');
	await expect(stage(page)).toContainText(
		'learned from your text (171 letters) · window of 2 · draw no. 1'
	);
	await expect(stage(page)).toContainText(
		'Of the 72 letters it writes, 30 had only one possible next letter'
	);
	await page.locator('button[data-control=again]').click();
	await expect(stage(page)).toContainText('draw no. 2');
	// a window of 4 on a short text: almost no choices left
	await range(page, 'cn').fill('4');
	await expect(stage(page)).toContainText(/Of the 72 letters it writes, (6\d|7\d) had only one/);
});

test('on Shakespeare, a longer window: real words, unseen windows and copies all grow', async ({
	page
}) => {
	await page.goto('./ngram-text-models/#shakespeare');
	await expect(stage(page)).toContainText('learned from 1,003,854 letters of the plays');
	await expect(stage(page)).toContainText('Never seen1.4%');
	await range(page, 'n').fill('1');
	await expect(stage(page)).toContainText('Real words24%');
	await range(page, 'n').fill('10');
	await expect(stage(page)).toContainText('Real words100%');
	await expect(stage(page)).toContainText('Never seen75%');
	await expect(stage(page)).toContainText('Longest copy69 letters');
});

test('held-out text: unseen windows marked, and more text helps only a little', async ({
	page
}) => {
	await page.goto('./ngram-text-models/#heldout');
	await expect(stage(page)).toContainText(
		'window of 3: 1.4% of the 111,537 held-out windows were never seen'
	);
	await range(page, 'n').fill('8');
	await expect(stage(page)).toContainText('window of 8: 50% of the 111,532 held-out windows');
	await page.goto('./ngram-text-models/#moredata');
	await range(page, 'n').fill('10');
	await expect(stage(page)).toContainText('window of 10: 75%');
	await option(page, 'size', '10k').click();
	await expect(stage(page)).toContainText('window of 10: 99%');
});

test('possible windows outgrow the text', async ({ page }) => {
	await page.goto('./ngram-text-models/#explode');
	await expect(stage(page)).toContainText('window of 3: 274,625 possible windows');
	await range(page, 'n').fill('10');
	await expect(stage(page)).toContainText('about 1.3 × 10¹⁸ possible windows');
	await expect(stage(page)).toContainText('780,165 different windows in the training text; 94%');
});

test('long windows recite: the copy is shown in its place in the plays', async ({ page }) => {
	await page.goto('./ngram-text-models/#recite');
	await range(page, 'n').fill('10');
	await expect(stage(page)).toContainText('no choice on 86% of its letters');
	await expect(stage(page)).toContainText('the marked 69 letters, word for word in the plays');
	await option(page, 'size', '10k').click();
	await expect(stage(page)).toContainText('learned from 10,000 letters of the plays');
	await expect(stage(page)).toContainText('the marked 240 letters');
});
