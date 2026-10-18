import { expect, test, type Page } from '@playwright/test';

// The rlhf-alignment explainer: what a visitor sees when they compare answers, add or throw away
// comparisons, and slide the KL leash. The numbers are the page's default (the stand-in rater's
// first 100 comparisons for the sleep question); the model tests check where they come from.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'clicking the better answer adds a comparison of your own',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./rlhf-alignment/#compare');
		await expect(stage(page)).toContainText('100 by the rater');
		await page
			.getByRole('button', { name: /^Prefer answer #/ })
			.first()
			.click();
		await expect(stage(page)).toContainText('100 by the rater, 1 by you');
		await expect(stage(page)).toContainText(/You preferred #\d+ to #\d+; the rater would pick it/);
		// the keyboard works too
		await page
			.getByRole('button', { name: /^Prefer answer #/ })
			.last()
			.focus();
		await page.keyboard.press('Enter');
		await expect(stage(page)).toContainText('100 by the rater, 2 by you');
	}
);

test('more comparisons make the reward model agree better with the rater', async ({ page }) => {
	await page.goto('./rlhf-alignment/#reward-model');
	await expect(stage(page)).toContainText('correlation 0.47');
	for (let i = 0; i < 3; i++) await page.locator('button[data-control=rate]').click();
	await expect(stage(page)).toContainText('400 comparisons');
	await expect(stage(page)).toContainText('correlation 0.71');
	await page.locator('button[data-control=forget]').click();
	await expect(stage(page)).toContainText('No comparisons yet: every answer gets the same reward');
	await page.locator('button[data-control=restart]').click();
	await expect(stage(page)).toContainText('correlation 0.47');
});

test('the leash: β large stays on GPT-2, β small puts everything on one answer', async ({
	page
}) => {
	await page.goto('./rlhf-alignment/#tilt');
	await expect(stage(page)).toContainText('KL from GPT-2: 1.16 nats');
	await range(page, 'leash').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('β = 10');
	await expect(stage(page)).toContainText('KL from GPT-2: 0.01 nats');
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('β = 0.010');
	await expect(stage(page)).toContainText('KL from GPT-2: 4.16 nats');
	await expect(stage(page)).toContainText('100% · rater 1');
});

test('the policy-gradient run ends near the exact optimum at β = 1', async ({ page }) => {
	await page.goto('./rlhf-alignment/#gradient');
	// reduced motion shows the finished run
	await expect(stage(page)).toContainText(
		/step 600 of 600 · distance to the exact optimum [0-4]\.\d%/
	);
});

test('loosening the leash games the reward model', async ({ page }) => {
	await page.goto('./rlhf-alignment/#hacking');
	await expect(stage(page)).toContainText('peak 1.33 at β ≈ 0.79');
	await range(page, 'leash').focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('rater 1.00 · reward model +4.07');
	await expect(stage(page)).toContainText('When running, start with the start');
});
