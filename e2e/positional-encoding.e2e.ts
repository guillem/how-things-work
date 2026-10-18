import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

// The positional-encoding explainer: what a visitor sees when they shuffle a sentence under
// attention, turn the sinusoids' clock hands and move a query and a key under RoPE. The numbers
// are what the page computes (the model tests check the properties behind them). Reduced motion
// freezes every scene on its complete frame.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'without a mask, shuffled words keep their outputs; with the mask they do not',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./positional-encoding/#shuffle');
		await expect(stage(page)).toContainText('Now: “the dog bit the man”');
		await page.getByRole('button', { name: 'Shuffle the words' }).click();
		await expect(stage(page)).toContainText('Now: “the man bit the dog”');
		await expect(stage(page)).toContainText('5 of 5 outputs the same');

		// The next step keeps the order and switches the causal mask on.
		await page.goto('./positional-encoding/#mask');
		await expect(stage(page)).toContainText('Now: “the man bit the dog”');
		await expect(stage(page)).toContainText('1 of 5 outputs the same; the largest change is 2.62');
		await page.locator('input[data-control=mask]').uncheck({ force: true });
		await expect(stage(page)).toContainText('5 of 5 outputs the same');
	}
);

test('a fixed offset turns each hand by the same angle at every position', async ({ page }) => {
	await page.goto('./positional-encoding/#offset');
	await expect(stage(page)).toContainText('Positions 10 and 15');
	await expect(stage(page)).toContainText('k·ω turns 286°');
	await range(page, 'pos').fill('100');
	await expect(stage(page)).toContainText('Positions 100 and 105');
	await expect(stage(page)).toContainText('k·ω turns 286°');
	await range(page, 'k').fill('1');
	await expect(stage(page)).toContainText('k·ω turns 57°');
});

test('RoPE: the score follows the distance, not where the pair stands', async ({ page }) => {
	await page.goto('./positional-encoding/#relative');
	await expect(stage(page)).toContainText('RoPE score = sum of the shares = 1.57');
	await expect(stage(page)).toContainText('sinusoids added instead: −1.22');
	// Move the pair with the key token's handle: the RoPE score stays, the other one drifts.
	const key = page.getByRole('slider', { name: 'Key token (moves both)' });
	await key.focus();
	await key.press('Shift+ArrowRight');
	await expect(stage(page)).toContainText('the query at position 25 and the key at position 20');
	await expect(stage(page)).toContainText('RoPE score = sum of the shares = 1.57');
	await expect(stage(page)).not.toContainText('sinusoids added instead: −1.22');
	await range(page, 'at').fill('50');
	await expect(stage(page)).toContainText('RoPE score = sum of the shares = 1.57');
	// A different distance, a different score.
	await page.getByRole('slider', { name: 'Query token (sets the distance)' }).focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('0 apart');
	await expect(stage(page)).toContainText('RoPE score = sum of the shares = 0.83');
});

test('RoPE: while the arrows turn, the score is the sum of the shares drawn', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.clock.install();
	await page.goto('./positional-encoding/#rotate');
	// Before the turn: the plain q·k score of the unturned vectors.
	await expect(stage(page)).toContainText('sum of the shares = 0.83');
	// Once turned by m·θ and n·θ: the RoPE score.
	await playUntil(page, stage(page), 'sum of the shares = 1.57', 6000);
});

test('past the training length, slow pairs reach new angles', async ({ page }) => {
	await page.goto('./positional-encoding/#beyond');
	await range(page, 'len').press('Home');
	await expect(stage(page)).toContainText('this text runs to 63');
	await expect(stage(page)).toContainText('0 of 8 pairs reach new angles');
	await range(page, 'len').press('End');
	await expect(stage(page)).toContainText('this text runs to 1023');
	await expect(stage(page)).toContainText('5 of 8 pairs reach new angles');
});
