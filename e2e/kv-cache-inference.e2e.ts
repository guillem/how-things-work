import { expect, test, type Page } from '@playwright/test';

// The kv-cache-inference explainer: what a visitor sees when the tiny GPT writes with and without
// the cache, when the cached and recomputed runs are compared in the page, and when the model,
// context and batch move the memory bar and the roofline. The model tests check the numbers.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'the cached and recomputed generations agree to the last bit',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./kv-cache-inference/#same');
		await expect(stage(page)).toContainText('the same 58 characters');
		await expect(stage(page)).toContainText('every position and character: 0, to the last bit');
		await expect(stage(page)).toContainText('31 times less arithmetic');
		// another draw of random numbers: another text, still identical
		await page.locator('button[data-control=seed]').click();
		await expect(stage(page)).toContainText('the same 58 characters');
		await expect(stage(page)).toContainText('0, to the last bit');
	}
);

test('without the cache the last character costs the whole window; with it, one position', async ({
	page
}) => {
	await page.goto('./kv-cache-inference/#one-at-a-time');
	await expect(stage(page)).toContainText('character 58 of 58, at position 64');
	await expect(stage(page)).toContainText('this character: 3.94 M FLOPs (all 64 positions)');
	await page.goto('./kv-cache-inference/#keep');
	await expect(stage(page)).toContainText('this character with the cache: 69.7 k FLOPs');
	await expect(stage(page)).toContainText('read from the cache (63)');
});

test('the cache grows with context and batch until it does not fit', async ({ page }) => {
	await page.goto('./kv-cache-inference/#cache-size');
	await expect(stage(page)).toContainText('512 KiB per token');
	await expect(stage(page)).toContainText('room for 134 conversations of 1,024 tokens');
	await range(page, 'context').focus();
	await page.keyboard.press('End');
	await range(page, 'batch').focus();
	for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('cache: 64 × 4,096 tokens = 137.4 GB');
	await expect(stage(page)).toContainText('does not fit: at most 33 conversations of 4,096 tokens');
	// grouped-query attention: a quarter of the cache, four times the conversations
	await page.getByRole('radio', { name: /Mistral 7B/ }).click();
	await expect(stage(page)).toContainText('128 KiB per token');
	await expect(stage(page)).toContainText('room for 133 conversations of 4,096 tokens');
});

test('prefill is compute-bound, decode memory-bound, and a batch shares the weights', async ({
	page
}) => {
	await page.goto('./kv-cache-inference/#prefill');
	await expect(stage(page)).toContainText('984 FLOPs per byte: compute-bound');
	await page.goto('./kv-cache-inference/#decode');
	await expect(stage(page)).toContainText('1.0 FLOPs per byte: memory-bound');
	await expect(stage(page)).toContainText('4.10 ms (arithmetic alone 0.014 ms)');
	await page.goto('./kv-cache-inference/#batch');
	await range(page, 'context').focus();
	await page.keyboard.press('ArrowLeft');
	await range(page, 'batch').focus();
	for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('Decode step: 32 × 1 token, 512 of context');
	await expect(stage(page)).toContainText('6.51 ms');
	await expect(stage(page)).toContainText('154 · 4,916');
});
