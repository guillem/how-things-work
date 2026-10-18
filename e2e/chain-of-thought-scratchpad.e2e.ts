import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

// The chain-of-thought-scratchpad explainer: both shipped models run in the page on the sum the
// visitor picks, and the charts show the measured accuracies. The model tests check the numbers
// and the weights; these check what a visitor sees.
const stage = (page: Page) => page.locator('.stage svg > g');
const option = (page: Page, value: string) =>
	page.locator(`button[data-control=sum][data-value="${value}"]`);

test.describe('with reduced motion (complete transcripts)', () => {
	test.beforeEach(async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
	});

	test(
		'the first sum: the direct model writes a carry that never comes, the scratchpad model is right',
		{ tag: '@smoke' },
		async ({ page }) => {
			await page.goto('./chain-of-thought-scratchpad/#two-models');
			await expect(stage(page)).toContainText('34,681,209 + 39,314,615');
			await expect(stage(page)).toContainText('74,995,824, wrong');
			await expect(stage(page)).toContainText('73,995,824, right');
			await expect(stage(page)).toContainText('longest run of nines: 2 columns, no carry comes in');
			// the raw text each model wrote, working and all
			await expect(stage(page)).toContainText('00074995824.');
			await expect(stage(page)).toContainText('41208050909031700000>00073995824.');
		}
	);

	test('picking sums: a preset, then random ones drawn by the button', async ({ page }) => {
		await page.goto('./chain-of-thought-scratchpad/#working');
		const another = page.locator('button[data-control=another]');
		await expect(another).toBeDisabled();
		await option(page, '457+68').click();
		await expect(stage(page)).toContainText('457 + 68');
		await expect(stage(page).getByText('525, right')).toHaveCount(2);
		await option(page, 'nines').click();
		await expect(another).toBeEnabled();
		const title = stage(page).locator('text').first();
		const first = await title.textContent();
		await expect(stage(page)).toContainText(/longest run of nines: [5-7] columns/);
		await another.click();
		await expect(title).not.toHaveText(first ?? '');
		await expect(stage(page)).toContainText(/longest run of nines: [5-7] columns/);
	});

	test('the charts: runs of nines, then the lengths beyond training', async ({ page }) => {
		await page.goto('./chain-of-thought-scratchpad/#nines');
		await expect(stage(page)).toContainText('Right answers on 8-digit sums, by run of nines');
		await expect(stage(page)).toContainText('all 3,200 sums with a run of nines');
		await page.keyboard.press('ArrowRight');
		await expect(stage(page)).toContainText('Right answers, by length of the numbers');
		await expect(stage(page)).toContainText('beyond training');
	});
});

test('the two models write one character per pass, the scratchpad one for longer', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./chain-of-thought-scratchpad/#two-models');
	await expect(stage(page)).toContainText('writing…');
	// the direct model's 12 characters are done first, while the scratchpad model still writes
	await playUntil(page, stage(page), '74,995,824, wrong', 10_000);
	await expect(stage(page)).toContainText('writing…');
	await playUntil(page, stage(page), '73,995,824, right', 20_000);
});
