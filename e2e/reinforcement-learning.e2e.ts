import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const episodes = (page: Page) => page.getByRole('slider', { name: 'Episode' });

/** Jump to the end of training with the episode bar's End key. */
async function finish(page: Page) {
	await episodes(page).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('All episodes done');
}

test('after training, the start square is worth 10 × 0.9¹² ≈ 2.82, as the exact solution says', async ({
	page
}) => {
	await page.goto('/reinforcement-learning/#discount');
	await finish(page);
	await expect(stage(page)).toContainText('learnt so far: 2.82');
	await expect(stage(page)).toContainText('exact: 2.82');
	// Still on the same step: the keys belong to the episode bar.
	await expect(page).toHaveURL(/#discount$/);
});

test('little exploration settles for the +1; exploring less and less finds the +10', async ({
	page
}) => {
	await page.goto('/reinforcement-learning/#explore');
	await finish(page);
	await expect(stage(page)).toContainText('the +1, in 4 moves');
	await page.locator('input[type=range][data-control=epsilon]').fill('1');
	await page.locator('input[type=checkbox][data-control=decay]').check({ force: true });
	await finish(page);
	await expect(stage(page)).toContainText('the +10, in 8 moves');
	await expect(stage(page)).toContainText('10.00');
});

test('painting a reward next to the start changes what the agent learns', async ({ page }) => {
	await page.goto('/reinforcement-learning/#paint');
	await finish(page);
	await expect(stage(page)).toContainText('the +10, in 10 moves');
	await page.locator('button[data-control=brush][data-value=reward]').click();
	// The map cursor starts on the square right of S; Space paints there.
	const editor = page.getByRole('button', { name: /^Map editor/ });
	await editor.focus();
	await expect(editor).toHaveAttribute('aria-label', /column 2, row 3: open floor/);
	await page.keyboard.press('Space');
	await expect(editor).toHaveAttribute('aria-label', /column 2, row 3: reward \+10/);
	await finish(page);
	await expect(stage(page)).toContainText('the +10, in 1 move');
	await page.locator('button[data-control=resetMap]').click();
	await finish(page);
	await expect(stage(page)).toContainText('the +10, in 10 moves');
});
