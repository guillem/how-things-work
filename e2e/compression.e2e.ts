import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('typing a message changes its size and never triggers the keyboard shortcuts', async ({
	page
}) => {
	await page.goto('./compression/#bits');
	await expect(stage(page)).toContainText('UTF-8: 37 characters × 8 bits = 296 bits');
	const box = page.getByRole('textbox', { name: 'Message' });
	await box.fill('');
	// Letters that are shortcuts elsewhere (restart, auto-advance, full screen, next/previous
	// step, help), a space and the navigation keys.
	await box.pressSequentially('rafjk? ');
	await box.press('ArrowLeft');
	await box.press('ArrowRight');
	await box.press('Home');
	await box.press('End');
	await expect(box).toHaveValue('rafjk? ');
	await expect(page).toHaveURL(/#bits$/);
	await expect(page.locator('aside h2')).toHaveText('Eight bits for every letter');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(stage(page)).toContainText('UTF-8: 7 characters × 8 bits = 56 bits');
	// 7 different symbols need 3 bits each.
	await expect(stage(page)).toContainText('Fixed 3-bit code: 7 × 3 = 21 bits');
});

test('the message carries over to the Huffman steps, and a preset replaces it', async ({
	page
}) => {
	await page.goto('./compression/#size');
	await expect(stage(page)).toContainText('The message in Huffman code: 114 bits');
	await page.getByRole('textbox', { name: 'Message' }).fill('abracadabra');
	// a:5 b:2 r:2 c:1 d:1 → 23 bits, the textbook Huffman size of "abracadabra".
	await expect(stage(page)).toContainText('The message in Huffman code: 23 bits');
	await page.getByRole('button', { name: 'Use the message abcdefghijklmnop' }).click();
	// 16 equally common letters: Huffman can do no better than 4 bits each.
	await expect(stage(page)).toContainText('The message in Huffman code: 64 bits');
	await expect(stage(page)).toContainText('between H = 4 and H + 1 = 5');
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue('abcdefghijklmnop');
});

test('lower quality keeps fewer coefficients of the block', async ({ page }) => {
	await page.goto('./compression/#quantise');
	const kept = async () =>
		Number(
			(
				await stage(page)
					.locator('text', { hasText: /rounded: \d+ of 64 kept/ })
					.textContent()
			)?.match(/(\d+) of 64/)?.[1]
		);
	const slider = page.locator('input[type=range][data-control=quality]');
	await slider.fill('100');
	await expect(stage(page)).toContainText('table at quality 100');
	const high = await kept();
	await slider.fill('5');
	await expect(stage(page)).toContainText('table at quality 5');
	const low = await kept();
	expect(low).toBeLessThan(high);
	expect(low).toBeGreaterThanOrEqual(1);
});

test('the whole picture: noise barely shrinks, and at quality 100 it grows', async ({ page }) => {
	await page.goto('./compression/#quality');
	await expect(stage(page)).toContainText('12.9 × smaller');
	await page.locator('button[data-control=image][data-value=noise]').click();
	await page.locator('input[type=range][data-control=quality]').fill('100');
	await expect(stage(page)).toContainText('× larger');
});

test('the block picker moves with the arrow keys without changing step', async ({ page }) => {
	await page.goto('./compression/#pixels');
	await expect(stage(page)).toContainText('Block at column 8, row 2');
	const picker = page.getByRole('slider', { name: /Block of the picture/ });
	await picker.focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	await expect(stage(page)).toContainText('Block at column 9, row 3');
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('Block at column 1, row 1');
	await expect(page).toHaveURL(/#pixels$/);
});
